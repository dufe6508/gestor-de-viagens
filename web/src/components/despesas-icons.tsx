"use client";

import type { CSSProperties } from "react";
import {
  Bus,
  BedDouble,
  UtensilsCrossed,
  Users,
  Package,
  Megaphone,
  Wrench,
  ShoppingCart,
  Receipt,
  Ticket,
  Fuel,
  Coffee,
  Gift,
  ShieldCheck,
  Landmark,
  Wallet,
  Camera,
  Hammer,
  Plane,
  Briefcase,
  CircleDollarSign,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

// Ícones disponíveis p/ categorias. Chave = string guardada no banco.
export const CATEGORIA_ICONS: Record<string, LucideIcon> = {
  Bus,
  BedDouble,
  UtensilsCrossed,
  Users,
  Package,
  Megaphone,
  Wrench,
  ShoppingCart,
  Receipt,
  Ticket,
  Fuel,
  Coffee,
  Gift,
  ShieldCheck,
  Landmark,
  Wallet,
  Camera,
  Hammer,
  Plane,
  Briefcase,
  CircleDollarSign,
  Sparkles,
};

export const ICON_OPTIONS = Object.keys(CATEGORIA_ICONS);

// Paleta de cores p/ categorias — dessaturada de propósito (DESIGN.md §6):
// distinguíveis entre si, mas nenhuma grita mais que o acento sage do app.
export const COR_OPTIONS = [
  "#9c96c9", // lavanda
  "#7fa3c4", // azul
  "#74b3ba", // ciano
  "#8fae94", // sage
  "#a9b378", // oliva
  "#c9a86a", // âmbar
  "#c98f70", // terracota
  "#c491a9", // rosa
  "#8b9bc4", // índigo
  "#c67b6f", // vermelho
  "#ab8fc4", // roxo claro
  "#95a09a", // cinza
];

/**
 * Teto de saturação — DESIGN.md §6.
 * Qualquer cor de categoria (inclusive dados antigos saturados) é puxada para
 * um tom calmo: mantém a matiz, limita saturação e fixa luminosidade confortável.
 * Assim o donut/legenda nunca "gritam" nem viram arco-íris genérico.
 */
export function muteColor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) / 255,
    g = ((n >> 8) & 255) / 255,
    b = (n & 255) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  const l0 = (max + min) / 2;
  let h = 0;
  const d = max - min;
  let s = d === 0 ? 0 : d / (1 - Math.abs(2 * l0 - 1));
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  s = Math.min(s, 0.4); // teto de saturação
  const l = 0.66; // luminosidade fixa e confortável no dark
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const mm = l - c / 2;
  let rr = 0,
    gg = 0,
    bb = 0;
  if (h < 60) [rr, gg, bb] = [c, x, 0];
  else if (h < 120) [rr, gg, bb] = [x, c, 0];
  else if (h < 180) [rr, gg, bb] = [0, c, x];
  else if (h < 240) [rr, gg, bb] = [0, x, c];
  else if (h < 300) [rr, gg, bb] = [x, 0, c];
  else [rr, gg, bb] = [c, 0, x];
  const to = (v: number) =>
    Math.round((v + mm) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(rr)}${to(gg)}${to(bb)}`;
}

export function CategoriaIcon({
  nome,
  className,
  style,
}: {
  nome: string;
  className?: string;
  style?: CSSProperties;
}) {
  const Icon = CATEGORIA_ICONS[nome] ?? Package;
  return <Icon className={className} style={style} />;
}
