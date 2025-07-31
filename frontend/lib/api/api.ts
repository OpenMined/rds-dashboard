import type { DatasetResponse } from "./types"

export interface Job {
  uid: string
  datasetName: string
  projectName: string
  description: string
  requestedTime: Date
  requesterEmail: string
  status: "pending" | "approved" | "denied"
}

interface JobResponse {
  uid: string
  createdBy: string
  createdAt: string
  updatedAt: string
  clientId: string
  name: string
  description: string
  userCodeId: string
  tags: string[]
  userMetadata: Record<string, string>
  status:
    | "pending_code_review"
    | "job_run_failed"
    | "job_run_finished"
    | "approved"
    | "shared"
    | "rejected"
  error: string
  errorMessage: string | null
  outputUrl: string
  datasetName: string
  enclave: string
}

const jobStatusMap = {
  pending_code_review: "pending",
  job_run_failed: "pending",
  job_run_finished: "approved",
  approved: "approved",
  shared: "approved",
  rejected: "denied",
} as const

interface JobListResponse {
  jobs: JobResponse[]
}

interface AutoApproveResponse {
  datasites: string[]
}

const getBaseUrl = () => {
  return process.env.NEXT_PUBLIC_API_URL || ""
}

export const apiService = {
  async createDataset(
    formData: FormData,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(
        `${getBaseUrl()}/api/v1/datasets/create-from-file`,
        {
          method: "POST",
          body: formData,
          // Important: Don't set Content-Type header - browser will set it automatically with boundary for FormData
        },
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || "Failed to create dataset")
      }

      const data: DatasetResponse = await response.json()
      return {
        success: true,
        message: `Dataset "${formData.get("name")}" created successfully`,
      }
    } catch (error) {
      console.error("Error creating dataset:", error)
      throw error
    }
  },

  async getJobs(): Promise<{ jobs: Job[] }> {
    const response = await fetch(`${getBaseUrl()}/api/v1/jobs`)
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "Failed to fetch jobs")
    }
    const data: JobListResponse = await response.json()
    return {
      jobs: data.jobs.map((job) => ({
        uid: job.uid,
        datasetName: job.datasetName,
        projectName: job.name,
        description: job.description,
        requestedTime: new Date(job.createdAt),
        requesterEmail: job.createdBy,
        status: jobStatusMap[job.status],
      })),
    }
  },

  async deleteDataset(datasetName: string): Promise<{ message: string }> {
    const response = await fetch(
      `${getBaseUrl()}/api/v1/datasets/${encodeURIComponent(datasetName)}`,
      {
        method: "DELETE",
      },
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "Failed to delete dataset")
    }

    const data = await response.json()
    return data
  },

  async downloadDatasetPrivate(datasetUid: string): Promise<Response> {
    const response = await fetch(
      `${getBaseUrl()}/api/v1/datasets/${datasetUid}/private`,
      {
        method: "GET",
      },
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "Failed to download dataset")
    }

    return response
  },
}
