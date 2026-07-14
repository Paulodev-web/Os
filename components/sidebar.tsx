"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Sun,
  CheckSquare,
  CalendarClock,
  KanbanSquare,
  Users,
  Wallet,
  Layers,
  Dumbbell,
  UtensilsCrossed,
  MessageCircle,
  Rocket,
  PiggyBank,
  LogOut,
  Menu,
  X,
} from "lucide-react";

const NAV = [
  {
    section: "Hub",
    items: [
      { href: "/hoje", label: "Hoje", icon: Sun },
      { href: "/tarefas", label: "Tarefas", icon: CheckSquare },
      { href: "/reunioes", label: "Reuniões", icon: CalendarClock },
    ],
  },
  {
    section: "devpaulo.com.br",
    items: [
      { href: "/comercial", label: "Comercial", icon: KanbanSquare },
      { href: "/clientes", label: "Clientes", icon: Users },
      { href: "/financeiro", label: "Financeiro", icon: Wallet },
      { href: "/financeiro/consolidado", label: "Consolidado + pessoal", icon: Layers },
    ],
  },
  {
    section: "Pessoal",
    items: [
      { href: "/treino", label: "Treino", icon: Dumbbell },
      { href: "/dieta", label: "Dieta", icon: UtensilsCrossed },
      { href: "/coach", label: "Coach IA", icon: MessageCircle },
    ],
  },
  {
    // iService é outra empresa: navegação própria, financeiro isolado por regra
    section: "iService",
    items: [
      { href: "/iservice", label: "Decisões & Roadmap", icon: Rocket },
      { href: "/iservice/financeiro", label: "Financeiro iService", icon: PiggyBank },
    ],
  },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {NAV.map((group) => (
        <div key={group.section}>
          <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-widest text-white/35">
            {group.section}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/financeiro" &&
                  item.href !== "/iservice" &&
                  pathname.startsWith(`${item.href}/`)) ||
                (item.href === "/clientes" && pathname.startsWith("/clientes/")) ||
                (item.href === "/reunioes" && pathname.startsWith("/reunioes/"));
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      active
                        ? "bg-white/10 text-white"
                        : "text-white/60 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <Icon size={16} strokeWidth={2.2} className={active ? "text-primary-soft" : ""} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Wordmark() {
  return (
    <Link href="/hoje" className="flex items-baseline gap-1 px-6 pt-6 pb-2">
      <span className="text-lg font-black tracking-tight text-white">
        devpaulo
      </span>
      <span className="h-1.5 w-1.5 rounded-full bg-primary-soft" />
      <span className="ml-1 text-xs font-light text-white/50">OS Pessoal</span>
    </Link>
  );
}

function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="mx-3 mb-4 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold text-white/50 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
    >
      <LogOut size={16} strokeWidth={2.2} />
      {loading ? "Saindo…" : "Sair"}
    </button>
  );
}

export function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-graphite lg:flex">
        <Wordmark />
        <NavLinks />
        <LogoutButton />
      </aside>

      {/* Mobile: topbar + drawer */}
      <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-between bg-graphite px-4 py-3 lg:hidden">
        <Link href="/hoje" className="flex items-baseline gap-1">
          <span className="text-base font-black tracking-tight text-white">
            devpaulo
          </span>
          <span className="h-1 w-1 rounded-full bg-primary-soft" />
        </Link>
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          className="rounded-lg p-1.5 text-white/70 hover:bg-white/10"
        >
          <Menu size={20} />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-graphite/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-graphite shadow-pop">
            <div className="flex items-center justify-between pr-4">
              <Wordmark />
              <button
                onClick={() => setOpen(false)}
                aria-label="Fechar menu"
                className="rounded-lg p-1.5 text-white/70 hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>
            <NavLinks onNavigate={() => setOpen(false)} />
            <LogoutButton />
          </aside>
        </div>
      )}
    </>
  );
}
