import { supabase } from '../lib/supabase.js'

export type SoraProvider = 'poyo' | 'kie'

const SORA_PROVIDER_KEY = 'sora_provider'
const DEFAULT_SORA_PROVIDER: SoraProvider = 'poyo'

function normalizeSoraProvider(value: unknown): SoraProvider {
  if (value === 'kie' || value === 'poyo') {
    return value
  }
  return DEFAULT_SORA_PROVIDER
}

export async function getSoraProviderSetting(): Promise<SoraProvider> {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', SORA_PROVIDER_KEY)
      .maybeSingle()

    if (error) {
      console.warn('[Settings] Failed to load Sora provider setting:', error)
      return DEFAULT_SORA_PROVIDER
    }

    if (!data?.value) {
      return DEFAULT_SORA_PROVIDER
    }

    return normalizeSoraProvider(data.value)
  } catch (error) {
    console.warn('[Settings] Error reading Sora provider setting:', error)
    return DEFAULT_SORA_PROVIDER
  }
}

export async function setSoraProviderSetting(provider: SoraProvider): Promise<void> {
  const normalized = normalizeSoraProvider(provider)

  const { error } = await supabase
    .from('app_settings')
    .upsert(
      {
        key: SORA_PROVIDER_KEY,
        value: normalized,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    )

  if (error) {
    console.error('[Settings] Failed to update Sora provider setting:', error)
    throw new Error('Failed to update Sora provider setting')
  }
}
