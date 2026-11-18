import { Suspense } from "react";
import { ResultsView } from "@/components/ResultsView";
import { Thinking } from "@/components/ui";

async function Report({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ResultsView id={id} />;
}

export default function Page({ params }: PageProps<"/game/[id]/results">) {
  return (
    <Suspense fallback={<main className="flex flex-1 items-center justify-center"><Thinking label="Compiling report" /></main>}>
      <Report params={params} />
    </Suspense>
  );
}
