import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  getHeyGenVoiceId,
  getSoraLocale,
  enhancePromptWithLanguage,
} from './languageDetection.js'

describe('getHeyGenVoiceId', () => {
  it('returns a voice ID for known language', () => {
    const voiceId = getHeyGenVoiceId('english')
    assert.ok(typeof voiceId === 'string')
    assert.ok(voiceId!.length > 0)
  })

  it('falls back to English voice for unknown language', () => {
    const voiceId = getHeyGenVoiceId('klingon')
    const englishVoiceId = getHeyGenVoiceId('english')
    assert.equal(voiceId, englishVoiceId)
  })

  it('returns voice for russian', () => {
    const voiceId = getHeyGenVoiceId('russian')
    assert.ok(voiceId)
  })

  it('returns voice for ukrainian', () => {
    const voiceId = getHeyGenVoiceId('ukrainian')
    assert.ok(voiceId)
  })
})

describe('getSoraLocale', () => {
  it('returns correct locale for english', () => {
    assert.equal(getSoraLocale('english'), 'en')
  })

  it('returns correct locale for spanish', () => {
    assert.equal(getSoraLocale('spanish'), 'es')
  })

  it('returns correct locale for russian', () => {
    assert.equal(getSoraLocale('russian'), 'ru')
  })

  it('returns correct locale for ukrainian', () => {
    assert.equal(getSoraLocale('ukrainian'), 'uk')
  })

  it('returns correct locale for german', () => {
    assert.equal(getSoraLocale('german'), 'de')
  })

  it('returns correct locale for chinese', () => {
    assert.equal(getSoraLocale('chinese'), 'zh')
  })

  it('falls back to english locale for unknown language', () => {
    assert.equal(getSoraLocale('klingon'), 'en')
  })
})

describe('enhancePromptWithLanguage', () => {
  it('appends language instruction to prompt', () => {
    const result = enhancePromptWithLanguage('Tell me about AI', 'spanish')
    assert.ok(result.includes('Tell me about AI'))
    assert.ok(result.includes('Habla en español'))
  })

  it('does not duplicate instruction if already present', () => {
    const prompt = 'Habla en español sobre inteligencia artificial'
    const result = enhancePromptWithLanguage(prompt, 'spanish')
    // Should not add instruction again since it's already there
    assert.equal(result, prompt)
  })

  it('appends Russian instruction', () => {
    const result = enhancePromptWithLanguage('Create a video about cats', 'russian')
    assert.ok(result.includes('Говори на русском'))
  })

  it('appends Ukrainian instruction', () => {
    const result = enhancePromptWithLanguage('Create a video about dogs', 'ukrainian')
    assert.ok(result.includes('Говори українською'))
  })

  it('returns prompt unchanged for unknown language', () => {
    const prompt = 'Hello world'
    const result = enhancePromptWithLanguage(prompt, 'klingon')
    assert.equal(result, prompt)
  })

  it('appends German instruction', () => {
    const result = enhancePromptWithLanguage('Make a video', 'german')
    assert.ok(result.includes('Sprich auf Deutsch'))
  })
})
