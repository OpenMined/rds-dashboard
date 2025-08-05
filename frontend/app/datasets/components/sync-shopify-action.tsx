import { Button } from "@/components/ui/button"
import { datasetsApi } from "@/lib/api/datasets"
import type { Dataset } from "@/lib/api/types"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { RefreshCwIcon } from "lucide-react"
import { useRef } from "react"
import { toast } from "sonner"

export function SyncShopifyDatasetAction({ dataset }: { dataset: Dataset }) {
  const queryClient = useQueryClient()
  const iconWrapperRef = useRef<HTMLSpanElement>(null)

  const syncDatasetMutation = useMutation({
    mutationFn: datasetsApi.syncShopifyDataset,
    onSuccess: () => {
      toast.success("Dataset synced successfully")
    },
    onSettled: () => {
      if (iconWrapperRef.current) {
        iconWrapperRef.current.style.animationIterationCount = "1"
      }
      return queryClient.invalidateQueries({ queryKey: ["datasets"] })
    },
  })

  const { isPending } = syncDatasetMutation

  const startAnimation = () => {
    const wrapper = iconWrapperRef.current
    if (!wrapper) return

    wrapper.classList.remove("animate-spin")

    void wrapper.offsetHeight

    wrapper.style.animationIterationCount = "infinite"
    wrapper.classList.add("animate-spin")

    const handleAnimationEnd = () => {
      wrapper.classList.remove("animate-spin")
      wrapper.removeEventListener("animationend", handleAnimationEnd)
    }

    wrapper.addEventListener("animationend", handleAnimationEnd)
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => {
        startAnimation()
        syncDatasetMutation.mutate(dataset.uid)
      }}
      disabled={isPending}
    >
      <span ref={iconWrapperRef} className="inline-flex duration-500">
        <RefreshCwIcon />
      </span>
      Sync
    </Button>
  )
}
