import type { Video } from '../types/database.js'
import { getMaxCharactersForDuration, getMaxWordsForDuration } from './scriptLimits.js'

const DEFAULT_MAX_SECONDS = 15
const MAX_PROMPT_LENGTH = 1000

export function buildSoraVoiceoverPrompt(video: Pick<Video, 'duration' | 'style' | 'topic' | 'script'>): string {
  const maxSeconds = video.duration || DEFAULT_MAX_SECONDS
  const maxWords = getMaxWordsForDuration(maxSeconds)
  const maxCharacters = getMaxCharactersForDuration(maxSeconds)

  let prompt = `
Create a voiceover script.

STRICT RULES:
- Maximum duration: ${maxSeconds} seconds
- Maximum words: ${maxWords}
- Maximum characters (including spaces): ${maxCharacters}
- Do NOT exceed any limit.
- If needed, shorten aggressively.

Style: ${video.style}
Topic: ${video.topic}
`

  if (video.script) {
    prompt += `Base script: ${video.script}\n`
  }

  prompt += `
The voiceover must feel natural at normal speaking speed (150 WPM).
Match video pacing to the voiceover timing.
Avoid fast cuts.
Return ONLY the final voiceover text.
`

  const normalized = prompt.trim()
  if (normalized.length <= MAX_PROMPT_LENGTH) {
    return normalized
  }

  return `${normalized.substring(0, MAX_PROMPT_LENGTH)}...`
}
