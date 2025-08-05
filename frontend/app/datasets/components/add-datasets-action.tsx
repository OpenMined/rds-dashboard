import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LaptopIcon, PlusIcon } from "lucide-react"
import { useState } from "react"
import { FaShopify } from "react-icons/fa6"
import { ImportShopifyDatasetModal } from "./import-shopify-dataset-modal"
import { CreateDatasetModal } from "./create-dataset-modal"

export function AddDatasetAction() {
  const [isShopifyModalOpen, setIsShopifyModalOpen] = useState(false)
  const [isLocalModelOpen, setIsLocalModalOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm">
            <PlusIcon />
            Add a Dataset
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            className="cursor-pointer px-3"
            onSelect={() => setIsLocalModalOpen(true)}
          >
            <LaptopIcon className="size-4" />
            Add from a local file
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer px-3"
            onSelect={() => setIsShopifyModalOpen(true)}
          >
            <FaShopify className="size-4" />
            Import from Shopify
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ImportShopifyDatasetModal
        open={isShopifyModalOpen}
        onOpenChange={setIsShopifyModalOpen}
      />

      <CreateDatasetModal
        open={isLocalModelOpen}
        onOpenChange={setIsLocalModalOpen}
        onSuccess={() => setIsLocalModalOpen(false)}
      />
    </>
  )
}
