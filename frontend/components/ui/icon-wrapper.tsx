"use client"

import { LucideIcon } from "lucide-react"
import { forwardRef } from "react"

interface IconWrapperProps {
  icon: LucideIcon
  className?: string
  size?: number | string
}

export const IconWrapper = forwardRef<SVGSVGElement, IconWrapperProps>(
  ({ icon: Icon, className, size, ...props }, ref) => {
    return <Icon ref={ref} className={className} size={size} {...props} suppressHydrationWarning />
  }
)

IconWrapper.displayName = "IconWrapper"