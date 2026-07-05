import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

/*
 * Input — DESIGN.md §5 (revisado). Glass leve, radius suave, foco elegante.
 * Altura 48, fonte 16 (anti auto-zoom iOS). Label sempre visível acima.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-12 w-full min-w-0 rounded-md border border-white/10 bg-white/[0.04] px-4 text-base text-foreground shadow-[inset_0_1px_0_rgb(255_255_255_/_0.04)] backdrop-blur-sm transition-[border-color,box-shadow,background-color] duration-200 ease-(--ease-enter) outline-none placeholder:text-faint focus-visible:border-primary/60 focus-visible:bg-white/[0.06] focus-visible:shadow-[0_0_0_3px_rgb(147_184_152_/_0.14)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive/60",
        className
      )}
      {...props}
    />
  )
}

export { Input }
