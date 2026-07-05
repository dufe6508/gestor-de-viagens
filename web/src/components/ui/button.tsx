import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/*
 * Botões — DESIGN.md §5.
 * Primário/secundário = pill; ações em lista = radius-md.
 * Feedback de toque: scale 0.97 (Emil), transições explícitas (nunca `all`).
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center border border-transparent bg-clip-padding font-medium whitespace-nowrap outline-none select-none transition-[background-color,border-color,color,transform] duration-150 ease-(--ease-swift) focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "rounded-full bg-primary font-semibold text-primary-foreground shadow-[0_4px_16px_-6px_rgb(0_0_0_/_0.6)] hover:bg-primary-strong",
        secondary:
          "rounded-full border-border bg-secondary text-secondary-foreground hover:border-border-strong",
        outline:
          "rounded-full border-border bg-transparent text-foreground hover:bg-secondary",
        ghost:
          "rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground aria-expanded:bg-secondary aria-expanded:text-foreground",
        destructive:
          "rounded-full bg-destructive/15 text-destructive hover:bg-destructive/25 focus-visible:border-destructive/40 focus-visible:ring-destructive/20",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 gap-2 px-5 text-sm",
        xs: "h-8 gap-1 rounded-md px-3 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-9 gap-1.5 rounded-md px-3.5 text-sm [&_svg:not([class*='size-'])]:size-4",
        lg: "h-12 gap-2 px-6 text-base",
        icon: "size-11",
        /* ponytail: 40px, abaixo dos 44 do spec — linhas densas; subir se errar toque */
        "icon-xs": "size-10 rounded-md [&_svg:not([class*='size-'])]:size-4",
        "icon-sm": "size-10 rounded-md",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
