import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ApiError,
  ErrorCode,
  mapHeyGenError,
  createErrorResponse,
} from './apiErrorHandler.js'

describe('ApiError', () => {
  it('creates error with message and code', () => {
    const err = new ApiError('Something failed', ErrorCode.VALIDATION_ERROR, 400)
    assert.equal(err.message, 'Something failed')
    assert.equal(err.code, ErrorCode.VALIDATION_ERROR)
    assert.equal(err.statusCode, 400)
    assert.equal(err.name, 'ApiError')
  })

  it('defaults statusCode to 500', () => {
    const err = new ApiError('Internal error')
    assert.equal(err.statusCode, 500)
  })

  it('toJSON returns structured response with timestamp', () => {
    const err = new ApiError('Test error', ErrorCode.NOT_FOUND, 404)
    const json = err.toJSON()
    assert.equal(json.error, 'Test error')
    assert.equal(json.code, ErrorCode.NOT_FOUND)
    assert.ok(json.timestamp)
    assert.ok(new Date(json.timestamp!).getTime() > 0)
  })

  it('instanceof check works', () => {
    const err = new ApiError('test')
    assert.ok(err instanceof ApiError)
    assert.ok(err instanceof Error)
  })
})

describe('mapHeyGenError', () => {
  it('handles null/undefined input', () => {
    const result = mapHeyGenError(null)
    assert.equal(result.code, ErrorCode.HEYGEN_API_ERROR)
    assert.ok(result.message)
  })

  it('maps insufficient_credit error code', () => {
    const error = {
      response: {
        data: { error: { code: 'insufficient_credit', message: 'Insufficient credit' } },
      },
    }
    const result = mapHeyGenError(error)
    assert.equal(result.code, ErrorCode.INSUFFICIENT_CREDIT)
    assert.ok(result.message.includes('credit'))
  })

  it('maps insufficient credit from message text', () => {
    const error = {
      response: {
        data: { error: 'Insufficient credit balance' },
      },
    }
    const result = mapHeyGenError(error)
    assert.equal(result.code, ErrorCode.INSUFFICIENT_CREDIT)
  })

  it('maps timeout errors', () => {
    const error = { code: 'ETIMEDOUT', message: 'timeout', response: null }
    const result = mapHeyGenError(error)
    assert.equal(result.code, ErrorCode.HEYGEN_API_TIMEOUT)
  })

  it('maps ECONNABORTED to timeout', () => {
    const error = { code: 'ECONNABORTED', message: 'aborted', response: null }
    const result = mapHeyGenError(error)
    assert.equal(result.code, ErrorCode.HEYGEN_API_TIMEOUT)
  })

  it('maps Model not found to training not complete', () => {
    const error = {
      response: {
        data: { error: { message: 'Model not found for this avatar' } },
      },
    }
    const result = mapHeyGenError(error)
    assert.equal(result.code, ErrorCode.TRAINING_NOT_COMPLETE)
  })

  it('returns generic HeyGen error for unknown errors', () => {
    const error = {
      response: {
        data: { error: { message: 'Some unknown HeyGen error' } },
      },
    }
    const result = mapHeyGenError(error)
    assert.equal(result.code, ErrorCode.HEYGEN_API_ERROR)
  })
})

describe('createErrorResponse', () => {
  it('handles ApiError instances', () => {
    const err = new ApiError('Not found', ErrorCode.NOT_FOUND, 404)
    const { statusCode, response } = createErrorResponse(err)
    assert.equal(statusCode, 404)
    assert.equal(response.error, 'Not found')
    assert.equal(response.code, ErrorCode.NOT_FOUND)
  })

  it('handles generic Error instances', () => {
    const err = new Error('Something went wrong')
    const { statusCode, response } = createErrorResponse(err, 'Default message')
    assert.equal(statusCode, 500)
    assert.equal(response.error, 'Something went wrong')
  })

  it('handles string errors', () => {
    const { statusCode, response } = createErrorResponse('string error', 'default')
    assert.equal(statusCode, 500)
    assert.equal(response.error, 'string error')
  })

  it('handles unknown error types with default message', () => {
    const { statusCode, response } = createErrorResponse(42, 'Default message')
    assert.equal(statusCode, 500)
    assert.equal(response.error, 'Default message')
  })

  it('uses provided default status code', () => {
    const { statusCode } = createErrorResponse(new Error('test'), 'default', undefined, 503)
    assert.equal(statusCode, 503)
  })
})
