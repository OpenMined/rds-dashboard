"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme()

  return (
    <Sonner
      theme={resolvedTheme as ToasterProps["theme"]}
      className="toaster group"
      style={
        {
          "--normal-bg": "hsl(var(--background))",
          "--normal-text": "hsl(var(--foreground))",
          "--normal-border": "hsl(var(--border))",
        } as React.CSSProperties
      }
      icons={
        {
          // success: <CircleCheckIcon className="size-5 text-emerald-500" />,
        }
      }
      toastOptions={{
        classNames: {
          toast: "!bg-background !text-foreground !border-border !shadow-lg",
          closeButton: "opacity-0 group-hover:opacity-100 !transition",
          success: "!bg-background !text-foreground !border-border",
          error: "!bg-background !text-foreground !border-border",
          info: "!bg-background !text-foreground !border-border",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
