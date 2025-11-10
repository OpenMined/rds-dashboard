import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { Job } from "@/lib/api/api"
import { cn } from "@/lib/utils"
import { CircleCheckBigIcon, CircleDashedIcon, CircleXIcon, LoaderCircleIcon, CheckCheckIcon, AlertCircleIcon } from "lucide-react"

export function JobStatusBadge({ jobStatus }: { jobStatus: Job["status"] }) {
  const statusClassName = {
    pending:
      "border-yellow-300 bg-yellow-50 text-yellow-600 dark:border-yellow-900 dark:bg-yellow-900/30 dark:text-yellow-400 hover:bg-yellow-100 hover:border-yellow-400 hover:text-yellow-700 dark:hover:bg-yellow-900/30",
    approved:
      "border-emerald-300 bg-emerald-50 text-emerald-600 dark:border-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-100 hover:border-emerald-400 hover:text-emerald-700 dark:hover:bg-emerald-900/30",
    rejected:
      "border-red-200 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30",
    running:
      "border-blue-300 bg-blue-50 text-blue-600 dark:border-blue-900 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-100 hover:border-blue-400 hover:text-blue-700 dark:hover:bg-blue-900/30",
    finished:
      "border-green-300 bg-green-50 text-green-600 dark:border-green-900 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100 hover:border-green-400 hover:text-green-700 dark:hover:bg-green-900/30",
    failed:
      "border-orange-300 bg-orange-50 text-orange-600 dark:border-orange-900 dark:bg-orange-900/30 dark:text-orange-400 hover:bg-orange-100 hover:border-orange-400 hover:text-orange-700 dark:hover:bg-orange-900/30",
  }

  const Icon = {
    pending: CircleDashedIcon,
    approved: CircleCheckBigIcon,
    rejected: CircleXIcon,
    running: LoaderCircleIcon,
    finished: CheckCheckIcon,
    failed: AlertCircleIcon,
  }[jobStatus]

  const tooltipContent = {
    pending: "This job is pending execution",
    approved: "This job has been approved and is ready to run",
    rejected: "This job has been rejected",
    running: "This job is currently running",
    finished: "This job has finished successfully",
    failed: "This job has failed",
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          className={cn(
            statusClassName[jobStatus],
            "cursor-default gap-2 transition",
            jobStatus === "running" && "animate-pulse",
          )}
        >
          <Icon className={cn(jobStatus === "running" && "animate-spin")} />
          {jobStatus}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{tooltipContent[jobStatus]}</TooltipContent>
    </Tooltip>
  )
}
