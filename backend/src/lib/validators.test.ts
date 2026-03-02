import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  validateRequired,
  validateStringLength,
  validateBase64Image,
  validateEnum,
  validateOrThrow,
} from './validators.js'
import { ApiError, ErrorCode } from './apiErrorHandler.js'

describe('validateRequired', () => {
  it('returns valid when all required fields are present', () => {
    const result = validateRequired({ name: 'Alice', email: 'alice@example.com' }, ['name', 'email'])
    assert.equal(result.valid, true)
    assert.deepEqual(result.errors, [])
  })

  it('returns invalid when a required field is missing', () => {
    const result = validateRequired({ name: 'Alice' }, ['name', 'email'])
    assert.equal(result.valid, false)
    assert.ok(result.errors.some(e => e.includes('email')))
  })

  it('treats null as missing', () => {
    const result = validateRequired({ name: null }, ['name'])
    assert.equal(result.valid, false)
  })

  it('treats empty string as missing', () => {
    const result = validateRequired({ name: '' }, ['name'])
    assert.equal(result.valid, false)
  })

  it('returns multiple errors for multiple missing fields', () => {
    const result = validateRequired({}, ['a', 'b', 'c'])
    assert.equal(result.errors.length, 3)
  })
})

describe('validateStringLength', () => {
  it('returns valid for string within bounds', () => {
    const result = validateStringLength('hello', 1, 10, 'field')
    assert.equal(result.valid, true)
  })

  it('returns invalid when string is too short', () => {
    const result = validateStringLength('hi', 5, 20, 'field')
    assert.equal(result.valid, false)
    assert.ok(result.errors[0].includes('at least 5'))
  })

  it('returns invalid when string is too long', () => {
    const result = validateStringLength('hello world', 1, 5, 'field')
    assert.equal(result.valid, false)
    assert.ok(result.errors[0].includes('at most 5'))
  })

  it('returns valid for undefined (defers to required validation)', () => {
    const result = validateStringLength(undefined, 1, 10, 'field')
    assert.equal(result.valid, true)
  })

  it('returns invalid for non-string value', () => {
    const result = validateStringLength(123 as any, 1, 10, 'field')
    assert.equal(result.valid, false)
    assert.ok(result.errors[0].includes('must be a string'))
  })
})

describe('validateBase64Image', () => {
  it('returns valid for undefined (defers to required)', () => {
    const result = validateBase64Image(undefined)
    assert.equal(result.valid, true)
  })

  it('returns invalid for non-string', () => {
    const result = validateBase64Image(123 as any)
    assert.equal(result.valid, false)
  })

  it('returns invalid when data URL prefix is missing', () => {
    const result = validateBase64Image('aGVsbG8=')
    assert.equal(result.valid, false)
    assert.ok(result.errors[0].includes('valid base64 image data URL'))
  })

  it('returns invalid for oversized image', () => {
    // Create a base64 string that exceeds 1MB
    const bigBase64 = 'data:image/png;base64,' + 'A'.repeat(1024 * 1024 * 2)
    const result = validateBase64Image(bigBase64, 1)
    assert.equal(result.valid, false)
    assert.ok(result.errors[0].includes('exceeds maximum'))
  })

  it('returns valid for a small valid data URL', () => {
    // 1x1 pixel transparent PNG in base64
    const tiny = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    const result = validateBase64Image(tiny)
    assert.equal(result.valid, true)
  })
})

describe('validateEnum', () => {
  it('returns valid for allowed value', () => {
    const result = validateEnum('active', ['active', 'inactive', 'pending'], 'status')
    assert.equal(result.valid, true)
  })

  it('returns invalid for disallowed value', () => {
    const result = validateEnum('deleted', ['active', 'inactive'], 'status')
    assert.equal(result.valid, false)
    assert.ok(result.errors[0].includes('must be one of'))
  })

  it('returns valid for undefined (defers to required)', () => {
    const result = validateEnum(undefined, ['active', 'inactive'], 'status')
    assert.equal(result.valid, true)
  })

  it('returns valid for null (defers to required)', () => {
    const result = validateEnum(null, ['active', 'inactive'], 'status')
    assert.equal(result.valid, true)
  })
})

describe('validateOrThrow', () => {
  it('does not throw for valid result', () => {
    assert.doesNotThrow(() => validateOrThrow({ valid: true, errors: [] }))
  })

  it('throws ApiError for invalid result', () => {
    assert.throws(
      () => validateOrThrow({ valid: false, errors: ['field is required'] }),
      (err: unknown) => {
        assert.ok(err instanceof ApiError)
        assert.equal(err.statusCode, 400)
        assert.ok(err.message.includes('field is required'))
        return true
      }
    )
  })

  it('uses provided error code', () => {
    assert.throws(
      () => validateOrThrow({ valid: false, errors: ['bad'] }, ErrorCode.VALIDATION_ERROR),
      (err: unknown) => {
        assert.ok(err instanceof ApiError)
        assert.equal(err.code, ErrorCode.VALIDATION_ERROR)
        return true
      }
    )
  })
})
