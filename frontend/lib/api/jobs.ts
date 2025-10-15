import { apiClient } from "./api-client"

export interface JobLogs {
  stdout: string
  stderr: string
}

export interface JobCode {
  code_dir: string
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
  getJobLogs: (jobUid: string) => {
    return apiClient.get<JobLogs>(`/api/v1/jobs/logs/${jobUid}`)
  },
  getJobCode: (jobUid: string) => {
    return apiClient.get<JobCode>(`/api/v1/jobs/code/${jobUid}`)
  },
  deleteJob: (jobUid: string) => {
    return apiClient.delete<{}>(`/api/v1/jobs/${jobUid}`)
  },
}
