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
import { Code2Icon, FileIcon, FolderIcon, ChevronRight, ChevronDown, CopyIcon, CheckIcon } from "lucide-react"
import { jobsApi } from "@/lib/api/jobs"
import type { Job } from "@/lib/api/api"
import { cn } from "@/lib/utils"
import { CodeHighlighter } from "./code-highlighter"

interface TreeNode {
  name: string
  path: string
  type: "file" | "folder"
  children?: TreeNode[]
}

function buildFileTree(filePaths: string[]): TreeNode[] {
  const root: TreeNode[] = []

  filePaths.forEach((filePath) => {
    const parts = filePath.split('/')
    let currentLevel = root

    parts.forEach((part, index) => {
      const isFile = index === parts.length - 1
      const path = parts.slice(0, index + 1).join('/')

      let existingNode = currentLevel.find(node => node.name === part)

      if (!existingNode) {
        const newNode: TreeNode = {
          name: part,
          path: path,
          type: isFile ? "file" : "folder",
          children: isFile ? undefined : []
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

export function JobCodeDialog({ job, children }: { job: Job; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState(false)

  const { data: codeData, isLoading } = useQuery({
    queryKey: ["job-code", job.uid],
    queryFn: () => jobsApi.getJobCode(job.uid),
    enabled: open,
  })

  const files = codeData?.files || {}
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
      console.error('Failed to copy:', err)
    }
  }


  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm" className="w-full h-7 text-xs">
            <Code2Icon className="mr-1 h-3 w-3" />
            View Code
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        className="!max-w-[50vw] !max-h-[90vh] !w-[50vw] !h-[90vh] p-4"
      >
        <DialogHeader>
          <DialogTitle>Job Code: {job.projectName}</DialogTitle>
          <DialogDescription>
            View the code files submitted for this job
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-4 h-[calc(90vh-160px)] overflow-hidden">
          {/* File Tree Sidebar */}
          <div className="w-56 border-r pr-4 flex-shrink-0">
            <div className="text-xs font-semibold mb-2 text-muted-foreground flex items-center gap-1">
              <FolderIcon className="h-3 w-3" />
              Files
            </div>
            <ScrollArea className="h-full">
              {isLoading ? (
                <div className="text-xs text-muted-foreground">Loading files...</div>
              ) : fileList.length === 0 ? (
                <div className="text-xs text-muted-foreground">No files found</div>
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

          {/* Code Display */}
          <div className="flex-1 min-w-0 overflow-hidden">
            {selectedFile && selectedFile in files ? (
              <div className="h-full flex flex-col overflow-hidden">
                <div className="text-xs font-medium mb-2 text-muted-foreground">
                  {selectedFile}
                </div>
                <div className="flex-1 rounded-md border bg-slate-950 overflow-hidden">
                  <ScrollArea className="h-full w-full">
                    <div className="p-4" style={{ maxWidth: '100%', overflow: 'hidden' }}>
                      {files[selectedFile] ? (
                        <CodeHighlighter
                          code={files[selectedFile]}
                          filePath={selectedFile}
                        />
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
                {isLoading ? "Loading code..." : "Select a file to view its contents"}
              </div>
            )}
          </div>
        </div>

        {codeData?.code_dir && (
          <div className="flex items-start gap-2 text-xs mt-2">
            <span className="text-muted-foreground font-medium">Code directory:</span>
            <span className="flex-1 break-all text-blue-500 underline">
              {codeData.code_dir}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 flex-shrink-0"
              onClick={() => copyToClipboard(codeData.code_dir)}
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
                selectedFile === node.path && "bg-accent font-medium"
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
