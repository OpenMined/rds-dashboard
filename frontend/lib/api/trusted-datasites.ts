import { apiClient } from "./api-client"

export const trustedDatasitesApi = {
  getTrustedDatasites: async () =>
    apiClient.get<{ datasites: string[] }>("/api/v1/trusted-datasites"),
  setTrustedDatasites: async (datasites: string[]) =>
    apiClient.post<{}>("/api/v1/trusted-datasites", { datasites }),
}
