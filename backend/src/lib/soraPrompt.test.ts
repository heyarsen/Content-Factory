import test from 'node:test'
import assert from 'node:assert/strict'

import { buildSoraVideoPrompt } from './soraPrompt.js'

test('buildSoraVideoPrompt creates a video-generation oriented prompt', () => {
  const prompt = buildSoraVideoPrompt({
    duration: 15,
    style: 'Cinematic',
    topic: 'AI productivity',
    script: null,
  })

  assert.match(prompt, /Create a 15-second Cinematic vertical social video about: AI productivity\./)
  assert.match(prompt, /Output must be a visual video scene description, not a screenplay format\./)
  assert.match(prompt, /No subtitles, captions, logos, or watermarks in the rendered video\./)
  assert.doesNotMatch(prompt, /Return ONLY the final voiceover text\./)
})

test('buildSoraVideoPrompt appends narrative guidance when script is provided', () => {
  const prompt = buildSoraVideoPrompt({
    duration: 15,
    style: 'Educational',
    topic: 'Compounding',
    script: 'Start with a simple story.',
  })

  assert.match(prompt, /Narrative guidance \(use this to shape the visual story beats\):/)
  assert.match(prompt, /Start with a simple story\./)
})

test('buildSoraVideoPrompt caps prompt length at 1000 chars plus ellipsis', () => {
  const prompt = buildSoraVideoPrompt({
    duration: 15,
    style: 'Minimal',
    topic: 'Topic',
    script: 'A'.repeat(3000),
  })

  assert.equal(prompt.length, 1003)
  assert.ok(prompt.endsWith('...'))
})
