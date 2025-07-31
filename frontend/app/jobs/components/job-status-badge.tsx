import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { Job } from "@/lib/api/api"
import { cn } from "@/lib/utils"
import { CircleCheckBigIcon, CircleDashedIcon, CircleXIcon } from "lucide-react"

export function JobStatusBadge({ jobStatus }: { jobStatus: Job["status"] }) {
  const statusClassName = {
    pending:
      "border-yellow-300 bg-yellow-50 text-yellow-600 dark:border-yellow-900 dark:bg-yellow-900/30 dark:text-yellow-400 hover:bg-yellow-100 hover:border-yellow-400 hover:text-yellow-700 dark:hover:bg-yellow-900/30",
    approved:
      "border-emerald-300 bg-emerald-50 text-emerald-600 dark:border-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-100 hover:border-emerald-400 hover:text-emerald-700 dark:hover:bg-emerald-900/30",
    denied:
      "border-red-200 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30",
  }

  const Icon = {
    pending: CircleDashedIcon,
    approved: CircleCheckBigIcon,
    denied: CircleXIcon,
  }[jobStatus]

  const tooltipContent = {
    pending: "This job is pending execution",
    approved: "This job has been approved and executed",
    denied: "This job has been denied",
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          className={cn(
            statusClassName[jobStatus],
            "cursor-default gap-2 transition",
          )}
        >
          <Icon />
          {jobStatus}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{tooltipContent[jobStatus]}</TooltipContent>
    </Tooltip>
  )
}
