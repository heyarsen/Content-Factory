import { Globe } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'
import { Language } from '../locales'

interface LanguageSelectorProps {
    className?: string
    showLabel?: boolean
}

const languages: { code: Language; name: string; flag: string }[] = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'ru', name: 'Русский', flag: '🇷🇺' },
    { code: 'uk', name: 'Українська', flag: '🇺🇦' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
]

export function LanguageSelector({ className = '', showLabel = false }: LanguageSelectorProps) {
    const { language, setLanguage, t } = useLanguage()

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            {showLabel && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Globe className="w-4 h-4" />
                    <span>{t('preferences.language')}:</span>
                </div>
            )}
            <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
                {languages.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                        {lang.flag} {lang.name}
                    </option>
                ))}
            </select>
        </div>
    )
}
