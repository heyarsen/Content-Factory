/**
 * Request validation utilities
 */

import { ApiError, ErrorCode } from './apiErrorHandler.js'

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Validate required fields
 */
export function validateRequired(
  data: Record<string, any>,
  fields: string[]
): ValidationResult {
  const errors: string[] = []

  for (const field of fields) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      errors.push(`${field} is required`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Validate string length
 */
export function validateStringLength(
  value: string | undefined,
  min: number,
  max: number,
  fieldName: string
): ValidationResult {
  if (value === undefined || value === null) {
    return { valid: true, errors: [] } // Let required validation handle this
  }

  if (typeof value !== 'string') {
    return {
      valid: false,
      errors: [`${fieldName} must be a string`],
    }
  }

  if (value.length < min) {
    return {
      valid: false,
      errors: [`${fieldName} must be at least ${min} characters`],
    }
  }

  if (value.length > max) {
    return {
      valid: false,
      errors: [`${fieldName} must be at most ${max} characters`],
    }
  }

  return { valid: true, errors: [] }
}

/**
 * Validate base64 image data
 */
export function validateBase64Image(
  data: string | undefined,
  maxSizeMB: number = 10
): ValidationResult {
  if (!data) {
    return { valid: true, errors: [] } // Let required validation handle this
  }

  if (typeof data !== 'string') {
    return {
      valid: false,
      errors: ['photo_data must be a string'],
    }
  }

  // Check if it's a valid data URL
  if (!data.startsWith('data:image/')) {
    return {
      valid: false,
      errors: ['photo_data must be a valid base64 image data URL'],
    }
  }

  // Extract base64 part and calculate size
  const base64Part = data.split(',')[1]
  if (!base64Part) {
    return {
      valid: false,
      errors: ['Invalid base64 image format'],
    }
  }

  // Calculate size in bytes (base64 is ~33% larger than binary)
  const sizeInBytes = (base64Part.length * 3) / 4
  const sizeInMB = sizeInBytes / (1024 * 1024)

  if (sizeInMB > maxSizeMB) {
    return {
      valid: false,
      errors: [`Image size (${sizeInMB.toFixed(2)}MB) exceeds maximum allowed size (${maxSizeMB}MB)`],
    }
  }

  return { valid: true, errors: [] }
}

/**
 * Validate image dimensions (requires decoding base64)
 */
export async function validateImageDimensions(
  base64Data: string,
  minWidth: number = 256,
  minHeight: number = 256,
  maxWidth: number = 4096,
  maxHeight: number = 4096
): Promise<ValidationResult> {
  try {
    // Import sharp dynamically
    const sharp = (await import('sharp')).default

    // Decode base64
    const base64Part = base64Data.split(',')[1]
    if (!base64Part) {
      return {
        valid: false,
        errors: ['Invalid base64 image format'],
      }
    }

    const buffer = Buffer.from(base64Part, 'base64')

    // Get image metadata
    const metadata = await sharp(buffer).metadata()

    if (!metadata.width || !metadata.height) {
      return {
        valid: false,
        errors: ['Could not read image dimensions'],
      }
    }

    const errors: string[] = []

    if (metadata.width < minWidth || metadata.height < minHeight) {
      errors.push(`Image dimensions (${metadata.width}x${metadata.height}) are too small. Minimum: ${minWidth}x${minHeight}`)
    }

    if (metadata.width > maxWidth || metadata.height > maxHeight) {
      errors.push(`Image dimensions (${metadata.width}x${metadata.height}) are too large. Maximum: ${maxWidth}x${maxHeight}`)
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  } catch (error: any) {
    return {
      valid: false,
      errors: [`Failed to validate image: ${error.message}`],
    }
  }
}

/**
 * Validate enum value
 */
export function validateEnum(
  value: any,
  allowedValues: string[],
  fieldName: string
): ValidationResult {
  if (value === undefined || value === null) {
    return { valid: true, errors: [] } // Let required validation handle this
  }

  if (!allowedValues.includes(value)) {
    return {
      valid: false,
      errors: [`${fieldName} must be one of: ${allowedValues.join(', ')}`],
    }
  }

  return { valid: true, errors: [] }
}

/**
 * Validate and throw if invalid
 */
export function validateOrThrow(
  result: ValidationResult,
  code: ErrorCode = ErrorCode.VALIDATION_ERROR
): void {
  if (!result.valid) {
    throw new ApiError(result.errors.join('; '), code, 400)
  }
}

