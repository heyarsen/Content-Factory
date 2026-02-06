const WORDS_PER_SECOND = 2.2
const CHARS_PER_SECOND = 14

const countWords = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length
const countCharacters = (text: string): number => text.trim().length

export const getMaxWordsForDuration = (durationSeconds: number): number => {
  if (!durationSeconds || durationSeconds <= 0) {
    return 0
  }
  return Math.max(10, Math.floor(durationSeconds * WORDS_PER_SECOND))
}

export const getMaxCharactersForDuration = (durationSeconds: number): number => {
  if (!durationSeconds || durationSeconds <= 0) {
    return 0
  }
  return Math.max(60, Math.floor(durationSeconds * CHARS_PER_SECOND))
}

export const enforceScriptWordLimit = (
  script: string,
  durationSeconds: number,
): {
  script: string
  wasTrimmed: boolean
  maxWords: number
  wordCount: number
  maxCharacters: number
  characterCount: number
} => {
  const maxWords = getMaxWordsForDuration(durationSeconds)
  const maxCharacters = getMaxCharactersForDuration(durationSeconds)
  const wordCount = countWords(script)
  const characterCount = countCharacters(script)

  if (!maxWords || (!maxCharacters && wordCount <= maxWords)) {
    return { script, wasTrimmed: false, maxWords, wordCount, maxCharacters, characterCount }
  }

  if (wordCount <= maxWords && characterCount <= maxCharacters) {
    return { script, wasTrimmed: false, maxWords, wordCount, maxCharacters, characterCount }
  }

  const words = script.trim().split(/\s+/).filter(Boolean)
  const trimmedWords: string[] = []
  let currentLength = 0

  for (const word of words) {
    const nextLength = trimmedWords.length === 0 ? word.length : currentLength + 1 + word.length
    if (trimmedWords.length + 1 > maxWords || nextLength > maxCharacters) {
      break
    }
    trimmedWords.push(word)
    currentLength = nextLength
  }

  const trimmedScript = trimmedWords.join(' ')

  return {
    script: trimmedScript,
    wasTrimmed: true,
    maxWords,
    wordCount,
    maxCharacters,
    characterCount,
  }
}
