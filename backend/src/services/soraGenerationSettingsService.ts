import { supabase } from '../lib/supabase.js'
import type { SoraModel, SoraProvider } from '../lib/kie.js'

export type GenerationMode = 'manual' | 'automation'

export interface SoraGenerationSettings {
    enabled: boolean
    manualProvider: SoraProvider
    manualModel: SoraModel
    automationProvider: SoraProvider
    automationModel: SoraModel
}

const defaultSettings: SoraGenerationSettings = {
    enabled: false,
    manualProvider: 'kie',
    manualModel: 'sora-2-stable',
    automationProvider: 'kie',
    automationModel: 'sora-2-stable',
}

function normalizeSettings(raw?: any): SoraGenerationSettings {
    const settings = {
        ...defaultSettings,
        enabled: !!raw?.enabled,
        manualProvider: (raw?.manual_provider || defaultSettings.manualProvider) as SoraProvider,
        manualModel: (raw?.manual_model || defaultSettings.manualModel) as SoraModel,
        automationProvider: (raw?.automation_provider || defaultSettings.automationProvider) as SoraProvider,
        automationModel: (raw?.automation_model || defaultSettings.automationModel) as SoraModel,
    }

    if (settings.manualModel === 'sora-2-private' && settings.manualProvider !== 'poyo') {
        settings.manualModel = 'sora-2'
    }

    if (settings.automationModel === 'sora-2-private' && settings.automationProvider !== 'poyo') {
        settings.automationModel = 'sora-2'
    }

    return settings
}

async function ensureSettingsRow(): Promise<void> {
    const { data, error } = await supabase
        .from('sora_generation_settings')
        .select('id')
        .eq('id', true)
        .maybeSingle()

    if (error) {
        throw new Error(`Failed to load Sora generation settings: ${error.message}`)
    }

    if (!data) {
        const { error: insertError } = await supabase
            .from('sora_generation_settings')
            .insert({
                id: true,
                enabled: defaultSettings.enabled,
                manual_provider: defaultSettings.manualProvider,
                manual_model: defaultSettings.manualModel,
                automation_provider: defaultSettings.automationProvider,
                automation_model: defaultSettings.automationModel,
            })

        if (insertError) {
            throw new Error(`Failed to initialize Sora generation settings: ${insertError.message}`)
        }
    }
}

async function getSettings(): Promise<SoraGenerationSettings> {
    await ensureSettingsRow()

    const { data, error } = await supabase
        .from('sora_generation_settings')
        .select('*')
        .eq('id', true)
        .single()

    if (error) {
        throw new Error(`Failed to fetch Sora generation settings: ${error.message}`)
    }

    return normalizeSettings(data)
}

async function updateSettings(input: SoraGenerationSettings): Promise<SoraGenerationSettings> {
    const normalized = normalizeSettings({
        enabled: input.enabled,
        manual_provider: input.manualProvider,
        manual_model: input.manualModel,
        automation_provider: input.automationProvider,
        automation_model: input.automationModel,
    })

    const { error } = await supabase
        .from('sora_generation_settings')
        .upsert({
            id: true,
            enabled: normalized.enabled,
            manual_provider: normalized.manualProvider,
            manual_model: normalized.manualModel,
            automation_provider: normalized.automationProvider,
            automation_model: normalized.automationModel,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'id' })

    if (error) {
        throw new Error(`Failed to update Sora generation settings: ${error.message}`)
    }

    return normalized
}

async function resolveProviderConfig(mode: GenerationMode): Promise<{ provider: SoraProvider; model: SoraModel }> {
    const settings = await getSettings()
    if (!settings.enabled) {
        return { provider: 'kie', model: 'sora-2-stable' }
    }

    if (mode === 'automation') {
        return {
            provider: settings.automationProvider,
            model: settings.automationModel,
        }
    }

    return {
        provider: settings.manualProvider,
        model: settings.manualModel,
    }
}

export const SoraGenerationSettingsService = {
    getSettings,
    updateSettings,
    resolveProviderConfig,
}
