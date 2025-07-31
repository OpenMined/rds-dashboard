"use client"

import { StateDebuggerProvider } from "@/components/state-debugger"
import { DragDropProvider } from "@/components/drag-drop-context"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  isServer,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query"
import { ThemeProvider } from "next-themes"
import type { ReactNode } from "react"

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined = undefined

function getQueryClient() {
  if (isServer) {
    return makeQueryClient()
  } else {
    if (!browserQueryClient) browserQueryClient = makeQueryClient()
    return browserQueryClient
  }
}

export default function Providers({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient()

  return (
    <StateDebuggerProvider show={false}>
      <ThemeProvider attribute="class" enableSystem>
        <DragDropProvider>
          <QueryClientProvider client={queryClient}>
            <TooltipProvider delayDuration={0}>{children}</TooltipProvider>
          </QueryClientProvider>
        </DragDropProvider>
      </ThemeProvider>
    </StateDebuggerProvider>
  )
}
