import type { Video } from '../types/database.js'

const DEFAULT_MAX_SECONDS = 15
const MAX_PROMPT_LENGTH = 1000

export function buildSoraVideoPrompt(video: Pick<Video, 'duration' | 'style' | 'topic' | 'script'>): string {
  const maxSeconds = video.duration || DEFAULT_MAX_SECONDS

  let prompt = `
Create a ${maxSeconds}-second ${video.style || 'professional'} vertical social video about: ${video.topic}.

STRICT RULES:
- Output must be a visual video scene description, not a screenplay format.
- No subtitles, captions, logos, or watermarks in the rendered video.
- Keep pacing natural and coherent for the full ${maxSeconds} seconds.
- Use clean composition, realistic motion, and smooth camera transitions.
- Maintain a polished, high-production social-media style.
- Avoid flicker, jitter, distorted faces/hands, and unreadable text.
`

  if (video.script?.trim()) {
    prompt += `
Narrative guidance (use this to shape the visual story beats):\n${video.script.trim()}\n`
  }

  prompt += `
Deliver one continuous, compelling video aligned with the topic and tone.
`

  const normalized = prompt.trim()
  if (normalized.length <= MAX_PROMPT_LENGTH) {
    return normalized
  }

  return `${normalized.substring(0, MAX_PROMPT_LENGTH)}...`
}
