import { PageHeader } from "@/components/ui";
import { claudeConfigurado } from "@/lib/claude";
import { CoachChat } from "@/components/coach-chat";

export const dynamic = "force-dynamic";

export default function CoachPage() {
  return (
    <>
      <PageHeader
        title="Coach"
        subtitle="Treino e dieta com memória de verdade — responde com o que você registrou"
      />
      <CoachChat iaOn={claudeConfigurado()} />
    </>
  );
}
