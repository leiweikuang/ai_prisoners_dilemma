import { ensureAnalysis, toPublic } from "@/lib/game/engine";
import { errorResponse } from "@/lib/http";

export const maxDuration = 300;

/**
 * Post-game analysis by DeepSeek (labels + summary). Cached on the game;
 * body { force: true } re-runs it. Never affects the interrogations.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const state = await ensureAnalysis(id, { force: body?.force === true });
    return Response.json({ game: toPublic(state) });
  } catch (e) {
    return errorResponse(e);
  }
}
