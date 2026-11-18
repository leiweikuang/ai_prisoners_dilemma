import { Suspense } from "react";
import { LiveView } from "@/components/LiveRoom";
import { Thinking } from "@/components/ui";

async function Room({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LiveView id={id} />;
}

export default function Page({ params }: PageProps<"/game/[id]">) {
  return (
    <Suspense fallback={<main className="flex flex-1 items-center justify-center"><Thinking label="Loading case file" /></main>}>
      <Room params={params} />
    </Suspense>
  );
}
