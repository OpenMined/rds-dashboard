"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Upload, FolderOpen, FileIcon, Folder } from "lucide-react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { apiService } from "@/lib/api/api"
import { useDragDrop } from "@/components/drag-drop-context"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

interface CreateDatasetModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function CreateDatasetModal({
  open,
  onOpenChange,
  onSuccess,
}: CreateDatasetModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [mockFile, setMockFile] = useState<File | null>(null)
  const [files, setFiles] = useState<FileList | null>(null)
  const [mockFiles, setMockFiles] = useState<FileList | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [uploadMode, setUploadMode] = useState<"file" | "folder">("file")
  const [mockUploadMode, setMockUploadMode] = useState<"file" | "folder">("file")
  const {
    isDragging,
    activeDropZone,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop: contextHandleDrop,
  } = useDragDrop()

  const queryClient = useQueryClient()

  const createDatasetMutation = useMutation({
    mutationFn: apiService.createDataset,
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["datasets"],
      })
      toast.success("New dataset created")
      onSuccess?.()
    },
  })

  const handleFileDrop = (e: React.DragEvent) => {
    contextHandleDrop(e, "create-dataset", (droppedFile) => {
      setFile(droppedFile)
      // Auto-fill name from file
      const fileName = droppedFile.name.replace(/\.[^/.]+$/, "")
      setName(fileName)
    })
  }

  const handleMockFileDrop = (e: React.DragEvent) => {
    contextHandleDrop(e, "create-mock-dataset", (droppedFile) => {
      setMockFile(droppedFile)
    })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (selectedFiles && selectedFiles.length > 0) {
      setFiles(selectedFiles)
      setFile(selectedFiles[0]) // Keep first file for backward compatibility

      // Auto-fill name from first file or folder
      const firstFile = selectedFiles[0]
      if (firstFile.webkitRelativePath) {
        // Extract folder name from path
        const folderName = firstFile.webkitRelativePath.split("/")[0]
        setName(folderName)
      } else {
        // Use file name without extension
        const fileName = firstFile.name.replace(/\.[^/.]+$/, "")
        setName(fileName)
      }
    }
  }

  const handleMockFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (selectedFiles && selectedFiles.length > 0) {
      setMockFiles(selectedFiles)
      setMockFile(selectedFiles[0]) // Keep first file for backward compatibility
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!files || files.length === 0) {
      setError("Please select a file or folder")
      return
    }

    if (!name.trim()) {
      setError("Please enter a dataset name")
      return
    }

    // Mock dataset is mandatory in this variant
    if (!mockFiles || mockFiles.length === 0) {
      setError("Mock dataset file or folder is required")
      return
    }

    setLoading(true)
    setError("")

    try {
      const formData = new FormData()

      // Add all files from the dataset folder/file
      Array.from(files).forEach((file) => {
        formData.append("dataset", file, file.webkitRelativePath || file.name)
      })
      formData.append("name", name.trim())
      formData.append("description", description.trim() || "")

      // Add all files from the mock dataset folder/file
      Array.from(mockFiles).forEach((file) => {
        formData.append("mock_dataset", file, file.webkitRelativePath || file.name)
      })

      createDatasetMutation.mutate(formData)
      // const result = await apiService.createDataset(formData);

      // if (result.success) {
      //   onSuccess();
      //   resetForm();
      //   onOpenChange(false);
      //   toast({
      //     title: "Success",
      //     description: result.message,
      //   });
      // }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create dataset")
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFile(null)
    setMockFile(null)
    setFiles(null)
    setMockFiles(null)
    setName("")
    setDescription("")
    setError("")
    setLoading(false)
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !loading) {
      resetForm()
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onDragEnter={(e) => handleDragEnter(e, "create-dataset")}
        onDragLeave={(e) => handleDragLeave(e, "create-dataset")}
        onDragOver={(e) => handleDragOver(e, "create-dataset")}
        onDrop={handleFileDrop}
      >
        <DialogHeader>
          <DialogTitle>Create New Dataset</DialogTitle>
          <DialogDescription>
            Get started by uploading your dataset file.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
          onDragEnter={(e) => handleDragEnter(e, "create-dataset")}
          onDragLeave={(e) => handleDragLeave(e, "create-dataset")}
          onDragOver={(e) => handleDragOver(e, "create-dataset")}
          onDrop={handleFileDrop}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="dataset-file">Dataset *</Label>
              <ToggleGroup
                type="single"
                value={uploadMode}
                onValueChange={(value) => {
                  if (value) {
                    setUploadMode(value as "file" | "folder")
                    // Clear selection when switching modes
                    setFile(null)
                    setFiles(null)
                  }
                }}
              >
                <ToggleGroupItem value="file" size="sm">
                  <FileIcon className="mr-1 h-3 w-3" />
                  Single file
                </ToggleGroupItem>
                <ToggleGroupItem value="folder" size="sm">
                  <Folder className="mr-1 h-3 w-3" />
                  Entire folder
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div
              className={`relative rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                activeDropZone === "create-dataset" && isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50"
              }`}
            >
              {uploadMode === "file" ? (
                <input
                  id="dataset-file"
                  type="file"
                  onChange={handleFileChange}
                  className="hidden"
                  multiple
                />
              ) : (
                <input
                  id="dataset-folder"
                  type="file"
                  onChange={handleFileChange}
                  className="hidden"
                  webkitdirectory=""
                  directory=""
                  multiple
                />
              )}
              <label htmlFor={uploadMode === "file" ? "dataset-file" : "dataset-folder"} className="block cursor-pointer">
                <div className="space-y-2">
                  <FolderOpen className="text-muted-foreground mx-auto h-8 w-8" />
                  <div className="text-sm">
                    <span className="text-primary font-medium hover:underline">
                      {activeDropZone === "create-dataset" && isDragging
                        ? "Drop your file here"
                        : "Drop your file here or click to select"}
                    </span>
                    <p className="text-muted-foreground mt-1">
                      Choose your dataset {uploadMode}
                    </p>
                  </div>
                </div>
              </label>
            </div>
            {files && (
              <p className="text-muted-foreground text-sm">
                Selected: {files.length > 1 ? `${files.length} files` : file?.name}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="mock-dataset-file">Mock Dataset *</Label>
              <ToggleGroup
                type="single"
                value={mockUploadMode}
                onValueChange={(value) => {
                  if (value) {
                    setMockUploadMode(value as "file" | "folder")
                    // Clear selection when switching modes
                    setMockFile(null)
                    setMockFiles(null)
                  }
                }}
              >
                <ToggleGroupItem value="file" size="sm">
                  <FileIcon className="mr-1 h-3 w-3" />
                  Single file
                </ToggleGroupItem>
                <ToggleGroupItem value="folder" size="sm">
                  <Folder className="mr-1 h-3 w-3" />
                  Entire folder
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div
              className={`relative rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                activeDropZone === "create-mock-dataset" && isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50"
              }`}
              onDragEnter={(e) => handleDragEnter(e, "create-mock-dataset")}
              onDragLeave={(e) => handleDragLeave(e, "create-mock-dataset")}
              onDragOver={(e) => handleDragOver(e, "create-mock-dataset")}
              onDrop={handleMockFileDrop}
            >
              {mockUploadMode === "file" ? (
                <input
                  id="mock-dataset-file"
                  type="file"
                  onChange={handleMockFileChange}
                  className="hidden"
                  multiple
                />
              ) : (
                <input
                  id="mock-dataset-folder"
                  type="file"
                  onChange={handleMockFileChange}
                  className="hidden"
                  webkitdirectory=""
                  directory=""
                  multiple
                />
              )}
              <label
                htmlFor={mockUploadMode === "file" ? "mock-dataset-file" : "mock-dataset-folder"}
                className="block cursor-pointer"
              >
                <div className="space-y-2">
                  <FolderOpen className="text-muted-foreground mx-auto h-8 w-8" />
                  <div className="text-sm">
                    <span className="text-primary font-medium hover:underline">
                      {activeDropZone === "create-mock-dataset" && isDragging
                        ? "Drop your mock file here"
                        : "Drop your mock file here or click to select"}
                    </span>
                    <p className="text-muted-foreground mt-1">
                      Choose your mock dataset {mockUploadMode}
                    </p>
                  </div>
                </div>
              </label>
            </div>
            {mockFiles && (
              <p className="text-muted-foreground text-sm">
                Selected: {mockFiles.length > 1 ? `${mockFiles.length} files` : mockFile?.name}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Dataset Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter dataset name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the dataset"
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription className="break-all">{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Create Dataset
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
