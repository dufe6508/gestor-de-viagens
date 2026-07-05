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

// Paleta de cores p/ categorias — matizes vivas mas normalizadas (DESIGN.md §6):
// muteColor() fixa saturação/luminosidade, então aqui só a MATIZ importa.
// Espectro completo, sem cinza — cada categoria puxa uma cor viva distinta.
export const COR_OPTIONS = [
  "#7b6ef0", // violeta
  "#4f9df5", // azul
  "#29b9c9", // ciano
  "#46b97e", // verde
  "#a7c34a", // lima
  "#e0a53a", // âmbar
  "#e07a4e", // terracota
  "#e06b9c", // rosa
  "#6d7ff0", // índigo
  "#e05c5c", // vermelho
  "#9a6bf0", // roxo
  "#57b8a0", // teal
];

/**
 * Normalizador de cor — DESIGN.md §6 (revisado: vivo, não pastel).
 * Mantém a matiz da categoria e fixa saturação/luminosidade num tom vivo e
 * consistente. Dados antigos pálidos sobem; matizes gritantes descem — todos
 * pousam no mesmo nível de vivacidade, então o donut nunca vira arco-íris.
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
  s = Math.max(Math.min(s, 0.62), 0.5); // faixa de saturação viva
  const l = 0.6; // luminosidade fixa, viva no dark
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
