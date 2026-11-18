import { control, EngineError, toPublic } from "@/lib/game/engine";
import { errorResponse } from "@/lib/http";


export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const { action } = await req.json();
    if (action !== "pause" && action !== "resume") throw new EngineError("Invalid action", 400, "bad_request");
    return Response.json({ game: toPublic(await control(id, action)) });
  } catch (e) {
    return errorResponse(e);
  }
}
