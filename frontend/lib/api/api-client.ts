import { parseErrorResponse } from "./errors"
import { getApiBaseUrl } from "./config"

class ApiClient {
  private getBaseUrl(): string {
    return getApiBaseUrl();
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit,
  ): Promise<T> {
    const url = `${this.getBaseUrl()}${endpoint}`

    const config: RequestInit = {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    }

    const response = await fetch(url, config)

    if (response.ok) {
      return response.json()
    }

    throw await parseErrorResponse(response)
  }

  get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint)
  }

  post<T>(endpoint: string, data: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  put<T>(endpoint: string, data: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  }

  delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: "DELETE",
    })
  }
}

export const apiClient = new ApiClient()
