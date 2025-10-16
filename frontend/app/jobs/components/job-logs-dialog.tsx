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
import { FileTextIcon, RefreshCwIcon, CopyIcon, CheckIcon } from "lucide-react"
import { toast } from "sonner"
import { jobsApi } from "@/lib/api/jobs"
import type { Job } from "@/lib/api/api"
import { QUERY_CONFIG } from "@/lib/constants"
import { ColorizedLogs } from "./colorized-logs"

export function JobLogsDialog({ job }: { job: Job }) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("stdout")
  const [copied, setCopied] = useState(false)

  const { data: logs, refetch, isRefetching } = useQuery({
    queryKey: ["job-logs", job.uid],
    queryFn: () => jobsApi.getJobLogs(job.uid),
    enabled: open,
    refetchInterval: job.status === "running" ? QUERY_CONFIG.REFETCH_INTERVAL : false,
    staleTime: 0,
    gcTime: 0,
  })

  const handleCopy = async () => {
    const content = activeTab === "stdout" ? logs?.stdout : logs?.stderr
    if (!content) {
      toast.error("No logs to copy")
      return
    }

    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      toast.success(`Copied ${activeTab === "stdout" ? "stdout" : "stderr"} logs to clipboard`)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      toast.error("Failed to copy logs")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full h-7 text-xs">
          <FileTextIcon className="mr-1 h-3 w-3" />
          View Logs
        </Button>
      </DialogTrigger>
      <DialogContent
        className="!max-w-[50vw] !max-h-[90vh] !w-[50vw] !h-[90vh] p-5 !gap-0"
      >
        <DialogHeader className="!gap-1 !space-y-0 !mb-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Job Logs: {job.projectName}</DialogTitle>
              <DialogDescription className="!mb-0">
                View stdout and stderr output from the job execution
              </DialogDescription>
            </div>
            <div className="flex gap-2 mr-6">
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                disabled={!logs}
                title={`Copy ${activeTab === "stdout" ? "stdout" : "stderr"} logs`}
              >
                {copied ? (
                  <CheckIcon className="h-4 w-4 text-green-500" />
                ) : (
                  <CopyIcon className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => refetch()}
                disabled={isRefetching}
                title="Refresh logs"
              >
                <RefreshCwIcon className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="stdout" value={activeTab} onValueChange={setActiveTab} className="w-full overflow-hidden !mt-0">
          <TabsList className="!grid w-full grid-cols-2 !mt-0">
            <TabsTrigger value="stdout" className="!flex-1">Standard Output</TabsTrigger>
            <TabsTrigger value="stderr" className="!flex-1">Standard Error</TabsTrigger>
          </TabsList>

          <TabsContent value="stdout" className="mt-1">
            <div className="h-[calc(90vh-150px)] w-full rounded-md border bg-slate-950 overflow-hidden">
              <ScrollArea className="h-full w-full">
                <div className="p-4" style={{ maxWidth: '100%', overflow: 'hidden' }}>
                  <pre
                    className="text-xs text-slate-50 font-mono whitespace-pre-wrap"
                    style={{
                      overflowWrap: 'anywhere',
                      wordBreak: 'break-word'
                    }}
                  >
                    {logs?.stdout ? (
                      <ColorizedLogs content={logs.stdout} />
                    ) : (
                      "No stdout logs available"
                    )}
                  </pre>
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          <TabsContent value="stderr" className="!mt-1">
            <div className="h-[calc(90vh-150px)] w-full rounded-md border bg-slate-950 overflow-hidden">
              <ScrollArea className="h-full w-full">
                <div className="p-4" style={{ maxWidth: '100%', overflow: 'hidden' }}>
                  <pre
                    className="text-xs text-slate-50 font-mono whitespace-pre-wrap"
                    style={{
                      overflowWrap: 'anywhere',
                      wordBreak: 'break-word'
                    }}
                  >
                    {logs?.stderr ? (
                      <ColorizedLogs content={logs.stderr} />
                    ) : (
                      "No stderr logs available"
                    )}
                  </pre>
                </div>
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
