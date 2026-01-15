import React, { createContext, useContext, useState } from 'react'
import { translations, Language } from '../locales'

interface LanguageContextType {
    language: Language
    setLanguage: (lang: Language) => void
    t: (path: string) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [language, setLanguageState] = useState<Language>(() => {
        const saved = localStorage.getItem('user_language')
        return (saved as Language) || 'en'
    })

    const setLanguage = (lang: Language) => {
        setLanguageState(lang)
        localStorage.setItem('user_language', lang)
    }

    const t = (path: string): string => {
        const keys = path.split('.')
        let current: any = translations[language as keyof typeof translations]

        for (const key of keys) {
            if (current && typeof current === 'object' && key in current) {
                current = current[key]
            } else {
                return path // Fallback to path if key not found
            }
        }

        return typeof current === 'string' ? current : path
    }

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    )
}

export const useLanguage = () => {
    const context = useContext(LanguageContext)
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider')
    }
    return context
}
