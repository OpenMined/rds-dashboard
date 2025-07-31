"use client"

import { DatasetActionsSheet } from "@/app/datasets/components/dataset-actions-sheet"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { datasetsApi } from "@/lib/api/datasets"
import type { Dataset } from "@/lib/api/types"
import { useQuery } from "@tanstack/react-query"
import { Database } from "lucide-react"
import { useEffect, useState } from "react"
import { DatasetCard } from "./components/dataset-card"
import { AddDatasetAction } from "./components/add-datasets-action"

export function DatasetsView() {
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null)
  const [actionsSheetOpen, setActionsSheetOpen] = useState(false)

  const loadDatasetsQuery = useQuery({
    queryKey: ["datasets"],
    queryFn: () => datasetsApi.getDatasets(),
  })

  const { isPending, data } = loadDatasetsQuery

  const handleActionsSheetClose = () => {
    setActionsSheetOpen(false)
    setTimeout(() => setSelectedDataset(null), 350)
  }

  useEffect(() => {
    if (!selectedDataset || !data) return

    const updatedDataset = data.datasets.find(
      (d) => d.uid === selectedDataset.uid,
    )

    if (!updatedDataset) return

    setSelectedDataset(updatedDataset)
  }, [data])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Datasets</h1>
          <p className="text-muted-foreground">
            Manage your cooperative's data assets
          </p>
        </div>

        <AddDatasetAction />
      </div>

      {isPending || !data ? (
        <DatasetLoadingSkeleton />
      ) : (
        <div className="space-y-4">
          {data.datasets.length === 0 ? (
            <div className="mx-auto flex h-96 max-w-md flex-col items-center justify-center">
              <Database
                className="text-muted-foreground mb-6 size-16"
                strokeWidth={1.5}
              />
              <h3 className="text-foreground text-lg font-medium">
                No datasets found
              </h3>
              <p className="text-muted-foreground mb-6">
                Add a new dataset to get started
              </p>
            </div>
          ) : (
            data.datasets.map((dataset) => (
              <DatasetCard
                key={dataset.uid}
                dataset={dataset}
                onSelect={() => {
                  setSelectedDataset(dataset)
                  setActionsSheetOpen(true)
                }}
              />
            ))
          )}
        </div>
      )}

      <DatasetActionsSheet
        dataset={selectedDataset}
        open={actionsSheetOpen}
        onOpenChange={handleActionsSheetClose}
      />
    </div>
  )
}

function DatasetLoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <Card key={i}>
          <CardContent className="flex justify-between p-6">
            <div className="flex w-2/3 flex-col justify-between gap-1">
              <div className="space-y-2">
                <Skeleton className="bg-muted h-6 w-1/3 rounded"></Skeleton>
                <Skeleton className="bg-muted h-4 w-2/3 rounded"></Skeleton>
              </div>
              <div className="flex h-4 gap-2">
                <Skeleton className="h-full w-20"></Skeleton>
                <Skeleton className="h-full w-20"></Skeleton>
                <Skeleton className="h-full w-48"></Skeleton>
                <Skeleton className="h-full w-20"></Skeleton>
              </div>
            </div>
            <Skeleton className="bg-muted h-24 w-64 rounded" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
