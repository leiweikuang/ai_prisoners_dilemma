import { EngineError } from "./game/engine";

export function errorResponse(e: unknown) {
  if (e instanceof EngineError) return Response.json({ error: e.message, code: e.code }, { status: e.httpStatus });
  console.error(e);
  return Response.json({ error: (e as Error)?.message ?? "Internal error", code: "internal" }, { status: 500 });
}
