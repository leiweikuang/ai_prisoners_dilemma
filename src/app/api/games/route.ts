import { connection } from "next/server";
import { createGame, toPublic } from "@/lib/game/engine";
import { errorResponse } from "@/lib/http";
import { getStore } from "@/lib/store";


export async function GET() {
  await connection();
  try {
    return Response.json({ games: await getStore().list(20) });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const state = await createGame({
      playerA: { provider: String(body?.playerA?.provider ?? "openai"), model: String(body?.playerA?.model ?? "") },
      playerB: { provider: String(body?.playerB?.provider ?? "anthropic"), model: String(body?.playerB?.model ?? "") },
      totalRounds: body?.totalRounds === undefined ? undefined : Number(body.totalRounds),
      memoryStartRound: body?.memoryStartRound === undefined ? undefined : Number(body.memoryStartRound),
      language: body?.language === "zh" ? "zh" : "en",
      payoff: body?.payoff,
    });
    return Response.json({ game: toPublic(state) }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
