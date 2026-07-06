"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Home, Users, Wallet, Menu, Ticket, BarChart3, type LucideIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const STORAGE_KEY = "excursao_selecionada";

/*
 * Nav flutuante premium — DESIGN.md §7 (revisado).
 * Pill de vidro solta do fundo, cantos suaves, item ativo com "pílula" sage
 * que desliza atrás do ícone. Mais baixa e confortável.
 */
export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [maisOpen, setMaisOpen] = useState(false);

  const go = (base: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    const id = localStorage.getItem(STORAGE_KEY);
    if (base === "/passageiros" && !id) {
      toast("Crie uma excursão primeiro");
      return;
    }
    router.push(id ? `${base}?id=${id}` : base);
  };

  return (
    <>
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4"
      >
        <div className="glass-float flex h-[60px] w-full max-w-[22rem] items-stretch gap-1 rounded-[26px] p-1.5 md:max-w-md">
          <NavItem icon={Home} label="Início" active={pathname === "/"} href="/" />
          <NavItem
            icon={Users}
            label="Passageiros"
            active={pathname === "/passageiros" || pathname === "/passageiro"}
            href="/passageiros"
            onClick={go("/passageiros")}
          />
          <NavItem
            icon={Wallet}
            label="Despesas"
            active={pathname === "/despesas"}
            href="/despesas"
            onClick={go("/despesas")}
          />
          <NavItem icon={Menu} label="Mais" active={false} onClick={() => setMaisOpen(true)} />
        </div>
      </nav>

      <Dialog open={maisOpen} onOpenChange={setMaisOpen}>
        <DialogContent variant="sheet">
          <DialogHeader>
            <DialogTitle>Mais</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 pb-2">
            <MaisRow
              icon={Ticket}
              label="Passeios"
              onClick={() => {
                setMaisOpen(false);
                const id = localStorage.getItem(STORAGE_KEY);
                if (!id) return toast("Crie uma excursão primeiro");
                router.push(`/passeios?id=${id}`);
              }}
            />
            <MaisRow icon={BarChart3} label="Relatórios" onClick={() => (setMaisOpen(false), toast("Relatórios — em breve"))} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function NavItem({
  icon: Icon,
  label,
  active,
  href,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  href?: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const inner = (
    <>
      {/* pílula ativa — cresce por trás do ícone */}
      <span
        aria-hidden
        className={`absolute inset-0 rounded-[20px] bg-white/8 transition-all duration-300 ease-(--ease-enter) ${
          active ? "scale-100 opacity-100" : "scale-90 opacity-0"
        }`}
      />
      <Icon
        className={`relative size-[22px] transition-colors duration-200 ${
          active ? "text-foreground" : "text-faint"
        }`}
        strokeWidth={active ? 2 : 1.75}
        aria-hidden
      />
      <span
        className={`relative text-[10px] font-medium leading-none transition-colors duration-200 ${
          active ? "text-foreground" : "text-faint"
        }`}
      >
        {label}
      </span>
    </>
  );
  const cls =
    "relative flex flex-1 flex-col items-center justify-center gap-1 rounded-[20px] transition-transform duration-150 ease-(--ease-enter) active:scale-90";
  return href ? (
    <Link href={href} onClick={onClick} className={cls} aria-current={active ? "page" : undefined}>
      {inner}
    </Link>
  ) : (
    <button onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

function MaisRow({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex h-12 items-center gap-3 rounded-md px-3 text-left text-base text-muted-foreground transition-colors duration-150 hover:bg-white/5 hover:text-foreground"
    >
      <Icon className="size-5 text-faint" strokeWidth={1.75} aria-hidden />
      {label}
    </button>
  );
}
