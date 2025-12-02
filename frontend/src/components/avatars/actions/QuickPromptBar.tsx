import { useState } from 'react'
import { Sparkles, Send } from 'lucide-react'
import { Button } from '../../ui/Button'

interface QuickPromptBarProps {
  onGenerate: (prompt: string) => void
  generating?: boolean
  avatarName?: string
}

export function QuickPromptBar({ onGenerate, generating = false, avatarName }: QuickPromptBarProps) {
  const [prompt, setPrompt] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (prompt.trim() && !generating) {
      onGenerate(prompt.trim())
      setPrompt('')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6">
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2">
          <Sparkles className="h-5 w-5 text-slate-400" />
        </div>
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={avatarName 
            ? `Generate a look for ${avatarName}... (e.g., "professional business attire")`
            : 'Enter a prompt to generate a look...'
          }
          disabled={generating}
          className="w-full pl-12 pr-24 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <Button
          type="submit"
          disabled={!prompt.trim() || generating}
          size="sm"
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white border-0 shadow-md hover:shadow-lg transition-all"
        >
          {generating ? (
            <>
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate
            </>
          )}
        </Button>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Quick generate with AI. Describe the look you want to create.
      </p>
    </form>
  )
}

