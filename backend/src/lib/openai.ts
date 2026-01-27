import OpenAI from 'openai'
import dotenv from 'dotenv'

dotenv.config()

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export { openai }

export interface ScriptGenerationRequest {
  idea: string
  description?: string
  whyItMatters?: string
  usefulTips?: string
  persona?: string
}

export interface ScriptGenerationResponse {
  script: string
  tokensUsed?: number
}

/**
 * Generate script for a video
 */
export async function generateScript(
  data: ScriptGenerationRequest
): Promise<ScriptGenerationResponse> {
  const systemPrompt = `You are a scriptwriter for short educational videos (12-15 seconds, about 40-45 words). Your task is to create an engaging, specific script with personality.

Input fields you will always receive:
	•	Idea
	•	Description
	•	WhyItMatters
	•	UsefulTips

SCRIPT REQUIREMENTS:
- Between 40-45 words total (fits in 12-15 seconds when spoken naturally)
- Start with a shocking question, surprising fact, or bold statement
- Include 1-2 specific tips or examples (keep it concise)
- Add personality with conversational, energetic tone
- Include at least one surprising element or "wow" factor
- Use simple, punchy sentences - no complex words or long phrases
- End with "Follow for daily tips!"

AVOID:
- Generic phrases like "in today's world" or "it's important to"
- Long explanations or background context
- More than 2 main points (no time)
- Corporate or robotic language
- Complex vocabulary or long sentences
- Timing cues or labels like "Hook:", "Main:", "CTA:" or timestamps

FORMAT: Write as a continuous spoken script without timing cues or labels. Make it sound like you're talking to a friend, not giving a lecture.

EXAMPLE OUTPUT:
"Did you know 80% of traders fail in their first year? Use stop-losses religiously and start with paper trading! It's not sexy but it works. Follow for daily tips!"

Moderation & Safety Criteria (must always be followed):
	•	Neutral tone: avoid hype, exaggeration, or misleading claims.
	•	No guarantees or promises of specific outcomes.
	•	No promotion of specific firms, brands, or platforms by name; describe them generally.
	•	Educational framing only: explain concepts, share insights, but never give direct advice.
	•	Do not target vulnerable groups.
	•	Exclude sensitive or restricted topics (politics, religion, health, sex, violence, illegal activity).
	•	Call-to-action must be generic and safe: only "Follow for daily tips!"`
  
  // Build persona context if provided
  const personaContext = data.persona
    ? `\n\nTarget Audience Context:\n${data.persona}\n\nWhen writing the script, keep this audience in mind and tailor the language, examples, and tone to resonate with them.`
    : ''
  
  // Build comprehensive user prompt that emphasizes using ALL information
  const userPrompt = `Create a script using ALL the following information provided:

Topic/Idea: ${data.idea || '(not provided)'}
Description: ${data.description || '(not provided)'}
Why It Matters: ${data.whyItMatters || '(not provided)'}
Useful Tips: ${data.usefulTips || '(not provided)'}${personaContext}

IMPORTANT: You MUST incorporate information from ALL provided fields (Description, Why It Matters, and Useful Tips) into your script. If a field contains "(not provided)", focus on the fields that have actual content. Do not ignore any field that has actual content. The script should synthesize insights from all available fields to create a comprehensive and informative video script.`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.5,
      max_tokens: 2048,
      response_format: { type: 'text' },
    })

    const script = completion.choices[0]?.message?.content || ''
    const tokensUsed = completion.usage?.total_tokens

    return {
      script: script.trim(),
      tokensUsed,
    }
  } catch (error: any) {
    console.error('OpenAI API error:', error)
    throw new Error(`Failed to generate script: ${error.message}`)
  }
}

