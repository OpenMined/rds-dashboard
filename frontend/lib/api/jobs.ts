import { apiClient } from "./api-client"

export interface JobLogs {
  logs_dir: string
  stdout: string
  stderr: string
}

export interface JobCode {
  code_dir: string
  files: Record<string, string>
}

export interface JobOutput {
  output_dir: string
  files: Record<string, string>
}

export const jobsApi = {
  getJob: (jobUid: string) => {
    return apiClient.get<any>(`/api/v1/jobs/${jobUid}`)
  },
  approveJob: (jobUid: string) => {
    return apiClient.post<{}>(`/api/v1/jobs/approve/${jobUid}`, {})
  },
  rejectJob: (jobUid: string) => {
    return apiClient.post<{}>(`/api/v1/jobs/reject/${jobUid}`, {})
  },
  runJob: (jobUid: string) => {
    return apiClient.post<{}>(`/api/v1/jobs/run/${jobUid}`, {})
  },
  rerunJob: (jobUid: string) => {
    return apiClient.post<{}>(`/api/v1/jobs/rerun/${jobUid}`, {})
  },
  getJobLogs: (jobUid: string) => {
    return apiClient.get<JobLogs>(`/api/v1/jobs/logs/${jobUid}`)
  },
  getJobCode: (jobUid: string) => {
    return apiClient.get<JobCode>(`/api/v1/jobs/code/${jobUid}`)
  },
  getJobOutput: (jobUid: string) => {
    return apiClient.get<JobOutput>(`/api/v1/jobs/output/${jobUid}`)
  },
  deleteJob: (jobUid: string) => {
    return apiClient.delete<{}>(`/api/v1/jobs/${jobUid}`)
  },
  deleteAllJobs: () => {
    return apiClient.delete<{ message: string; count: number }>(`/api/v1/jobs`)
  },
}
