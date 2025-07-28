export type ClusterProducts = {
  id: number
  is_global: boolean
  products: number[]
  products_tags?: string[]
}

export type ClusterProductsMeta = {
  affected_products_cluster: number | null
  affected_products_count?: number
  allow_for_products?: number[]
  allow_all_products?: boolean
  allow_for_products_tags?: string[]
  related_objects_meta?: {
    affected_products_cluster?: Partial<ClusterProducts> | null
  }
}