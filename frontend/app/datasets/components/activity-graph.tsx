"use client"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface ActivityGraphProps {
  data: number[]
  chartHeightPx?: number
  className?: string
}

const CHART_HEIGHT_PX = 96

export function ActivityGraph({
  data,
  className,
  chartHeightPx = CHART_HEIGHT_PX,
}: ActivityGraphProps) {
  const maxValue = Math.max(...data)

  const getIntensity = (value: number) => {
    if (value === 0) return 0
    if (value <= maxValue * 0.25) return 1
    if (value <= maxValue * 0.5) return 2
    if (value <= maxValue * 0.75) return 3
    return 4
  }

  const getColor = (intensity: number) => {
    switch (intensity) {
      case 0:
        return "bg-muted"
      case 1:
        return "bg-green-200 dark:bg-green-900"
      case 2:
        return "bg-green-300 dark:bg-green-700"
      case 3:
        return "bg-green-400 dark:bg-green-600"
      case 4:
        return "bg-green-500 dark:bg-green-500"
      default:
        return "bg-muted"
    }
  }

  const getWeekDateRange = (weekIndex: number) => {
    const now = new Date()
    const weeksAgo = 11 - weekIndex
    const endDate = new Date(now)
    endDate.setDate(now.getDate() - weeksAgo * 7)
    const startDate = new Date(endDate)
    startDate.setDate(endDate.getDate() - 6)

    return {
      start: startDate.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      end: endDate.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
    }
  }

  return (
    <div
      className={cn("flex w-64 items-end", className)}
      style={{ height: chartHeightPx }}
    >
      {data.map((value, index) => {
        const { start, end } = getWeekDateRange(index)
        return (
          <Tooltip key={index} delayDuration={0}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "flex flex-1 items-end px-0.5 brightness-100 transition hover:brightness-75 dark:hover:brightness-150",
                )}
                style={{ height: chartHeightPx }}
              >
                <div
                  className={`h-full w-full rounded-sm ${getColor(
                    getIntensity(value),
                  )}`}
                  style={{
                    height: computeBarHeight(value, maxValue, chartHeightPx),
                  }}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs">
                <div className="font-medium">{value} requests</div>
                <div className="text-muted-foreground">
                  {start} - {end}
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}

function computeBarHeight(
  value: number,
  maxValue: number,
  chartHeightPx: number,
) {
  const minHeight = 4
  if (maxValue === 0) return minHeight
  return Math.max(minHeight, (value / maxValue) * chartHeightPx)
}
