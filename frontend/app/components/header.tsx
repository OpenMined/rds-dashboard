import { ModeToggle } from "@/components/mode-toggle"
import { OpenMinedLogo } from "@/components/svg/openmined-logo"

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
          </div>
          <div className="flex items-center gap-4">
            <ModeToggle />
          </div>
        </div>
      </div>
    </header>
  )
}
