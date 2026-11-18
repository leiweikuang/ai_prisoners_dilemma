import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { GameState } from "../game/types";
import { VersionConflictError, type GameStore } from "./types";

/** Supabase Postgres store. Table definition: supabase/schema.sql */
export class SupabaseStore implements GameStore {
  private db: SupabaseClient;
  constructor(url: string, key: string) {
    this.db = createClient(url, key, { auth: { persistSession: false } });
  }

  async get(id: string) {
    const { data, error } = await this.db.from("games").select("state").eq("id", id).maybeSingle();
    if (error) throw error;
    return (data?.state as GameState) ?? null;
  }

  async create(state: GameState) {
    const { error } = await this.db.from("games").insert({ id: state.gameId, version: state.version, state });
    if (error) throw error;
  }

  async save(state: GameState, expectedVersion: number) {
    const next = { ...state, version: expectedVersion + 1, updatedAt: new Date().toISOString() };
    const { data, error } = await this.db
      .from("games")
      .update({ state: next, version: next.version, updated_at: next.updatedAt })
      .eq("id", state.gameId)
      .eq("version", expectedVersion)
      .select("id");
    if (error) throw error;
    if (!data || data.length === 0) throw new VersionConflictError("Game was modified concurrently");
    state.version = next.version;
    state.updatedAt = next.updatedAt;
    return state;
  }

  async list(limit = 20) {
    const { data, error } = await this.db.from("games").select("state").order("created_at", { ascending: false }).limit(limit);
    if (error) throw error;
    return (data ?? []).map(({ state }) => {
      const { gameId, createdAt, status, currentRound, totalRounds, players } = state as GameState;
      return { gameId, createdAt, status, currentRound, totalRounds, players };
    });
  }
}
