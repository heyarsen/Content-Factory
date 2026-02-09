import { openai } from '../lib/openai.js'

interface CaptionInput {
  topic?: string | null
  script?: string | null
}

export async function generateVideoCaption({ topic, script }: CaptionInput): Promise<string> {
  if (!topic && !script) {
    return ''
  }

  const prompt = `Generate a compelling social media caption/description for a short video post.

${topic ? `Topic: ${topic}` : ''}
${script ? `Script: ${script.substring(0, 500)}` : ''}

Requirements:
- Engaging and click-worthy
- Include relevant hashtags (3-5)
- Platform-optimized (works for Instagram, TikTok, YouTube Shorts, etc.)
- 100-200 characters for the main caption
- Include a call-to-action
- Professional but approachable tone

Output ONLY the caption text, nothing else.`

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a social media content writer specializing in video captions for short-form content platforms.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.8,
    max_tokens: 300,
  })

  return completion.choices[0]?.message?.content?.trim() || ''
}
