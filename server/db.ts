import { Pool as NeonPool } from "@neondatabase/serverless";
import pg from "pg";
import { config } from "./config.js";

export interface Resultat<T> {
  rows: T[];
  rowCount: number | null;
}
export interface Requetable {
  query<T = any>(texte: string, valeurs?: unknown[]): Promise<Resultat<T>>;
}
interface Client extends Requetable {
  release(): void;
}
interface Piscine extends Requetable {
  connect(): Promise<Client>;
}

let piscine: Piscine | null = null;

// Neon (hôte *.neon.tech) : pilote serverless par WebSocket. Sinon (Postgres local) : pilote pg classique.
function pool(): Piscine {
  if (piscine) return piscine;
  const url = config.databaseUrl;
  piscine = /neon\.(tech|build)/.test(url)
    ? (new NeonPool({ connectionString: url, max: 5 }) as unknown as Piscine)
    : (new pg.Pool({ connectionString: url, max: 5 }) as unknown as Piscine);
  return piscine;
}

export const db: Requetable = {
  query: (t, v) => pool().query(t, v),
};

export async function un<T = any>(q: Requetable, texte: string, valeurs?: unknown[]): Promise<T | null> {
  return (await q.query<T>(texte, valeurs)).rows[0] ?? null;
}

// Transaction : tout réussit ou rien n'est enregistré.
export async function tx<T>(f: (q: Requetable) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const r = await f(client);
    await client.query("COMMIT");
    return r;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
