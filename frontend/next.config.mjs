import { execSync } from "child_process"

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },

  // Use git commit hash as build ID for stable builds
  // Changes when code changes - New commit = new hash = cache busted
  // Rebuilding same code = same hash = no git diff noise
  generateBuildId: async () => {
    try {
      const gitHash = execSync("git rev-parse --short HEAD").toString().trim()
      return gitHash
    } catch (error) {
      // Fallback to timestamp if git is not available
      return "build-" + Date.now()
    }
  },
}

export default nextConfig
