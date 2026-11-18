import { advance, EngineError, toPublic } from "@/lib/game/engine";
import { errorResponse } from "@/lib/http";
import { getStore } from "@/lib/store";

// Two concurrent model calls with retries can take a while.
export const maxDuration = 300;

/**
 * Runs ONE stage (COMMUNICATION or DECISION) of the current round.
 * Body: { roundNumber, stage } — must match the server's expected next step,
 * which makes duplicate or stale requests harmless (409 + current state).
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const body = await req.json();
    const stage = body?.stage;
    if (stage !== "COMMUNICATION" && stage !== "DECISION") throw new EngineError("Invalid stage", 400, "bad_request");
    const state = await advance(id, { roundNumber: Number(body?.roundNumber), stage });
    return Response.json({ game: toPublic(state) });
  } catch (e) {
    const res = errorResponse(e);
    // Always include the latest public state so the client can resync.
    const state = await getStore().get(id).catch(() => null);
    const payload = await res.json();
    return Response.json({ ...payload, game: state ? toPublic(state) : null }, { status: res.status });
  }
}
