import { useState } from 'react'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Textarea } from '../components/ui/Textarea'
import { Sparkles, Copy, CheckCircle2 } from 'lucide-react'

type PromptTemplate = {
  id: string
  name: string
  goal: string
  bestFor: string
  prompt: string
}

const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'hook-education',
    name: 'Hook + Education',
    goal: 'Stop the scroll and teach 1 clear concept',
    bestFor: 'Short-form reels, TikTok, YouTube Shorts',
    prompt: `You are a world-class creator writing a short-form educational script.

Write a video script that:
- Starts with a bold hook that calls out the exact audience and problem
- Uses a simple story or example to explain the main idea
- Shares 3 punchy, practical tips
- Ends with a clear call-to-action to follow for more content like this

Constraints:
- Length: 40–60 seconds of spoken video
- Tone: confident, friendly, and direct
- Write in first person, present tense
- Avoid fluff and long intros

Now create the full script.`,
  },
  {
    id: 'product-launch',
    name: 'Product Launch Announcement',
    goal: 'Announce a new feature or product in a clear, exciting way',
    bestFor: 'Launch videos, product updates, feature drops',
    prompt: `You are a product-focused creator announcing a new feature.

Write a video script that:
- Opens with the problem your audience is struggling with
- Clearly announces the new product or feature as the solution
- Shows 2–3 concrete ways it helps (with simple examples)
- Ends with a strong call-to-action to try, sign up, or learn more

Constraints:
- Length: 45–75 seconds of spoken video
- Tone: energetic but not hypey, clear and specific
- Speak directly to "you" (the viewer)

Now write the full script.`,
  },
  {
    id: 'story-lesson',
    name: 'Story + Lesson',
    goal: 'Tell a short story that leads to 1 main lesson',
    bestFor: 'Founder stories, personal brand, LinkedIn-style content',
    prompt: `You are a storyteller teaching through a real, specific moment.

Write a video script that:
- Opens in the middle of the action (no long backstory)
- Describes a specific moment, decision, or mistake
- Shares what you realized or learned
- Ends with 1 clear takeaway the viewer can apply today

Constraints:
- Length: 60–90 seconds of spoken video
- Tone: honest, conversational, and reflective
- Use simple, concrete language and short sentences

Now write the full script.`,
  },
  {
    id: 'list-tips',
    name: 'List of Tips / Playbook',
    goal: 'Deliver a high-value list in a structured way',
    bestFor: 'How‑to videos, playbooks, checklists',
    prompt: `You are an expert sharing a concise playbook.

Write a video script that:
- Opens with a hook like "If you want X, do these Y things"
- Shares 5–7 specific tips or steps in a numbered list
- Gives 1 concrete example or micro-story where it makes sense
- Ends with a recap of the 1–2 most important points

Constraints:
- Length: 60–90 seconds of spoken video
- Tone: clear, actionable, slightly fast‑paced
- Avoid jargon unless you briefly explain it

Now write the full script.`,
  },
]

export function VideoPrompts() {
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleCopy = async (template: PromptTemplate) => {
    try {
      await navigator.clipboard.writeText(template.prompt)
      setCopiedId(template.id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (e) {
      console.error('Failed to copy prompt', e)
    }
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div className="rounded-[28px] border border-white/40 bg-white/80 p-6 sm:p-8 shadow-[0_35px_80px_-50px_rgba(79,70,229,0.6)] backdrop-blur-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-slate-400">
                prompts
              </p>
              <h1 className="mt-3 text-2xl sm:text-3xl font-semibold text-primary">
                Video Prompt Library
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                Use these battle-tested prompt structures to generate stronger video scripts.
                Copy a prompt, tweak it for your niche, then paste it into your script step or
                content tools.
              </p>
            </div>
            <div className="hidden sm:flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-400 text-white shadow-md">
              <Sparkles className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {PROMPT_TEMPLATES.map((template) => (
            <Card key={template.id} className="flex h-full flex-col gap-4 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-semibold text-primary">
                      {template.name}
                    </h2>
                    <Badge variant="info">For videos</Badge>
                  </div>
                  <p className="text-xs text-slate-500">{template.goal}</p>
                  <p className="text-[11px] font-medium text-slate-400">
                    Best for: <span className="text-slate-600">{template.bestFor}</span>
                  </p>
                </div>
              </div>

              <div className="flex-1 space-y-3">
                <Textarea
                  value={template.prompt}
                  readOnly
                  rows={10}
                  className="text-xs sm:text-sm font-mono bg-slate-50/70"
                />
              </div>

              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] text-slate-400">
                  Tip: Copy this into your script or quick create flow, then plug in your niche,
                  audience, and offer.
                </p>
                <div className="flex gap-2 sm:justify-end">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleCopy(template)}
                    leftIcon={
                      copiedId === template.id ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )
                    }
                  >
                    {copiedId === template.id ? 'Copied' : 'Copy prompt'}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  )
}


