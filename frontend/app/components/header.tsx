import { ModeToggle } from "@/components/mode-toggle"
import { OpenMinedLogo } from "@/components/svg/openmined-logo"
import { OrganicCoopLogo } from "@/components/svg/organic-coop-logo"
import { XIcon } from "lucide-react"

export function Header() {
  return (
    <header className="bg-background/95 supports-backdrop-filter:bg-background/60 border-b backdrop-blur-sm">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <OpenMinedLogo />
              <span className="text-xl font-bold">OpenMined</span>
            </div>
            <XIcon className="text-muted-foreground size-3" />
            <div className="flex items-center gap-2">
              <OrganicCoopLogo />
              <span className="text-primary text-xl font-bold">
                organic.coop
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <ModeToggle />
          </div>
        </div>
      </div>
    </header>
  )
}
