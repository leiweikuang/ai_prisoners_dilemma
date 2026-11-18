import type { GameState } from "../game/types";

export class VersionConflictError extends Error {}

export interface GameStore {
  get(id: string): Promise<GameState | null>;
  create(state: GameState): Promise<void>;
  /** Compare-and-swap save (updates version/updatedAt on the passed object on success): fails with VersionConflictError if `expectedVersion` is stale. */
  save(state: GameState, expectedVersion: number): Promise<GameState>;
  list(limit?: number): Promise<Pick<GameState, "gameId" | "createdAt" | "status" | "currentRound" | "totalRounds" | "players">[]>;
}
