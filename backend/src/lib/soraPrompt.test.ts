import test from 'node:test'
import assert from 'node:assert/strict'

import { buildSoraVoiceoverPrompt } from './soraPrompt.js'

test('buildSoraVoiceoverPrompt includes strict limits and guidance', () => {
  const prompt = buildSoraVoiceoverPrompt({
    duration: 15,
    style: 'Cinematic',
    topic: 'AI productivity',
    script: null,
  })

  assert.match(prompt, /Create a voiceover script\./)
  assert.match(prompt, /Maximum duration: 15 seconds/)
  assert.match(prompt, /Maximum words: 33/)
  assert.match(prompt, /Maximum characters \(including spaces\): 210/)
  assert.match(prompt, /Style: Cinematic/)
  assert.match(prompt, /Topic: AI productivity/)
  assert.match(prompt, /Return ONLY the final voiceover text\./)
})

test('buildSoraVoiceoverPrompt appends base script when provided', () => {
  const prompt = buildSoraVoiceoverPrompt({
    duration: 15,
    style: 'Educational',
    topic: 'Compounding',
    script: 'Start with a simple story.',
  })

  assert.match(prompt, /Base script: Start with a simple story\./)
})

test('buildSoraVoiceoverPrompt caps prompt length at 1000 chars plus ellipsis', () => {
  const prompt = buildSoraVoiceoverPrompt({
    duration: 15,
    style: 'Minimal',
    topic: 'Topic',
    script: 'A'.repeat(3000),
  })

  assert.equal(prompt.length, 1003)
  assert.ok(prompt.endsWith('...'))
})
