import crypto from 'crypto'

const TOKEN_KEY_ENV = 'OAUTH_TOKEN_ENCRYPTION_KEY'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

function getEncryptionKey(): Buffer {
  const rawKey = process.env[TOKEN_KEY_ENV]
  if (!rawKey) {
    throw new Error(`Missing ${TOKEN_KEY_ENV} environment variable`)
  }

  const keyBuffer = Buffer.from(rawKey, 'base64')
  if (keyBuffer.length !== 32) {
    throw new Error(`${TOKEN_KEY_ENV} must be a base64-encoded 32-byte key`)
  }

  return keyBuffer
}

export function encryptToken(value: string): string {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return Buffer.concat([iv, authTag, encrypted]).toString('base64')
}

export function decryptToken(payload: string): string {
  const raw = Buffer.from(payload, 'base64')
  const iv = raw.subarray(0, IV_LENGTH)
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const encrypted = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH)
  const key = getEncryptionKey()

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return decrypted.toString('utf8')
}

export function maybeEncryptToken(value?: string | null): string | null {
  if (!value) {
    return null
  }

  return encryptToken(value)
}
