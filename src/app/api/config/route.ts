import { connection } from "next/server";
import { PROVIDERS } from "@/lib/ai/registry";
import { storeKind } from "@/lib/store";


/** Non-secret configuration for the setup page. Never returns API keys. */
export async function GET() {
  await connection();
  const providers = Object.entries(PROVIDERS).map(([id, p]) => ({
    id,
    label: p.label,
    displayName: p.displayName,
    defaultModel: p.defaultModel(),
    models: p.models(),
    available: p.available(),
  }));
  return Response.json({ providers, store: storeKind(), onVercel: !!process.env.VERCEL });
}
