import { apiClient } from "./api-client"

export const jobsApi = {
  openJobCode: ({ jobUid }: { jobUid: string }) => {
    return apiClient.get<{}>(`/api/v1/jobs/open-code/${jobUid}`)
  },
  approveJob: (jobUid: string) => {
    return apiClient.post<{}>(`/api/v1/jobs/approve/${jobUid}`, {})
  },
  rejectJob: (jobUid: string) => {
    return apiClient.post<{}>(`/api/v1/jobs/reject/${jobUid}`, {})
  },
}
