import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

export function timeAgo(isoString: string): string {
  const now = new Date()
  const past = new Date(isoString)

  const diffMs = now.getTime() - past.getTime()
  const seconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(diffMs / 60_000)
  const hours = Math.floor(diffMs / 3_600_000)
  const days = Math.floor(diffMs / 86_400_000)

  if (seconds < 60) return `${seconds} second${seconds !== 1 ? "s" : ""} ago`
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`
  return `${days} day${days !== 1 ? "s" : ""} ago`
}

export function plural({
  count,
  noun,
  plural,
}: {
  count: number
  noun: string
  plural?: string
}) {
  const pluralForm = plural ?? `${noun}s`
  return `${count} ${count === 1 ? noun : pluralForm}`
}
