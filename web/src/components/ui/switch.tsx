"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "@/lib/utils";

/*
 * Toggle — mesma linguagem do Button (pill, --primary off-white quando ligado).
 * Ligado = trilho --primary (branco) + thumb escuro; desligado = trilho --secondary.
 */
function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-transparent bg-secondary p-0.5 transition-colors duration-150 ease-(--ease-swift) outline-none data-checked:bg-primary focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="size-6 rounded-full bg-foreground shadow-[0_2px_6px_-1px_rgb(0_0_0_/_0.5)] transition-transform duration-150 ease-(--ease-swift) data-checked:translate-x-5 data-checked:bg-primary-foreground"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
