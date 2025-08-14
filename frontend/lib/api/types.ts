// 1:1 Dataset type that models a Syft Dataset
export interface DatasetModel {
  uid: string
  name: string
  createdAt: string
  updatedAt: string
  summary: string
  // createdBy: string
  // clientId: string
  // private: string
  // privateSize: number
  // mock: string
  // mockSize: number
  // readme: string
  // tags: string[]
  // runtime: {
  //   cmd: string[]
  //   imageName: string | null
  //   mountDir: string | null
  // }
  // autoApproval: string[]
  // source: undefined | ShopifySource
}

// Type used for displaying dataset information in the UI
export interface DatasetInfo {
  uid: string
  name: string
  createdAt: Date
  updatedAt: Date
  summary: string
  // size: string
  // type: string
  // accessRequests: number
  // permissions: string[]
  // usersCount: number
  // requestsCount: number
  // activityData: number[]
  // source: undefined | ShopifySource
}

interface ShopifySource {
  type: "shopify"
  store_url: string
  pat: string
}
