"use client"

interface ColorizedLogsProps {
  content: string
}

interface ColorSegment {
  text: string
  color: string
}

export function ColorizedLogs({ content }: ColorizedLogsProps) {
  const colorizeLine = (line: string): ColorSegment[] => {
    const segments: ColorSegment[] = []
    let remaining = line

    // Define patterns in order of priority
    const patterns = [
      // Timestamps
      { regex: /(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d+)/, color: 'text-cyan-400' },
      // Log levels
      { regex: /\bINFO\b/, color: 'text-green-400' },
      { regex: /\bDEBUG\b/, color: 'text-purple-400' },
      { regex: /\bWARNING\b/, color: 'text-yellow-400' },
      { regex: /\bERROR\b/, color: 'text-red-400' },
      { regex: /\bFATAL\b/, color: 'text-red-600' },
      // Email addresses
      { regex: /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/, color: 'text-blue-300' },
      // File paths
      { regex: /(\/[\w\/\-\.]+)/, color: 'text-blue-400' },
      // Numbers
      { regex: /\b(\d+\.?\d*)\b/, color: 'text-yellow-300' },
      // Special symbols and operators
      { regex: /(\||->|←|→|⚡|🔒|🔓|📁|✓|✗|@)/, color: 'text-gray-500' },
    ]

    while (remaining.length > 0) {
      let matched = false

      for (const pattern of patterns) {
        const match = remaining.match(pattern.regex)
        if (match && match.index === 0) {
          segments.push({ text: match[0], color: pattern.color })
          remaining = remaining.slice(match[0].length)
          matched = true
          break
        }
      }

      if (!matched) {
        // No pattern matched, take one character and continue
        segments.push({ text: remaining[0], color: 'text-slate-50' })
        remaining = remaining.slice(1)
      }
    }

    return segments
  }

  const lines = content.split('\n')

  return (
    <div>
      {lines.map((line, lineIndex) => (
        <div key={lineIndex}>
          {colorizeLine(line).map((segment, segIndex) => (
            <span key={segIndex} className={segment.color}>
              {segment.text}
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}
