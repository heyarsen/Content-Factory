import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Button } from '../../ui/Button'
import { Textarea } from '../../ui/Textarea'
import { Avatar } from '../../../types/avatar'

interface GenerateLookPanelProps {
  avatar?: Avatar
  onGenerate: (data: {
    avatar: Avatar
    prompt: string
    pose: 'half_body' | 'full_body' | 'close_up'
    style: 'Realistic' | 'Cartoon' | 'Anime'
  }) => Promise<void>
  generating?: boolean
}

export function GenerateLookPanel({ avatar, onGenerate, generating = false }: GenerateLookPanelProps) {
  const [prompt, setPrompt] = useState('')
  const [pose, setPose] = useState<'half_body' | 'full_body' | 'close_up'>('close_up')
  const [style, setStyle] = useState<'Realistic' | 'Cartoon' | 'Anime'>('Realistic')

  const handleGenerate = async () => {
    if (!avatar) return
    if (!prompt.trim()) return

    await onGenerate({
      avatar,
      prompt: prompt.trim(),
      pose,
      style,
    })
  }

  if (!avatar) {
    return (
      <div className="text-center py-8">
        <p className="text-slate-500">Please select an avatar first</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Generate Look</h3>
        <p className="text-sm text-slate-500">
          Generate a new look for <span className="font-medium">{avatar.avatar_name}</span>
        </p>
      </div>

      {/* Prompt */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Description
        </label>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the look you want to generate... (e.g., professional business attire)"
          rows={4}
          disabled={generating}
        />
      </div>

      {/* Pose */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Pose
        </label>
        <select
          value={pose}
          onChange={(e) => setPose(e.target.value as any)}
          disabled={generating}
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
        >
          <option value="close_up">Close Up</option>
          <option value="half_body">Half Body</option>
          <option value="full_body">Full Body</option>
        </select>
      </div>

      {/* Style */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Style
        </label>
        <select
          value={style}
          onChange={(e) => setStyle(e.target.value as any)}
          disabled={generating}
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
        >
          <option value="Realistic">Realistic</option>
          <option value="Cartoon">Cartoon</option>
          <option value="Anime">Anime</option>
        </select>
      </div>

      {/* Actions */}
      <div className="pt-4 border-t border-slate-200">
        <Button
          onClick={handleGenerate}
          disabled={!prompt.trim() || generating}
          className="w-full"
        >
          <Sparkles className="h-4 w-4 mr-2" />
          {generating ? 'Generating...' : 'Generate Look'}
        </Button>
      </div>
    </div>
  )
}

