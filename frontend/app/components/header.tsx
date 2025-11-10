"use client"

import { ModeToggle } from "@/components/mode-toggle"
import { OpenMinedLogo } from "@/components/svg/openmined-logo"
import { apiService } from "@/lib/api/api"
import type { AccountInfo } from "@/lib/api/types"
import { useEffect, useState } from "react"
import { User, Globe, Shield, ExternalLink } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function Header() {
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchAccountInfo() {
      try {
        const info = await apiService.getAccountInfo()
        setAccountInfo(info)
      } catch (error) {
        console.error("Failed to fetch account information:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchAccountInfo()
  }, [])

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
            {!isLoading && accountInfo && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary text-sm font-medium hover:bg-secondary/80 transition-colors">
                    <User className="h-4 w-4" />
                    <span>{accountInfo.email}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuLabel>Account Information</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span className="flex-1">{accountInfo.email}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="flex items-center gap-2"
                    onSelect={(e: Event) => {
                      e.preventDefault()
                      window.open(accountInfo.host_datasite_url, "_blank")
                    }}
                  >
                    <Globe className="h-4 w-4" />
                    <span className="flex-1">Link to SyftBox datasite</span>
                    <ExternalLink className="h-3 w-3 opacity-50" />
                  </DropdownMenuItem>
                  {accountInfo.is_admin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" />
                        <span>Admin Account</span>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <ModeToggle />
          </div>
        </div>
      </div>
    </header>
  )
}
