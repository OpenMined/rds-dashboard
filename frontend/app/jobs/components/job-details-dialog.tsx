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
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { jobsApi } from "@/lib/api/jobs"
import type { Job } from "@/lib/api/api"
import { JobStatusBadge } from "./job-status-badge"

interface JobDetailsDialogProps {
  job: Job
  children: React.ReactNode
}

export function JobDetailsDialog({ job, children }: JobDetailsDialogProps) {
  const [open, setOpen] = useState(false)

  const { data: jobDetails, isLoading } = useQuery({
    queryKey: ["job-details", job.uid],
    queryFn: () => jobsApi.getJob(job.uid),
    enabled: open,
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Job Details</DialogTitle>
          <DialogDescription>
            Complete metadata for job {job.uid}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : (
          <ScrollArea className="h-[500px] w-full rounded-md border p-4">
            <div className="space-y-4">
              <DetailRow label="Job Name" value={jobDetails?.name || "N/A"} />
              <DetailRow label="Description" value={jobDetails?.description || "N/A"} />
              <DetailRow
                label="Status"
                value={<JobStatusBadge jobStatus={job.status} />}
              />
              <DetailRow label="UID" value={jobDetails?.uid} mono />
              <DetailRow label="Dataset Name" value={jobDetails?.dataset_name} />
              <DetailRow label="Requester Email" value={jobDetails?.requester_email} />

              {jobDetails?.tags && jobDetails.tags.length > 0 && (
                <DetailRow
                  label="Tags"
                  value={
                    <div className="flex flex-wrap gap-1">
                      {jobDetails.tags.map((tag: string) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  }
                />
              )}

              <DetailRow
                label="Created At"
                value={jobDetails?.created_at ? new Date(jobDetails.created_at).toLocaleString() : "N/A"}
              />
              <DetailRow
                label="Updated At"
                value={jobDetails?.updated_at ? new Date(jobDetails.updated_at).toLocaleString() : "N/A"}
              />

              {jobDetails?.user_code_id && (
                <DetailRow label="User Code ID" value={jobDetails.user_code_id} mono />
              )}

              {jobDetails?.custom_function_id && (
                <DetailRow label="Custom Function ID" value={jobDetails.custom_function_id} mono />
              )}

              {jobDetails?.runtime_id && (
                <DetailRow label="Runtime ID" value={jobDetails.runtime_id} mono />
              )}

              {jobDetails?.enclave && (
                <DetailRow label="Enclave" value={jobDetails.enclave} />
              )}

              {jobDetails?.error && (
                <DetailRow
                  label="Error"
                  value={jobDetails.error}
                  className="text-red-600 dark:text-red-400"
                />
              )}

              {jobDetails?.error_message && (
                <DetailRow
                  label="Error Message"
                  value={jobDetails.error_message}
                  className="text-red-600 dark:text-red-400"
                />
              )}

              <DetailRow
                label="Output URL"
                value={jobDetails?.output_url || "N/A"}
                mono
              />
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}

function DetailRow({
  label,
  value,
  mono = false,
  className = ""
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
  className?: string
}) {
  return (
    <div className="grid grid-cols-3 gap-4 py-2 border-b border-border last:border-0">
      <div className="font-medium text-sm text-muted-foreground">{label}</div>
      <div className={`col-span-2 text-sm break-all ${mono ? "font-mono" : ""} ${className}`}>
        {value}
      </div>
    </div>
  )
}
