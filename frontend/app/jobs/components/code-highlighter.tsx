"use client"

import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface CodeHighlighterProps {
  code: string
  filePath: string
}

function getLanguageFromPath(filePath: string): string {
  const extension = filePath.split('.').pop()?.toLowerCase()

  const extensionToLanguage: Record<string, string> = {
    'py': 'python',
    'js': 'javascript',
    'jsx': 'jsx',
    'ts': 'typescript',
    'tsx': 'tsx',
    'json': 'json',
    'yaml': 'yaml',
    'yml': 'yaml',
    'toml': 'toml',
    'rs': 'rust',
    'go': 'go',
    'java': 'java',
    'c': 'c',
    'cpp': 'cpp',
    'cc': 'cpp',
    'cxx': 'cpp',
    'h': 'c',
    'hpp': 'cpp',
    'cs': 'csharp',
    'sh': 'bash',
    'bash': 'bash',
    'zsh': 'bash',
    'fish': 'bash',
    'md': 'markdown',
    'markdown': 'markdown',
    'html': 'html',
    'htm': 'html',
    'css': 'css',
    'scss': 'scss',
    'sass': 'sass',
    'sql': 'sql',
    'xml': 'xml',
    'txt': 'text',
    'lock': 'text',
    'gitignore': 'text',
    'dockerignore': 'text',
    'env': 'bash',
  }

  return extensionToLanguage[extension || ''] || 'text'
}

export function CodeHighlighter({ code, filePath }: CodeHighlighterProps) {
  const language = getLanguageFromPath(filePath)

  return (
    <SyntaxHighlighter
      language={language}
      style={vscDarkPlus}
      customStyle={{
        margin: 0,
        padding: 0,
        background: 'transparent',
        fontSize: '0.75rem',
        lineHeight: '1.5',
      }}
      codeTagProps={{
        style: {
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        }
      }}
      wrapLines={true}
      wrapLongLines={true}
    >
      {code}
    </SyntaxHighlighter>
  )
}
