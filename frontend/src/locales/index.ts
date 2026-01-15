import { en } from './en'
import { ru } from './ru'
import { uk } from './uk'
import { es } from './es'
import { de } from './de'

export const translations = {
    en,
    ru,
    uk,
    es,
    de,
}

export type Language = keyof typeof translations
export type TranslationKeys = typeof en
