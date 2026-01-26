/**
 * Language detection utility for video generation
 * Detects language from user prompt and maps to appropriate voice/language settings
 */

import OpenAI from 'openai'
import dotenv from 'dotenv'

dotenv.config()

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Language detection patterns
const LANGUAGE_PATTERNS = {
  english: [
    /\b(in english|english|speak english|use english)\b/i,
    /\b(please|can you|could you|would you|help me|create|generate|make)\b/i, // Common English request patterns
  ],
  spanish: [
    /\b(en español|español|habla español|usa español)\b/i,
    /\b(por favor|puedes|podrías|ayúdame|crea|genera|haz)\b/i, // Common Spanish request patterns
  ],
  french: [
    /\b(en français|français|parle français|utilise français)\b/i,
    /\b(s'il te plaît|peux-tu|pourrais-tu|aide-moi|crée|génère|fais)\b/i, // Common French request patterns
  ],
  german: [
    /\b(auf deutsch|deutsch|sprich deutsch|benutze deutsch)\b/i,
    /\b(bitte|kannst du|könntest du|hilf mir|erstelle|generiere|mache)\b/i, // Common German request patterns
  ],
  italian: [
    /\b(in italiano|italiano|parla italiano|usa italiano)\b/i,
    /\b(per favore|puoi|potresti|aiutami|crea|genera|fai)\b/i, // Common Italian request patterns
  ],
  portuguese: [
    /\b(em português|português|fala português|usa português)\b/i,
    /\b(por favor|pode|poderia|ajude-me|crie|gere|faça)\b/i, // Common Portuguese request patterns
  ],
  russian: [
    /\b(на русском|русский|говори по-русски|используй русский)\b/i,
    /\b(пожалуйста|можешь|можешь ли|помоги|создай|сгенерируй|сделай)\b/i, // Common Russian request patterns
  ],
  ukrainian: [
    /\b(українською|українська|говори українською|використовуй українську)\b/i,
    /\b(будь ласка|можеш|можеш ти|допоможи|створи|згенеруй|зроби)\b/i, // Common Ukrainian request patterns
  ],
  chinese: [
    /\b(用中文|中文|说中文|使用中文)\b/i,
    /[\u4e00-\u9fff]/, // Chinese characters
  ],
  japanese: [
    /\b(日本語で|日本語|日本語で話して|日本語を使用)\b/i,
    /[\u3040-\u309f\u30a0-\u30ff]/, // Hiragana and Katakana
  ],
  korean: [
    /\b(한국어로|한국어|한국어로 말해|한국어 사용)\b/i,
    /[\uac00-\ud7af]/, // Korean characters
  ],
  arabic: [
    /\b(بالعربية|العربية|تحدث بالعربية|استخدم العربية)\b/i,
    /[\u0600-\u06ff]/, // Arabic characters
  ],
  hindi: [
    /\b(हिंदी में|हिंदी|हिंदी में बोलो|हिंदी का प्रयोग)\b/i,
    /[\u0900-\u097f]/, // Hindi characters
  ],
}

// Language to voice ID mapping for HeyGen
const HEYGEN_VOICE_MAPPING: Record<string, string[]> = {
  english: ['1bd018185b7c4f8d9f0e7b4e1c7e8e6e', '2bd018185b7c4f8d9f0e7b4e1c7e8e6f'], // Example voice IDs
  spanish: ['3bd018185b7c4f8d9f0e7b4e1c7e8e6g', '4bd018185b7c4f8d9f0e7b4e1c7e8e6h'],
  french: ['5bd018185b7c4f8d9f0e7b4e1c7e8e6i', '6bd018185b7c4f8d9f0e7b4e1c7e8e6j'],
  german: ['7bd018185b7c4f8d9f0e7b4e1c7e8e6k', '8bd018185b7c4f8d9f0e7b4e1c7e8e6l'],
  italian: ['9bd018185b7c4f8d9f0e7b4e1c7e8e6m', '0bd018185b7c4f8d9f0e7b4e1c7e8e6n'],
  portuguese: ['1cd018185b7c4f8d9f0e7b4e1c7e8e6o', '2cd018185b7c4f8d9f0e7b4e1c7e8e6p'],
  russian: ['3cd018185b7c4f8d9f0e7b4e1c7e8e6q', '4cd018185b7c4f8d9f0e7b4e1c7e8e6r'],
  ukrainian: ['5cd018185b7c4f8d9f0e7b4e1c7e8e6s', '6cd018185b7c4f8d9f0e7b4e1c7e8e6t'],
  chinese: ['7cd018185b7c4f8d9f0e7b4e1c7e8e6u', '8cd018185b7c4f8d9f0e7b4e1c7e8e6v'],
  japanese: ['9cd018185b7c4f8d9f0e7b4e1c7e8e6w', '0cd018185b7c4f8d9f0e7b4e1c7e8e6x'],
  korean: ['1dd018185b7c4f8d9f0e7b4e1c7e8e6y', '2dd018185b7c4f8d9f0e7b4e1c7e8e6z'],
  arabic: ['3dd018185b7c4f8d9f0e7b4e1c7e8e6aa', '4dd018185b7c4f8d9f0e7b4e1c7e8e6ab'],
  hindi: ['5dd018185b7c4f8d9f0e7b4e1c7e8e6ac', '6dd018185b7c4f8d9f0e7b4e1c7e8e6ad'],
}

// Language to locale mapping for Sora/KIE
const SORA_LANGUAGE_MAPPING: Record<string, string> = {
  english: 'en',
  spanish: 'es',
  french: 'fr',
  german: 'de',
  italian: 'it',
  portuguese: 'pt',
  russian: 'ru',
  ukrainian: 'uk',
  chinese: 'zh',
  japanese: 'ja',
  korean: 'ko',
  arabic: 'ar',
  hindi: 'hi',
}

/**
 * Use ChatGPT to detect language from text
 */
async function detectLanguageWithChatGPT(text: string): Promise<{ language: string; confidence: number }> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `You are a language detection expert. Detect the primary language of the given text and respond with only the language name in lowercase (e.g., "english", "spanish", "french", "german", "italian", "portuguese", "russian", "ukrainian", "chinese", "japanese", "korean", "arabic", "hindi"). If you're unsure, respond with "english".`
        },
        {
          role: 'user',
          content: text
        }
      ],
      max_tokens: 10,
      temperature: 0,
    })

    const detectedLanguage = response.choices[0]?.message?.content?.trim().toLowerCase()
    
    // Validate that the detected language is supported
    const supportedLanguages = Object.keys(LANGUAGE_PATTERNS)
    if (detectedLanguage && supportedLanguages.includes(detectedLanguage)) {
      return {
        language: detectedLanguage,
        confidence: 0.9 // High confidence for ChatGPT detection
      }
    }
    
    return { language: 'english', confidence: 0.5 }
  } catch (error) {
    console.error('ChatGPT language detection failed:', error)
    return { language: 'english', confidence: 0.5 }
  }
}

export type DetectedLanguage = {
  language: string
  confidence: number
  voiceId?: string
  locale?: string
}

/**
 * Detect language from text prompt
 */
export async function detectLanguage(text: string): Promise<DetectedLanguage> {
  // First, try ChatGPT for more accurate detection
  const chatGPTResult = await detectLanguageWithChatGPT(text)
  
  // Also run pattern-based detection as fallback and for comparison
  const detectedLanguages: Array<{ language: string; confidence: number }> = []

  // Check each language pattern
  for (const [language, patterns] of Object.entries(LANGUAGE_PATTERNS)) {
    let confidence = 0
    let matches = 0

    for (const pattern of patterns) {
      if (pattern.test(text)) {
        matches++
        // For explicit language requests, give higher confidence
        if (pattern.toString().includes('in english') || 
            pattern.toString().includes('en español') ||
            pattern.toString().includes('en français') ||
            pattern.toString().includes('auf deutsch') ||
            pattern.toString().includes('українською')) {
          confidence += 0.8
        } else if (pattern.toString().includes('[\\u')) {
          // Character-based detection (Chinese, Japanese, etc.)
          confidence += 0.9
        } else {
          // Common request patterns
          confidence += 0.4
        }
      }
    }

    if (matches > 0) {
      detectedLanguages.push({
        language,
        confidence: confidence / patterns.length,
      })
    }
  }

  // Sort by confidence
  detectedLanguages.sort((a, b) => b.confidence - a.confidence)

  let bestMatch: { language: string; confidence: number }
  
  // Use ChatGPT result if it has higher confidence than pattern detection
  if (chatGPTResult.confidence > (detectedLanguages[0]?.confidence || 0)) {
    bestMatch = chatGPTResult
  } else if (detectedLanguages.length > 0) {
    bestMatch = detectedLanguages[0]
  } else {
    // Default to English if no language detected
    bestMatch = { language: 'english', confidence: 0.5 }
  }
  
  return {
    ...bestMatch,
    voiceId: HEYGEN_VOICE_MAPPING[bestMatch.language]?.[0],
    locale: SORA_LANGUAGE_MAPPING[bestMatch.language],
  }
}

/**
 * Get voice ID for HeyGen based on detected language
 */
export function getHeyGenVoiceId(language: string, gender: 'male' | 'female' = 'female'): string | undefined {
  const voices = HEYGEN_VOICE_MAPPING[language]
  if (!voices || voices.length === 0) {
    return HEYGEN_VOICE_MAPPING.english?.[0] // Fallback to English
  }

  // For now, return the first voice. In a real implementation, you might want to
  // select based on gender preference or other criteria
  return voices[0]
}

/**
 * Get locale for Sora/KIE based on detected language
 */
export function getSoraLocale(language: string): string {
  return SORA_LANGUAGE_MAPPING[language] || SORA_LANGUAGE_MAPPING.english
}

/**
 * Enhance prompt with language instruction if not already present
 */
export function enhancePromptWithLanguage(prompt: string, language: string): string {
  const languageInstructions = {
    english: 'Speak in English',
    spanish: 'Habla en español',
    french: 'Parle en français',
    german: 'Sprich auf Deutsch',
    italian: 'Parla in italiano',
    portuguese: 'Fale em português',
    russian: 'Говори на русском',
    ukrainian: 'Говори українською',
    chinese: '用中文说话',
    japanese: '日本語で話してください',
    korean: '한국어로 말하세요',
    arabic: 'تحدث باللغة العربية',
    hindi: 'हिंदी में बोलो',
  }

  const instruction = languageInstructions[language as keyof typeof languageInstructions]
  if (!instruction) return prompt

  // Check if language instruction is already present
  const hasLanguageInstruction = LANGUAGE_PATTERNS[language as keyof typeof LANGUAGE_PATTERNS]?.some(
    pattern => pattern.test(prompt)
  )

  if (hasLanguageInstruction) {
    return prompt
  }

  return `${prompt}. ${instruction}.`
}
