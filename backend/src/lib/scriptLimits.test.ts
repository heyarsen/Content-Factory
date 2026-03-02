import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  getMaxWordsForDuration,
  getMaxCharactersForDuration,
  enforceScriptWordLimit,
} from './scriptLimits.js'

describe('getMaxWordsForDuration', () => {
  it('returns 0 for zero duration', () => {
    assert.equal(getMaxWordsForDuration(0), 0)
  })

  it('returns 0 for negative duration', () => {
    assert.equal(getMaxWordsForDuration(-5), 0)
  })

  it('returns at least 10 words for very short duration', () => {
    // 1 second * 2.2 = 2.2 → floor = 2, but minimum is 10
    assert.equal(getMaxWordsForDuration(1), 10)
  })

  it('calculates correctly for 60 seconds', () => {
    // 60 * 2.2 = 132
    assert.equal(getMaxWordsForDuration(60), 132)
  })

  it('calculates correctly for 30 seconds', () => {
    // 30 * 2.2 = 66
    assert.equal(getMaxWordsForDuration(30), 66)
  })
})

describe('getMaxCharactersForDuration', () => {
  it('returns 0 for zero duration', () => {
    assert.equal(getMaxCharactersForDuration(0), 0)
  })

  it('returns 0 for negative duration', () => {
    assert.equal(getMaxCharactersForDuration(-1), 0)
  })

  it('returns at least 60 characters for very short duration', () => {
    // 1 * 14 = 14, but minimum is 60
    assert.equal(getMaxCharactersForDuration(1), 60)
  })

  it('calculates correctly for 60 seconds', () => {
    // 60 * 14 = 840
    assert.equal(getMaxCharactersForDuration(60), 840)
  })
})

describe('enforceScriptWordLimit', () => {
  it('does not trim script within limits', () => {
    const script = 'Hello world this is a test'
    const result = enforceScriptWordLimit(script, 60)
    assert.equal(result.wasTrimmed, false)
    assert.equal(result.script, script)
    assert.equal(result.wordCount, 6)
  })

  it('trims script that exceeds word limit', () => {
    // 5 seconds → max 11 words (5 * 2.2 = 11)
    const words = Array.from({ length: 20 }, (_, i) => `word${i}`)
    const script = words.join(' ')
    const result = enforceScriptWordLimit(script, 5)
    assert.equal(result.wasTrimmed, true)
    assert.ok(result.script.split(' ').length <= result.maxWords)
  })

  it('trims script that exceeds character limit', () => {
    // 5 seconds → max 70 chars (5 * 14 = 70)
    // Create a script with few long words that exceed char limit
    const script = 'abcdefghijklmnopqrstuvwxyz abcdefghijklmnopqrstuvwxyz abcdefghijklmnopqrstuvwxyz'
    const result = enforceScriptWordLimit(script, 5)
    assert.equal(result.wasTrimmed, true)
    assert.ok(result.script.length <= result.maxCharacters)
  })

  it('returns correct metadata', () => {
    const script = 'one two three'
    const result = enforceScriptWordLimit(script, 60)
    assert.equal(result.wordCount, 3)
    assert.equal(result.maxWords, 132)
    assert.equal(result.maxCharacters, 840)
    assert.equal(result.characterCount, script.trim().length)
  })

  it('handles empty string', () => {
    const result = enforceScriptWordLimit('', 60)
    assert.equal(result.wasTrimmed, false)
    assert.equal(result.wordCount, 0)
  })

  it('handles zero duration', () => {
    const result = enforceScriptWordLimit('some text here', 0)
    assert.equal(result.wasTrimmed, false)
    assert.equal(result.maxWords, 0)
  })
})
