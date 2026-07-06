"use client";

import {
  MapPin,
  Car,
  Bus,
  Plane,
  Ship,
  TrainFront,
  FerrisWheel,
  Mountain,
  Waves,
  TreePalm,
  Landmark,
  Ticket,
  Camera,
  UtensilsCrossed,
  Tent,
  Bike,
  type LucideIcon,
} from "lucide-react";

// Ícones p/ passeios. Chave = string guardada em passeio.icone.
export const PASSEIO_ICONS: Record<string, LucideIcon> = {
  MapPin,
  Car,
  Bus,
  Plane,
  Ship,
  TrainFront,
  FerrisWheel,
  Mountain,
  Waves,
  TreePalm,
  Landmark,
  Ticket,
  Camera,
  UtensilsCrossed,
  Tent,
  Bike,
};

export const PASSEIO_ICON_OPTIONS = Object.keys(PASSEIO_ICONS);

export function PasseioIcon({ nome, className }: { nome: string; className?: string }) {
  const Icon = PASSEIO_ICONS[nome] ?? MapPin;
  return <Icon className={className} />;
}
