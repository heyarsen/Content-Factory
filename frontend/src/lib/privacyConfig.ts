const metaEnv = typeof import.meta !== 'undefined' && 'env' in import.meta ? import.meta.env : undefined
const runtimeEnv = typeof process !== 'undefined' ? process.env : undefined

const getEnvValue = (key: string, fallback: string) =>
  (metaEnv && key in metaEnv ? metaEnv[key as keyof typeof metaEnv] : runtimeEnv?.[key]) || fallback

export const PRIVACY_POLICY_VERSION = getEnvValue('VITE_PRIVACY_POLICY_VERSION', '2024-09-01')
export const COOKIE_POLICY_VERSION = getEnvValue('VITE_COOKIE_POLICY_VERSION', '2024-09-01')
export const CONSENT_BANNER_VERSION = getEnvValue('VITE_CONSENT_BANNER_VERSION', '2024-09-01')

export const PRIVACY_CONTACT_EMAIL = getEnvValue('VITE_PRIVACY_CONTACT_EMAIL', 'privacy@company.example')
