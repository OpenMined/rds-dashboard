interface ShopifySource {
  type: "shopify"
  store_url: string
  pat: string
}

export interface DatasetResponse {
  uid: string
  createdBy: string
  createdAt: string
  updatedAt: string
  clientId: string
  name: string
  private: string
  privateSize: number
  mock: string
  mockSize: number
  summary: string
  readme: string
  tags: string[]
  runtime: {
    cmd: string[]
    imageName: string | null
    mountDir: string | null
  }
  autoApproval: string[]
  source: undefined | ShopifySource
}

export interface Dataset {
  uid: string
  name: string
  description: string
  size: string
  type: string
  createdAt: Date
  lastUpdated: Date
  accessRequests: number
  permissions: string[]
  usersCount: number
  requestsCount: number
  activityData: number[]
  source: undefined | ShopifySource
}
