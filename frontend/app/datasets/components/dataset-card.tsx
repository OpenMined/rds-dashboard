import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription } from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { Dataset } from "@/lib/api/types"
import {
  Calendar,
  ChartColumn,
  HardDrive,
  TableIcon,
  Users,
} from "lucide-react"
import { FaShopify } from "react-icons/fa6"
import { DatasetMetaBadge } from "./dataset-meta-badge"
import { timeAgo } from "@/lib/utils"
import { ActivityGraph } from "./activity-graph"
import { SyncShopifyDatasetAction } from "./sync-shopify-action"

export function DatasetCard({
  dataset,
  onSelect,
}: {
  dataset: Dataset
  onSelect: () => void
}) {
  return (
    <Card>
      <CardContent className="flex justify-between">
        {/* Left side content */}
        <div className="flex flex-1 flex-col justify-between gap-3">
          {/* Title and badges */}
          <div>
            <div className="mb-1 flex items-center gap-3">
              <h3
                className="cursor-pointer text-xl font-semibold text-blue-600 hover:underline"
                onClick={onSelect}
              >
                {dataset.name}
              </h3>
              {/* Dataset Badges */}
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="secondary"
                      className="cursor-default gap-2 bg-green-100 text-green-800 transition-colors hover:bg-green-200 hover:text-green-900 dark:bg-green-900 dark:text-green-300 dark:hover:bg-green-800 dark:hover:text-green-100"
                    >
                      <TableIcon size={12} /> {dataset.type.toUpperCase()}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    Dataset format: {dataset.type.toUpperCase()}
                  </TooltipContent>
                </Tooltip>
                {dataset.source?.type === "shopify" ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="outline"
                        className="hover:bg-muted dark:hover:bg-muted cursor-default gap-2 transition-colors"
                      >
                        <FaShopify size={14} /> Shopify
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>Dataset linked from Shopify</TooltipContent>
                  </Tooltip>
                ) : null}
              </div>
            </div>
            <CardDescription className="text-muted-foreground text-sm">
              {dataset.description}
            </CardDescription>
          </div>

          {/* Metadata row */}
          <div className="-mb-1 -ml-2 flex flex-wrap gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <DatasetMetaBadge>
                  <Users className="h-4 w-4 shrink-0" />
                  {`${dataset.usersCount} ${
                    dataset.usersCount === 1 ? "user" : "users"
                  }`}
                </DatasetMetaBadge>
              </TooltipTrigger>
              <TooltipContent collisionPadding={8}>
                {dataset.usersCount}{" "}
                {dataset.usersCount === 1 ? "user has" : "users have"} requested
                access to this dataset
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <DatasetMetaBadge>
                  <ChartColumn className="h-4 w-4 shrink-0" />
                  {dataset.requestsCount} requests
                </DatasetMetaBadge>
              </TooltipTrigger>
              <TooltipContent>
                {dataset.requestsCount} total access
                {dataset.requestsCount === 1 ? " request" : " requests"}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <DatasetMetaBadge>
                  <Calendar className="h-4 w-4 shrink-0" />
                  Updated {timeAgo(dataset.lastUpdated.toISOString())}
                </DatasetMetaBadge>
              </TooltipTrigger>
              <TooltipContent>
                Last updated on{" "}
                {dataset.lastUpdated.toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <DatasetMetaBadge>
                  <HardDrive className="h-4 w-4 shrink-0" />
                  {dataset.size}
                </DatasetMetaBadge>
              </TooltipTrigger>
              <TooltipContent>
                The dataset is {dataset.size} in size
              </TooltipContent>
            </Tooltip>
          </div>

          {/* User permissions pills */}
          {dataset.permissions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {dataset.permissions.map((email, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="bg-muted text-xs"
                >
                  {email}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
        <div className="mr-2 flex flex-col justify-end">
          {dataset.source?.type === "shopify" ? (
            <SyncShopifyDatasetAction dataset={dataset} />
          ) : null}
        </div>
        {/* Right side - Activity graph */}
        <ActivityGraph data={dataset.activityData} />
      </CardContent>
    </Card>
  )
}
