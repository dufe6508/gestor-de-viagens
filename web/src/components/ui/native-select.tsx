import * as React from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

/*
 * Select nativo estilizado — o ÚNICO padrão de select (DESIGN.md §5).
 * Nativo de propósito: no mobile abre o picker do sistema. Glass leve p/ combinar c/ Input.
 */
function NativeSelect({
  className,
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <div className={cn("relative", className)}>
      <select
        data-slot="native-select"
        className="h-12 w-full appearance-none rounded-md border border-white/10 bg-white/[0.04] pr-11 pl-4 text-base text-foreground backdrop-blur-sm transition-[border-color] duration-200 outline-none focus-visible:border-primary/60 disabled:pointer-events-none disabled:opacity-50"
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-faint"
      />
    </div>
  )
}

export { NativeSelect }
