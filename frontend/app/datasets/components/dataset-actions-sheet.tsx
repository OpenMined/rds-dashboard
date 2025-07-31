"use client"

import { ActivityGraph } from "@/app/datasets/components/activity-graph"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useToast } from "@/hooks/use-toast"
import { apiService } from "@/lib/api/api"
import type { Dataset } from "@/lib/api/types"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangle,
  Download,
  FolderSymlinkIcon,
  Trash2,
} from "lucide-react"
import { useState } from "react"
import { UpdateDatasetModal } from "./update-dataset-modal"
import { datasetsApi } from "@/lib/api/datasets"

interface DatasetActionsSheetProps {
  dataset: Dataset | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DatasetActionsSheet({
  dataset,
  open,
  onOpenChange,
}: DatasetActionsSheetProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const queryClient = useQueryClient()

  const deleteDatasetMutation = useMutation({
    mutationFn: ({ datasetName }: { datasetName: string }) =>
      apiService.deleteDataset(datasetName),
    onError: (error) => {
      console.error(error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["datasets"] })
      onOpenChange(false)
      toast({
        title: "Success",
        description: "Removed dataset",
      })
    },
  })

  const handleDownloadDataset = async () => {
    if (!dataset) return

    setIsLoading(true)
    setErrorMessage("")

    try {
      const response = await apiService.downloadDatasetPrivate(dataset.uid)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const downloadLink = document.createElement("a")
      downloadLink.href = url
      const contentDisposition = response.headers.get("Content-Disposition")
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/)
      const filename = filenameMatch ? filenameMatch[1] : `${dataset.name}.csv`
      downloadLink.download = filename
      document.body.appendChild(downloadLink)
      downloadLink.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(downloadLink)
      toast({
        title: "Success",
        description: "Dataset downloaded successfully",
      })
      onOpenChange(false)
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to download dataset",
      )
    } finally {
      setIsLoading(false)
    }
  }

  if (!dataset) return null

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="scrollbar-thin overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-2xl">{dataset.name}</SheetTitle>
            <SheetDescription>{dataset.description}</SheetDescription>
          </SheetHeader>
          <div className="flex-1">
            {errorMessage && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription className="break-all">
                  {errorMessage}
                </AlertDescription>
              </Alert>
            )}
            <div className="flex flex-col gap-4 px-4">
              {/* Dataset Statistics */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <div className="text-muted-foreground">Format</div>
                  <div className="font-medium">
                    {dataset.type.toUpperCase()}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground">Size</div>
                  <div className="font-medium">{dataset.size}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground">Created</div>
                  <div className="font-medium">
                    {new Date(dataset.createdAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground">Last Updated</div>
                  <div className="font-medium">
                    {new Date(dataset.lastUpdated).toLocaleDateString(
                      undefined,
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      },
                    )}
                  </div>
                </div>
              </div>

              {/* Activity Graph */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">
                      Activity Overview
                    </CardTitle>
                    <div className="text-muted-foreground text-xs">
                      Last 12 weeks
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ActivityGraph
                    data={dataset.activityData}
                    className="w-full"
                    chartHeightPx={128}
                  />
                  <div className="text-muted-foreground mt-4 flex items-center justify-between text-xs">
                    <div>Total Requests: 1</div>
                    <div>Avg: 0/week</div>
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
            </div>
          </div>
          <SheetFooter>
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Actions</h3>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={handleDownloadDataset}
                  disabled={isLoading}
                >
                  <Download className="h-4 w-4" />
                  Download Dataset
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => datasetsApi.openLocalDirectory(dataset.uid)}
                >
                  <FolderSymlinkIcon />
                  View Dataset
                </Button>
                <UpdateDatasetModal dataset={dataset} />
                <Button
                  variant="outline"
                  className="w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => setIsDeleteDialogOpen(true)}
                  disabled={isLoading}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Dataset
                </Button>
              </div>
            </div>
            <Separator className="my-2" />
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full"
            >
              Close
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Delete Dataset
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold">{dataset.name}</span>? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                dataset &&
                deleteDatasetMutation.mutate({ datasetName: dataset.name })
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
