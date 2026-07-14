import { redirect } from "next/navigation";

// Fase 1: a home é a lista de tarefas.
// Quando o Hub "Hoje" existir (Fase 5), este redirect passa a apontar pra /hoje.
export default function Home() {
  redirect("/tarefas");
}
