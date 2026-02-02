const WORDS_PER_SECOND = 3

const countWords = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length

export const getMaxWordsForDuration = (durationSeconds: number): number => {
  if (!durationSeconds || durationSeconds <= 0) {
    return 0
  }
  return Math.max(10, Math.floor(durationSeconds * WORDS_PER_SECOND))
}

export const enforceScriptWordLimit = (
  script: string,
  durationSeconds: number,
): { script: string; wasTrimmed: boolean; maxWords: number; wordCount: number } => {
  const maxWords = getMaxWordsForDuration(durationSeconds)
  const wordCount = countWords(script)

  if (!maxWords || wordCount <= maxWords) {
    return { script, wasTrimmed: false, maxWords, wordCount }
  }

  const words = script.trim().split(/\s+/).filter(Boolean)
  const trimmedScript = words.slice(0, maxWords).join(' ')

  return {
    script: trimmedScript,
    wasTrimmed: true,
    maxWords,
    wordCount,
  }
}
