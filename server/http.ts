import { z, type ZodType } from "zod";
import { config } from "./config.js";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}
export const erreur = (status: number, message: string, code?: string) => new HttpError(status, message, code);

export interface Ctx {
  req: Request;
  url: URL;
  params: Record<string, string>;
  ip: string;
  cookies: Record<string, string>;
  setCookie: string[];
  cache: Map<string, unknown>;
  body<T>(schema: ZodType<T>): Promise<T>;
}

type Handler = (c: Ctx) => Promise<Response | unknown> | Response | unknown;
interface Route {
  methode: string;
  segments: string[];
  handler: Handler;
}
const routes: Route[] = [];

export const route = (methode: string, chemin: string, handler: Handler) =>
  routes.push({ methode, segments: chemin.split("/").filter(Boolean), handler });
export const get = (c: string, h: Handler) => route("GET", c, h);
export const post = (c: string, h: Handler) => route("POST", c, h);
export const put = (c: string, h: Handler) => route("PUT", c, h);
export const patch = (c: string, h: Handler) => route("PATCH", c, h);
export const del = (c: string, h: Handler) => route("DELETE", c, h);

export function json(data: unknown, init: ResponseInit & { cookies?: string[] } = {}) {
  const h = new Headers(init.headers);
  h.set("content-type", "application/json; charset=utf-8");
  h.set("cache-control", h.get("cache-control") ?? "private, no-store");
  for (const c of init.cookies ?? []) h.append("set-cookie", c);
  return new Response(JSON.stringify(data), { ...init, headers: h });
}

function lireCookies(entete: string | null) {
  const out: Record<string, string> = {};
  for (const part of (entete ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function cookie(nom: string, valeur: string, opts: { maxAge?: number } = {}) {
  const p = [`${nom}=${encodeURIComponent(valeur)}`, "Path=/", "HttpOnly", "SameSite=Lax"];
  if (config.production) p.push("Secure");
  if (opts.maxAge !== undefined) p.push(`Max-Age=${opts.maxAge}`);
  return p.join("; ");
}

// Une requête qui modifie des données doit venir de notre propre site (protection CSRF en plus de SameSite=Lax).
function origineAutorisee(req: Request, url: URL) {
  const origine = req.headers.get("origin");
  if (!origine) return true; // appels serveur à serveur (webhooks, cron) : authentifiés par signature ou secret
  try {
    const o = new URL(origine);
    const hote = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
    if (o.host === hote) return true;
    return !!config.appUrl && o.origin === config.appUrl;
  } catch {
    return false;
  }
}

export async function repondre(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const segments = url.pathname.replace(/^\/api/, "").split("/").filter(Boolean);
  const methode = req.method.toUpperCase();
  try {
    if (methode !== "GET" && methode !== "HEAD" && !origineAutorisee(req, url)) throw erreur(403, "Requête refusée : origine inconnue.");

    let trouve: { r: Route; params: Record<string, string> } | null = null;
    let cheminConnu = false;
    for (const r of routes) {
      if (r.segments.length !== segments.length) continue;
      const params: Record<string, string> = {};
      let ok = true;
      for (let i = 0; i < r.segments.length; i++) {
        const s = r.segments[i];
        if (s.startsWith(":")) params[s.slice(1)] = decodeURIComponent(segments[i]);
        else if (s !== segments[i]) { ok = false; break; }
      }
      if (!ok) continue;
      cheminConnu = true;
      if (r.methode === methode) { trouve = { r, params }; break; }
    }
    if (!trouve) throw erreur(cheminConnu ? 405 : 404, cheminConnu ? "Méthode non autorisée." : "Ressource introuvable.");

    const c: Ctx = {
      req,
      url,
      params: trouve.params,
      ip: (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "inconnue",
      cookies: lireCookies(req.headers.get("cookie")),
      setCookie: [],
      cache: new Map(),
      async body<T>(schema: ZodType<T>) {
        let brut: unknown;
        try {
          brut = await req.json();
        } catch {
          throw erreur(400, "Le message envoyé est illisible. Réessayez.");
        }
        const r = schema.safeParse(brut);
        if (!r.success) throw erreur(422, messageValidation(r.error), "validation");
        return r.data;
      },
    };
    const sortie = await trouve.r.handler(c);
    if (sortie instanceof Response) {
      for (const k of c.setCookie) sortie.headers.append("set-cookie", k);
      return sortie;
    }
    return json(sortie === undefined ? { ok: true } : sortie, { cookies: c.setCookie });
  } catch (e) {
    if (e instanceof HttpError) return json({ erreur: e.message, code: e.code }, { status: e.status });
    console.error("[api] erreur inattendue", e);
    return json({ erreur: "Un problème est survenu de notre côté. Réessayez dans un instant." }, { status: 500 });
  }
}

function messageValidation(e: z.ZodError) {
  const i = e.issues[0];
  const champ = i.path.join(".");
  return `Vérifiez ce champ${champ ? ` (${champ})` : ""} : ${i.message}`;
}

export const requete = z;
