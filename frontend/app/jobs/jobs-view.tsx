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
import { Check, X, Briefcase, Play, Trash2, Info, RotateCw } from "lucide-react"
import { apiService, type Job } from "@/lib/api/api"
import { timeAgo } from "@/lib/utils"
import { jobsApi } from "@/lib/api/jobs"
import { QUERY_CONFIG } from "@/lib/constants"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
// import { AutoApprovalSettingsCard } from "./components/auto-approval-settings-card"
import { Skeleton } from "@/components/ui/skeleton"
import { JobLogsDialog } from "./components/job-logs-dialog"
import { JobDetailsDialog } from "./components/job-details-dialog"
import { JobCodeDialog } from "./components/job-code-dialog"
import { JobOutputDialog } from "./components/job-output-dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { useState } from "react"

export function JobsView() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Jobs</h1>
          <p className="text-muted-foreground">
            Manage data access requests and research projects
          </p>
        </div>
        <DeleteAllJobsButton />
      </div>

      {/* <AutoApprovalSettingsCard /> */}
      <JobsSection />
    </div>
  )
}

function DeleteAllJobsButton() {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  const deleteAllMutation = useMutation({
    mutationFn: () => jobsApi.deleteAllJobs(),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] })
      toast.success(`Successfully deleted ${response.count} job(s)`)
      setOpen(false)
    },
    onError: (error) => {
      toast.error(`Failed to delete jobs: ${error.message}`)
    },
  })

  const handleDeleteAll = () => {
    deleteAllMutation.mutate()
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete All Jobs
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete all jobs and their associated data
            (logs, outputs, and user code). This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeleteAll}
            disabled={deleteAllMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteAllMutation.isPending ? "Deleting..." : "Delete All"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function JobsSection() {
  const jobsQuery = useQuery({
    queryKey: ["jobs"],
    queryFn: async () => {
      const result = await apiService.getJobs()
      return result
    },
    refetchInterval: QUERY_CONFIG.REFETCH_INTERVAL,
    refetchOnWindowFocus: QUERY_CONFIG.REFETCH_ON_WINDOW_FOCUS,
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
  const runMutation = useMutation({
    mutationFn: (jobUid: string) => jobsApi.runJob(jobUid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["jobs"] }),
  })
  const rerunMutation = useMutation({
    mutationFn: (jobUid: string) => jobsApi.rerunJob(jobUid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] })
      toast.success("Job restarted successfully")
    },
    onError: (error: Error) => {
      toast.error(`Failed to rerun job: ${error.message}`)
    },
  })
  const deleteMutation = useMutation({
    mutationFn: (jobUid: string) => jobsApi.deleteJob(jobUid),
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
        <div className="flex gap-4 overflow-x-auto pb-4">
          {(["pending", "approved", "rejected", "running", "finished", "failed"] as const).map((status) => {
            const statusJobs = getJobsByStatus(data?.jobs ?? [], status)

            const columnStyles = {
              pending: "border-yellow-200 dark:border-yellow-900",
              approved: "border-emerald-200 dark:border-emerald-900",
              rejected: "border-red-200 dark:border-red-900",
              running: "border-blue-200 dark:border-blue-900",
              finished: "border-green-200 dark:border-green-900",
              failed: "border-orange-200 dark:border-orange-900",
            }

            return (
              <div key={status} className="flex flex-col flex-shrink-0 w-56">
                <div className={`border-t-4 rounded-t-lg ${columnStyles[status]} bg-card p-2`}>
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-semibold capitalize">
                      {status}
                    </h2>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {statusJobs.length}
                    </Badge>
                  </div>
                </div>

                <div className="flex-1 space-y-2 mt-2 min-h-[200px] max-h-[calc(100vh-400px)] overflow-y-auto pr-2">
                  {statusJobs.length === 0 ? (
                    <div className="text-center text-muted-foreground text-xs py-8">
                      No jobs
                    </div>
                  ) : (
                    statusJobs.map((job) => (
                      <Card key={job.uid} className="hover:shadow-lg hover:bg-gray-100 hover:border-gray-700 transition-all border-black dark:border-gray-700 dark:hover:bg-gray-800/50">
                        <CardHeader className="pb-1 px-2 pt-2">
                          <div className="flex items-center justify-between gap-1">
                            <CardTitle className="text-xs truncate font-semibold flex-1">
                              {job.projectName}
                            </CardTitle>
                            <JobDetailsDialog job={job}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0 hover:bg-muted"
                                title="Show Details"
                              >
                                <Info className="h-3 w-3" />
                              </Button>
                            </JobDetailsDialog>
                          </div>
                          <CardDescription className="text-[10px] line-clamp-1 mt-0.5">
                            {job.description}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-1.5 px-2 pb-2">
                          <p className="text-muted-foreground text-[10px]">
                            {timeAgo(job.requestedTime.toISOString())} by{" "}
                            <span className="text-foreground/70 font-medium">{job.requesterEmail}</span>
                          </p>
                          <div className="flex flex-col gap-1">
                            {job.status === "pending" && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => approveMutation.mutate(job.uid)}
                                  className="border-emerald-500 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-900/30 w-full h-7 text-xs"
                                >
                                  <Check className="mr-1 h-3 w-3" />
                                  Approve
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => rejectMutation.mutate(job.uid)}
                                  className="border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/30 w-full h-7 text-xs"
                                >
                                  <X className="mr-1 h-3 w-3" />
                                  Reject
                                </Button>
                              </>
                            )}
                            {job.status === "approved" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => runMutation.mutate(job.uid)}
                                disabled={runMutation.isPending}
                                className="border-blue-500 text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/30 w-full h-7 text-xs"
                              >
                                <Play className="mr-1 h-3 w-3" />
                                {runMutation.isPending ? "Starting..." : "Run"}
                              </Button>
                            )}
                            {(job.status === "running" || job.status === "finished" || job.status === "failed") && (
                              <>
                                <JobLogsDialog job={job} />
                                <JobOutputDialog job={job} />
                              </>
                            )}
                            {(job.status === "finished" || job.status === "failed") && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => rerunMutation.mutate(job.uid)}
                                disabled={rerunMutation.isPending}
                                className="border-blue-500 text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/30 w-full h-7 text-xs"
                              >
                                <RotateCw className="mr-1 h-3 w-3" />
                                {rerunMutation.isPending ? "Starting..." : "Rerun"}
                              </Button>
                            )}
                            <JobCodeDialog job={job} />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deleteMutation.mutate(job.uid)}
                              disabled={deleteMutation.isPending}
                              className="border-2 border-orange-600 text-orange-700 hover:bg-orange-50 hover:text-orange-800 hover:border-orange-700 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-900/30 w-full h-7 text-xs font-medium"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
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
