"use client"

import { CircleCheckIcon } from "lucide-react"
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
          // "--normal-bg": "var(--color-popover)",
          "--normal-text": "var(--color-popover-foreground)",
          "--normal-border": "var(--color-border)",
        } as React.CSSProperties
      }
      icons={
        {
          // success: <CircleCheckIcon className="size-5 text-emerald-500" />,
        }
      }
      toastOptions={{
        classNames: {
          closeButton: "opacity-0 group-hover:opacity-100 !transition",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
