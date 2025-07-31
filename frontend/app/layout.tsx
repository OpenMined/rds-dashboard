import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"
import Providers from "./providers"
import { cn } from "@/lib/utils"
import { Navigation } from "./components/navigation"
import { Header } from "./components/header"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Organic Coop Dashboard",
  description: "Dashboard for managing datasets and jobs",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn(inter.className, "bg-background min-h-screen")}>
        <Providers>
          {/* <Header /> */}
          <div className="container mx-auto px-4 py-8">
            <Navigation />
          </div>
          <main className="container mx-auto px-4 py-8">{children}</main>
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}
