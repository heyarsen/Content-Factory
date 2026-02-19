interface SocialConnectionLogPayload {
  platform: string
  connected: boolean
  requestId?: string
}

const isDevelopment = process.env.NODE_ENV === 'development'

export function logSocialConnectionCheck(payload: SocialConnectionLogPayload): void {
  if (!isDevelopment) {
    return
  }

  console.info('[social.connection_check]', {
    platform: payload.platform,
    connected: payload.connected,
    requestId: payload.requestId ?? null,
  })
}
