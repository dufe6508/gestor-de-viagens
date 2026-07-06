"use client";

import type { ReactNode } from "react";
import { haptic } from "@/lib/utils";
import { cn } from "@/lib/utils";

/*
 * FAB — DESIGN.md §7. 56px, acima da nav flutuante.
 * Sage sólido com brilho especular e leve profundidade.
 * `className` permite reposicionar por tela (evita conflito com controles).
 */
export function Fab({
  onClick,
  label,
  children,
  className,
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={() => {
        haptic();
        onClick();
      }}
      aria-label={label}
      className={cn(
        "glass-float fixed right-5 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-40 grid size-12 place-items-center rounded-full text-foreground transition-[background-color,transform] duration-150 ease-(--ease-enter) hover:bg-white/5 active:scale-90",
        className,
      )}
    >
      {children}
    </button>
  );
}
