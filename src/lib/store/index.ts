import { FileStore } from "./file";
import { SupabaseStore } from "./supabase";
import type { GameStore } from "./types";

let store: GameStore | null = null;

export function getStore(): GameStore {
  if (store) return store;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  store = url && key ? new SupabaseStore(url, key) : new FileStore();
  return store;
}

export function storeKind() {
  return process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? "supabase" : "file";
}

export { VersionConflictError } from "./types";
