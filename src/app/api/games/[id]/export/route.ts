import { connection } from "next/server";
import { EngineError, toExport } from "@/lib/game/engine";
import { errorResponse } from "@/lib/http";
import { getStore } from "@/lib/store";


/** Full audit log (prompts, raw responses, retries) for revealed stages only. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await connection();
  try {
    const { id } = await ctx.params;
    const state = await getStore().get(id);
    if (!state) throw new EngineError("Game not found", 404, "not_found");
    return new Response(JSON.stringify(toExport(state), null, 2), {
      headers: {
        "content-type": "application/json",
        "content-disposition": `attachment; filename="interrogation-${id}.json"`,
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
