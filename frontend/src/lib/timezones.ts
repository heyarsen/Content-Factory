// Generate comprehensive timezone list
export function getAllTimezones() {
    try {
        // Use Intl.supportedValuesOf if available (modern browsers)
        if (typeof Intl !== 'undefined' && 'supportedValuesOf' in (Intl as any)) {
            const timezones = (Intl as any).supportedValuesOf('timeZone') as string[]
            return timezones.map((tz: string) => {
                // Format timezone name for display
                const parts = tz.split('/')
                const name = parts[parts.length - 1].replace(/_/g, ' ')
                return {
                    value: tz,
                    label: `${tz} - ${name}`,
                }
            }).sort((a: { value: string; label: string }, b: { value: string; label: string }) => a.label.localeCompare(b.label))
        }
    } catch (e) {
        console.warn('Intl.supportedValuesOf not available, using fallback list')
    }

    // Fallback to common timezones if Intl.supportedValuesOf is not available
    return [
        { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
        { value: 'America/New_York', label: 'America/New_York - Eastern Time' },
        { value: 'America/Chicago', label: 'America/Chicago - Central Time' },
        { value: 'America/Denver', label: 'America/Denver - Mountain Time' },
        { value: 'America/Los_Angeles', label: 'America/Los_Angeles - Pacific Time' },
        { value: 'Europe/London', label: 'Europe/London - London' },
        { value: 'Europe/Paris', label: 'Europe/Paris - Paris' },
        { value: 'Europe/Berlin', label: 'Europe/Berlin - Berlin' },
        { value: 'Asia/Tokyo', label: 'Asia/Tokyo - Tokyo' },
        { value: 'Asia/Shanghai', label: 'Asia/Shanghai - Shanghai' },
        { value: 'Asia/Dubai', label: 'Asia/Dubai - Dubai' },
        { value: 'Australia/Sydney', label: 'Australia/Sydney - Sydney' },
    ]
}

export const timezones = getAllTimezones()

const TIMEZONE_ALIASES: Record<string, string> = {
    'Europe/Kiev': 'Europe/Kyiv',
    'US/Eastern': 'America/New_York',
    'US/Central': 'America/Chicago',
    'US/Mountain': 'America/Denver',
    'US/Pacific': 'America/Los_Angeles',
    'Etc/UTC': 'UTC',
    'Etc/GMT': 'UTC',
}

const timezoneValues = new Set(timezones.map((tz) => tz.value))

export function normalizeTimezone(timezone?: string | null) {
    if (!timezone || typeof timezone !== 'string') {
        return timezoneValues.has('UTC') ? 'UTC' : timezones[0]?.value
    }

    const trimmed = timezone.trim()
    if (timezoneValues.has(trimmed)) {
        return trimmed
    }

    const alias = TIMEZONE_ALIASES[trimmed]
    if (alias && timezoneValues.has(alias)) {
        return alias
    }

    try {
        const resolved = new Intl.DateTimeFormat('en-US', { timeZone: trimmed }).resolvedOptions().timeZone
        if (timezoneValues.has(resolved)) {
            return resolved
        }
    } catch (error) {
        console.warn('Failed to normalize timezone:', error)
    }

    return timezoneValues.has('UTC') ? 'UTC' : timezones[0]?.value
}
