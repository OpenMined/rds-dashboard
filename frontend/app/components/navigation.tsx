"use client"

import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu"
import { BriefcaseIcon, DatabaseIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

export function Navigation() {
  const pathname = usePathname()
  return (
    <NavigationMenu>
      <NavigationMenuList className="bg-accent/10 border-border/50 rounded-lg border p-0.5 shadow-2xs">
        <NavigationMenuItem>
          <NavigationMenuLink
            active={pathname === "/datasets"}
            className="gap-3 rounded-md px-4"
            asChild
          >
            <Link href="/datasets">
              <DatabaseIcon /> Datasets
            </Link>
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuLink
          className="gap-3 rounded-md px-4"
          active={pathname === "/jobs"}
          asChild
        >
          <Link href="/jobs">
            <BriefcaseIcon /> Jobs
          </Link>
        </NavigationMenuLink>
      </NavigationMenuList>
    </NavigationMenu>
  )
}
