"use client";

import type { ReactNode } from "react";

/*
 * FAB — DESIGN.md §7. 56px, acima da nav flutuante.
 * Sage sólido com brilho especular e leve profundidade.
 */
export function Fab({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="glass-float fixed right-5 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-40 grid size-12 place-items-center rounded-full text-foreground transition-[background-color,transform] duration-150 ease-(--ease-enter) hover:bg-white/5 active:scale-90"
    >
      {children}
    </button>
  );
}
