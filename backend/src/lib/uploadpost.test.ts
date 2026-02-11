import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildUploadPostDescription, buildUploadPostTitle } from './uploadpost'

describe('buildUploadPostTitle', () => {
  it('uses fallback title when caption is missing', () => {
    assert.equal(buildUploadPostTitle(undefined), 'Video Post')
    assert.equal(buildUploadPostTitle(''), 'Video Post')
  })

  it('returns caption unchanged when within 100 characters', () => {
    const caption = 'A short and valid title'
    assert.equal(buildUploadPostTitle(caption), caption)
  })

  it('truncates long captions to 100 characters with ellipsis', () => {
    const longCaption = 'A'.repeat(199)
    const result = buildUploadPostTitle(longCaption)

    assert.equal(result.length, 100)
    assert.ok(result.endsWith('...'))
    assert.equal(result, `${'A'.repeat(97)}...`)
  })
})

describe('buildUploadPostDescription', () => {
  it('uses the same max-100 normalization as post title', () => {
    const longCaption = 'B'.repeat(150)
    const result = buildUploadPostDescription(longCaption)

    assert.equal(result.length, 100)
    assert.ok(result.endsWith('...'))
    assert.equal(result, `${'B'.repeat(97)}...`)
  })
})
