const WORDS_PER_SECOND = 3

export const countWords = (text: string): number =>
  text.trim().split(/\s+/).filter(Boolean).length

export const getMaxWordsForDuration = (durationSeconds: number): number => {
  if (!durationSeconds || durationSeconds <= 0) {
    return 0
  }
  return Math.max(10, Math.floor(durationSeconds * WORDS_PER_SECOND))
}

export const getMaxCharsForDuration = (durationSeconds: number): number => {
  const maxWords = getMaxWordsForDuration(durationSeconds)
  if (!maxWords) {
    return 0
  }
  return maxWords * 6
}
