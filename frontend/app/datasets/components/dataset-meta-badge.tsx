import { cn } from "@/lib/utils"

export function DatasetMetaBadge({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      {...props}
      className={cn(
        "flex cursor-default items-center gap-1.5 space-x-1 whitespace-nowrap rounded-sm bg-transparent px-2 py-0.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&>svg]:pointer-events-none [&>svg]:mb-px [&>svg]:size-4",
        className,
      )}
    >
      {children}
    </div>
  )
}
