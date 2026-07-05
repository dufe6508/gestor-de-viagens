import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Estático puro: Capacitor empacota os arquivos no APK (sem servidor Node).
  output: "export",
  // Sem otimização de imagem de servidor (não há servidor no export).
  images: { unoptimized: true },
};

export default nextConfig;
