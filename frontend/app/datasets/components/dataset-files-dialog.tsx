"use client"

import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  FolderSymlinkIcon,
  FileIcon,
  FolderIcon,
  ChevronRight,
  ChevronDown,
  CopyIcon,
  CheckIcon,
} from "lucide-react"
import { datasetsApi } from "@/lib/api/datasets"
import type { Dataset } from "@/lib/api/types"
import { cn } from "@/lib/utils"
import { CodeHighlighter } from "@/app/jobs/components/code-highlighter"

interface TreeNode {
  name: string
  path: string
  type: "file" | "folder"
  children?: TreeNode[]
}

function buildFileTree(filePaths: string[]): TreeNode[] {
  const root: TreeNode[] = []

  filePaths.forEach((filePath) => {
    const parts = filePath.split("/")
    let currentLevel = root

    parts.forEach((part, index) => {
      const isFile = index === parts.length - 1
      const path = parts.slice(0, index + 1).join("/")

      let existingNode = currentLevel.find((node) => node.name === part)

      if (!existingNode) {
        const newNode: TreeNode = {
          name: part,
          path: path,
          type: isFile ? "file" : "folder",
          children: isFile ? undefined : [],
        }
        currentLevel.push(newNode)
        existingNode = newNode
      }

      if (!isFile && existingNode.children) {
        currentLevel = existingNode.children
      }
    })
  })

  return root
}

export function DatasetFilesDialog({ dataset }: { dataset: Dataset }) {
  const [open, setOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  )
  const [copied, setCopied] = useState(false)
  const [datasetType, setDatasetType] = useState<"private" | "mock">("private")

  const { data: filesData, isLoading } = useQuery({
    queryKey: ["dataset-files", dataset.uid, datasetType],
    queryFn: () => datasetsApi.getDatasetFiles(dataset.uid, datasetType),
    enabled: open,
  })

  const files = filesData?.files || {}
  const fileList = Object.keys(files).sort()
  const fileTree = buildFileTree(fileList)

  // Set the first file as selected if nothing is selected
  useEffect(() => {
    if (fileList.length > 0 && !selectedFile && !isLoading) {
      setSelectedFile(fileList[0])
    }
  }, [fileList.length, selectedFile, isLoading])

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev: Set<string>) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-start"
        >
          <FolderSymlinkIcon />
          View Dataset
        </Button>
      </DialogTrigger>
      <DialogContent className="!max-w-[50vw] !max-h-[90vh] !w-[50vw] !h-[90vh] p-5 !gap-0">
        <DialogHeader className="!gap-1 !space-y-0 !mb-0">
          <div className="flex items-center gap-2">
            <DialogTitle>Dataset Files: {dataset.name}</DialogTitle>
            <Badge
              variant={datasetType === "mock" ? "default" : "secondary"}
              className={cn(
                "text-xs",
                datasetType === "mock"
                  ? "bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700"
                  : "bg-orange-500 hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-700",
              )}
            >
              {datasetType === "mock" ? "Mock Data" : "Private Data"}
            </Badge>
          </div>
          <DialogDescription className="!mb-0">
            Browse and preview files in this dataset
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={datasetType}
          onValueChange={(value) => {
            setDatasetType(value as "private" | "mock")
            setSelectedFile(null)
            setExpandedFolders(new Set())
          }}
          className="w-full overflow-hidden !mt-0"
        >
          <TabsList className="!grid w-full grid-cols-2 !mt-0">
            <TabsTrigger value="private" className="!flex-1">Private Data</TabsTrigger>
            <TabsTrigger value="mock" className="!flex-1">Mock Data</TabsTrigger>
          </TabsList>

          <TabsContent value={datasetType} className="mt-1">
            {isLoading ? (
              <div className="flex items-center justify-center h-[calc(90vh-190px)]">
                <div className="text-sm text-muted-foreground">
                  Loading {datasetType} data...
                </div>
              </div>
            ) : (
              <div className="flex gap-4 h-[calc(90vh-190px)] overflow-hidden">
          {/* File Tree Sidebar */}
          <div className="w-56 border-r pr-4 flex-shrink-0 flex flex-col">
            <div className="text-xs font-semibold mb-2 text-muted-foreground flex items-center gap-1">
              <FolderIcon className="h-3 w-3" />
              Files
            </div>
            <ScrollArea className="flex-1">
              {isLoading ? (
                <div className="text-xs text-muted-foreground">
                  Loading files...
                </div>
              ) : fileList.length === 0 ? (
                <div className="text-xs text-muted-foreground">
                  No files found
                </div>
              ) : (
                <FileTreeView
                  nodes={fileTree}
                  selectedFile={selectedFile}
                  expandedFolders={expandedFolders}
                  onSelectFile={setSelectedFile}
                  onToggleFolder={toggleFolder}
                  level={0}
                />
              )}
            </ScrollArea>
          </div>

          {/* File Content Display */}
          <div className="flex-1 min-w-0 overflow-hidden">
            {selectedFile && selectedFile in files ? (
              <div className="h-full flex flex-col overflow-hidden">
                <div className="text-xs font-medium mb-2 text-muted-foreground">
                  {selectedFile}
                </div>
                <div className="flex-1 rounded-md border bg-slate-950 overflow-hidden">
                  <ScrollArea className="h-full w-full">
                    <div
                      className="p-4"
                      style={{ maxWidth: "100%", overflow: "hidden" }}
                    >
                      {files[selectedFile] ? (
                        files[selectedFile].startsWith("[") &&
                        files[selectedFile].endsWith("]") ? (
                          // Display metadata messages (binary files, errors, etc.)
                          <div className="text-muted-foreground text-xs italic">
                            {files[selectedFile]}
                          </div>
                        ) : selectedFile.endsWith('.csv') || selectedFile.endsWith('.tsv') ? (
                          // Display CSV/TSV as plain text with wrapping
                          <pre
                            className="text-xs text-slate-50 font-mono whitespace-pre-wrap"
                            style={{
                              overflowWrap: 'anywhere',
                              wordBreak: 'break-word'
                            }}
                          >
                            {files[selectedFile]}
                          </pre>
                        ) : (
                          // Display other files with syntax highlighting
                          <CodeHighlighter
                            code={files[selectedFile]}
                            filePath={selectedFile}
                          />
                        )
                      ) : (
                        <div className="text-muted-foreground text-xs italic">
                          This file is empty
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                {isLoading
                  ? "Loading files..."
                  : "Select a file to view its contents"}
              </div>
            )}
          </div>
            </div>
            )}
          </TabsContent>
        </Tabs>

        {filesData?.data_dir && (
          <div className="flex items-start gap-2 text-xs mt-2">
            <span className="text-muted-foreground font-medium">
              Dataset directory:
            </span>
            <span className="flex-1 break-all text-blue-500 underline">
              {filesData.data_dir}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 flex-shrink-0"
              onClick={() => copyToClipboard(filesData.data_dir)}
            >
              {copied ? (
                <CheckIcon className="h-3 w-3 text-green-500" />
              ) : (
                <CopyIcon className="h-3 w-3" />
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function FileTreeView({
  nodes,
  selectedFile,
  expandedFolders,
  onSelectFile,
  onToggleFolder,
  level,
}: {
  nodes: TreeNode[]
  selectedFile: string | null
  expandedFolders: Set<string>
  onSelectFile: (path: string) => void
  onToggleFolder: (path: string) => void
  level: number
}) {
  return (
    <div className="space-y-0.5">
      {nodes.map((node) => (
        <div key={node.path}>
          {node.type === "folder" ? (
            <>
              <button
                onClick={() => onToggleFolder(node.path)}
                className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-accent/50 transition-colors flex items-center gap-1"
                style={{ paddingLeft: `${level * 12 + 8}px` }}
              >
                {expandedFolders.has(node.path) ? (
                  <ChevronDown className="h-3 w-3 flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-3 w-3 flex-shrink-0" />
                )}
                <FolderIcon className="h-3 w-3 flex-shrink-0 text-blue-500" />
                <span className="truncate font-medium">{node.name}</span>
              </button>
              {expandedFolders.has(node.path) && node.children && (
                <FileTreeView
                  nodes={node.children}
                  selectedFile={selectedFile}
                  expandedFolders={expandedFolders}
                  onSelectFile={onSelectFile}
                  onToggleFolder={onToggleFolder}
                  level={level + 1}
                />
              )}
            </>
          ) : (
            <button
              onClick={() => onSelectFile(node.path)}
              className={cn(
                "w-full text-left text-xs px-2 py-1.5 rounded hover:bg-accent transition-colors flex items-center gap-1",
                selectedFile === node.path && "bg-accent font-medium",
              )}
              style={{ paddingLeft: `${level * 12 + 8}px` }}
            >
              <FileIcon className="h-3 w-3 flex-shrink-0 text-gray-500" />
              <span className="truncate">{node.name}</span>
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
