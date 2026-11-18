import { connection } from "next/server";
import { EngineError, toPublic } from "@/lib/game/engine";
import { errorResponse } from "@/lib/http";
import { getStore } from "@/lib/store";


export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await connection();
  try {
    const { id } = await ctx.params;
    const state = await getStore().get(id);
    if (!state) throw new EngineError("Game not found", 404, "not_found");
    return Response.json({ game: toPublic(state) });
  } catch (e) {
    return errorResponse(e);
  }
}
