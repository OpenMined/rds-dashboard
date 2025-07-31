import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Portal } from "@radix-ui/react-portal"

interface DebugState {
  debugPending: boolean
  debugError: boolean
  debugState: boolean
}

interface DebugStateContextValue extends DebugState {
  setDebugPending: (value: boolean) => void
  setDebugError: (value: boolean) => void
  setDebugState: (value: boolean) => void
  toggleDebugPending: () => void
  toggleDebugError: () => void
  toggleDebugState: () => void
  resetAll: () => void
}

const DebugStateContext = createContext<DebugStateContextValue | undefined>(
  undefined,
)

interface StateDebuggerProviderProps {
  children: ReactNode
  show?: boolean
  initialState?: Partial<DebugState>
}

export function StateDebuggerProvider({
  children,
  show = false,
  initialState = {},
}: StateDebuggerProviderProps) {
  const [debugPending, setDebugPending] = useState(
    initialState.debugPending ?? false,
  )
  const [debugError, setDebugError] = useState(initialState.debugError ?? false)
  const [debugState, setDebugState] = useState(initialState.debugState ?? false)

  const toggleDebugPending = useCallback(
    () => setDebugPending((prev) => !prev),
    [],
  )
  const toggleDebugError = useCallback(() => setDebugError((prev) => !prev), [])
  const toggleDebugState = useCallback(() => setDebugState((prev) => !prev), [])

  const resetAll = useCallback(() => {
    setDebugPending(false)
    setDebugError(false)
    setDebugState(false)
  }, [])

  const value: DebugStateContextValue = {
    debugPending,
    debugError,
    debugState,
    setDebugPending,
    setDebugError,
    setDebugState,
    toggleDebugPending,
    toggleDebugError,
    toggleDebugState,
    resetAll,
  }

  return (
    <DebugStateContext.Provider value={value}>
      {show ? <DebugPanel /> : null}
      {children}
    </DebugStateContext.Provider>
  )
}

export function useDebugState() {
  const context = useContext(DebugStateContext)
  if (!context) {
    throw new Error("useDebugState must be used within a StateDebuggerProvider")
  }
  return context
}

export function DebugPanel() {
  const {
    debugPending,
    debugError,
    debugState,
    setDebugPending,
    setDebugError,
    setDebugState,
    resetAll,
  } = useDebugState()

  // Only show in development
  if (process.env.NODE_ENV === "production") {
    return null
  }

  return (
    <Portal asChild>
      <div
        data-debug-panel
        className="bg-background/50 fixed top-4 right-4 z-1000 rounded-full backdrop-blur-xs"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <Card className="flex items-center gap-8 rounded-full bg-transparent p-4 px-6 opacity-60 shadow-lg">
          <div className="flex items-center gap-2">
            <Label className="whitespace-nowrap">
              <Switch
                checked={debugPending}
                onCheckedChange={setDebugPending}
              />
              Pending
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Label className="whitespace-nowrap">
              <Switch checked={debugError} onCheckedChange={setDebugError} />
              Error
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Label className="whitespace-nowrap">
              <Switch checked={debugState} onCheckedChange={setDebugState} />
              State
            </Label>
          </div>
          <Button
            onClick={resetAll}
            variant="outline"
            size="sm"
            className="rounded-full px-6"
          >
            Reset All
          </Button>
        </Card>
      </div>
    </Portal>
  )
}
