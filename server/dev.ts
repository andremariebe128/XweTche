// Serveur de développement : npm run api:dev (port 3001). Vite renvoie /api vers ce port (vite.config.ts).
import { createServer } from "node:http";
import { Readable } from "node:stream";
import { gerer } from "./app.js";

const port = Number(process.env.API_PORT ?? 3001);
createServer(async (rq, rs) => {
  try {
    const url = new URL(rq.url ?? "/", `http://${rq.headers.host ?? "localhost"}`);
    const entetes = new Headers();
    for (const [k, v] of Object.entries(rq.headers)) if (v !== undefined) entetes.set(k, Array.isArray(v) ? v.join(", ") : v);
    const avecCorps = !["GET", "HEAD"].includes(rq.method ?? "GET");
    const req = new Request(url, { method: rq.method, headers: entetes, body: avecCorps ? (Readable.toWeb(rq) as ReadableStream) : undefined, duplex: "half" } as RequestInit);
    const rep = await gerer(req);
    const sortie: Record<string, string | string[]> = {};
    rep.headers.forEach((v, k) => { if (k !== "set-cookie") sortie[k] = v; });
    const cookies = rep.headers.getSetCookie();
    if (cookies.length) sortie["set-cookie"] = cookies;
    rs.writeHead(rep.status, sortie);
    rs.end(rep.body ? Buffer.from(await rep.arrayBuffer()) : undefined);
  } catch (e) {
    console.error(e);
    rs.writeHead(500).end("Erreur serveur");
  }
}).listen(port, () => console.log(`API sur http://localhost:${port}`));
