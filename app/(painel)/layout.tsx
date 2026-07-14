import { requireUser } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";

// Shell autenticado: sidebar grafite + conteúdo off-white.
// requireUser() aqui é defesa em profundidade — o proxy.ts já barra na borda.
export default async function PainelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();

  return (
    <div className="min-h-screen">
      <Sidebar />
      <main className="px-4 pb-16 pt-16 lg:ml-60 lg:px-10 lg:pt-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
