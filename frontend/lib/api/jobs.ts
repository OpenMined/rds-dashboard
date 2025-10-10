import { apiClient } from "./api-client"

export interface JobLogs {
  stdout: string
  stderr: string
}

export const jobsApi = {
  getJob: (jobUid: string) => {
    return apiClient.get<any>(`/api/v1/jobs/${jobUid}`)
  },
  openJobCode: ({ jobUid }: { jobUid: string }) => {
    return apiClient.get<{}>(`/api/v1/jobs/open-code/${jobUid}`)
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
  deleteJob: (jobUid: string) => {
    return apiClient.delete<{}>(`/api/v1/jobs/${jobUid}`)
  },
}
