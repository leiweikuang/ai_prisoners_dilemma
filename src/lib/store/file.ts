import { promises as fs } from "fs";
import path from "path";
import type { GameState } from "../game/types";
import { VersionConflictError, type GameStore } from "./types";

/** Local JSON-file store (default). Not suitable for serverless deployments — use Supabase there. */
export class FileStore implements GameStore {
  private dir = path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR || ".data/games");
  private chain: Promise<unknown> = Promise.resolve();

  private file(id: string) {
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error("Invalid game id");
    return path.join(this.dir, `${id}.json`);
  }

  /** Serialise writes within this process so CAS checks are atomic. */
  private exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn, fn);
    this.chain = run.catch(() => undefined);
    return run;
  }

  async get(id: string) {
    try {
      return JSON.parse(await fs.readFile(this.file(id), "utf8")) as GameState;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }

  private async write(state: GameState) {
    await fs.mkdir(this.dir, { recursive: true });
    const tmp = `${this.file(state.gameId)}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(state, null, 2));
    await fs.rename(tmp, this.file(state.gameId));
  }

  create(state: GameState) {
    return this.exclusive(() => this.write(state));
  }

  save(state: GameState, expectedVersion: number) {
    return this.exclusive(async () => {
      const current = await this.get(state.gameId);
      if (!current || current.version !== expectedVersion) throw new VersionConflictError("Game was modified concurrently");
      const next = { ...state, version: expectedVersion + 1, updatedAt: new Date().toISOString() };
      await this.write(next);
      // Mutate in place only after a successful write so callers keep one live object.
      state.version = next.version;
      state.updatedAt = next.updatedAt;
      return state;
    });
  }

  async list(limit = 20) {
    try {
      const files = (await fs.readdir(this.dir)).filter((f) => f.endsWith(".json"));
      const games = await Promise.all(files.map((f) => this.get(f.replace(/\.json$/, ""))));
      return games
        .filter((g): g is GameState => !!g)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit)
        .map(({ gameId, createdAt, status, currentRound, totalRounds, players }) => ({ gameId, createdAt, status, currentRound, totalRounds, players }));
    } catch {
      return [];
    }
  }
}
