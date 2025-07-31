"use client"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check, X, Briefcase, Code2Icon } from "lucide-react"
import { apiService, type Job } from "@/lib/api/api"
import { timeAgo } from "@/lib/utils"
import { jobsApi } from "@/lib/api/jobs"
import { useQuery } from "@tanstack/react-query"
import { AutoApprovalSettingsCard } from "./components/auto-approval-settings-card"
import { Skeleton } from "@/components/ui/skeleton"
import { JobStatusBadge } from "./components/job-status-badge"

export function JobsView() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Jobs</h1>
        <p className="text-muted-foreground">
          Manage data access requests and research projects
        </p>
      </div>

      <AutoApprovalSettingsCard />
      <JobsSection />
    </div>
  )
}

import { useMutation, useQueryClient } from "@tanstack/react-query"

function JobsSection() {
  const jobsQuery = useQuery({
    queryKey: ["jobs"],
    queryFn: async () => {
      const result = await apiService.getJobs()
      return result
    },
  })
  const queryClient = useQueryClient()

  const approveMutation = useMutation({
    mutationFn: (jobUid: string) => jobsApi.approveJob(jobUid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["jobs"] }),
  })
  const rejectMutation = useMutation({
    mutationFn: (jobUid: string) => jobsApi.rejectJob(jobUid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["jobs"] }),
  })

  const getJobsByStatus = (jobs: Job[], status: Job["status"]) => {
    return jobs.filter((job) => job.status === status)
  }

  const { isPending, data } = jobsQuery

  if (isPending) {
    return <JobsLoadingSkeleton />
  }

  return (
    <>
      {data?.jobs.length === 0 ? (
        <div className="py-12 text-center">
          <div className="mx-auto max-w-md">
            <div className="text-muted-foreground mx-auto mb-4 h-12 w-12">
              <Briefcase className="h-12 w-12" />
            </div>
            <h3 className="text-foreground mb-2 text-lg font-medium">
              No jobs found
            </h3>
            <p className="text-muted-foreground mb-6">
              Jobs will appear here when researchers request access to your
              datasets
            </p>
          </div>
        </div>
      ) : (
        (["pending", "approved", "denied"] as const).map((status) => {
          const statusJobs = getJobsByStatus(data?.jobs ?? [], status)
          if (statusJobs.length === 0) return null

          return (
            <div key={status} className="space-y-4">
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-semibold capitalize">
                  {status} Jobs
                </h2>
                <Badge variant="outline">{statusJobs.length}</Badge>
              </div>

              <div className="grid gap-4">
                {statusJobs.map((job) => (
                  <Card key={job.uid}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="flex items-center gap-4 text-lg">
                            {job.projectName}
                          </CardTitle>
                          <CardDescription>{job.description}</CardDescription>
                        </div>
                        <JobStatusBadge jobStatus={job.status} />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-end justify-between">
                        <p className="text-muted-foreground text-sm">
                          Requested {timeAgo(job.requestedTime.toISOString())}{" "}
                          by{" "}
                          <strong className="text-foreground/70 font-semibold tracking-wide">
                            {job.requesterEmail}
                          </strong>
                        </p>
                        <div className="flex gap-2">
                          {job.status === "pending" && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => approveMutation.mutate(job.uid)}
                                className="border-emerald-500 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
                              >
                                <Check className="mr-2 h-4 w-4" />
                                Approve
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => rejectMutation.mutate(job.uid)}
                                className="border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/30"
                              >
                                <X className="mr-2 h-4 w-4" />
                                Deny
                              </Button>
                            </>
                          )}
                          <ViewJobCodeButton job={job} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )
        })
      )}
    </>
  )
}

function JobsLoadingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-7 w-64" />
      {[...Array(3)].map((_, i) => (
        <Card key={i}>
          <CardContent className="flex h-40 flex-col justify-between p-6">
            <div className="flex justify-between">
              <div>
                <Skeleton className="mb-1 h-8 w-80" />
                <Skeleton className="h-5 w-64" />
              </div>
              <Skeleton className="h-[22px] w-16" />
            </div>
            <div className="flex items-end justify-between">
              <Skeleton className="h-5 w-96" />
              <Skeleton className="h-9 w-32" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function ViewJobCodeButton({ job }: { job: Job }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => jobsApi.openJobCode({ jobUid: job.uid })}
    >
      <Code2Icon />
      View Code
    </Button>
  )
}
