"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileTextIcon, RefreshCwIcon } from "lucide-react"
import { jobsApi } from "@/lib/api/jobs"
import type { Job } from "@/lib/api/api"
import { QUERY_CONFIG } from "@/lib/constants"

export function JobLogsDialog({ job }: { job: Job }) {
  const [open, setOpen] = useState(false)

  const { data: logs, refetch, isRefetching } = useQuery({
    queryKey: ["job-logs", job.uid],
    queryFn: () => jobsApi.getJobLogs(job.uid),
    enabled: open,
    refetchInterval: job.status === "running" ? QUERY_CONFIG.REFETCH_INTERVAL : false,
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full h-7 text-xs">
          <FileTextIcon className="mr-1 h-3 w-3" />
          View Logs
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Job Logs: {job.projectName}</DialogTitle>
              <DialogDescription>
                View stdout and stderr output from the job execution
              </DialogDescription>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              disabled={isRefetching}
            >
              <RefreshCwIcon className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </DialogHeader>

        <Tabs defaultValue="stdout" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="stdout">Standard Output</TabsTrigger>
            <TabsTrigger value="stderr">Standard Error</TabsTrigger>
          </TabsList>

          <TabsContent value="stdout" className="mt-4">
            <ScrollArea className="h-[500px] w-full rounded-md border bg-slate-950 p-4">
              <pre className="text-sm text-slate-50 font-mono whitespace-pre-wrap">
                {logs?.stdout || "No stdout logs available"}
              </pre>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="stderr" className="mt-4">
            <ScrollArea className="h-[500px] w-full rounded-md border bg-slate-950 p-4">
              <pre className="text-sm text-red-400 font-mono whitespace-pre-wrap">
                {logs?.stderr || "No stderr logs available"}
              </pre>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
