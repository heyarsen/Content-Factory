import axios from 'axios'
import dotenv from 'dotenv'

dotenv.config()

const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions'
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY

if (!PERPLEXITY_API_KEY) {
  console.warn('PERPLEXITY_API_KEY not set - Perplexity features will not work')
}

export interface PromptConfig {
  persona?: string
  business_model?: string
  focus?: string
  categories?: string
  core_message?: string
  rules?: string
  systemPrompt?: string
}

export interface TopicGenerationRequest {
  recentTopics?: Array<{ topic: string; category: string }>
  recentScripts?: Array<{ topic: string; scriptPreview: string }>
  promptConfig?: PromptConfig
}

export interface Topic {
  Idea: string
  Category: 'Trading' | 'Fin. Freedom' | 'Lifestyle'
}

export interface TopicGenerationResponse {
  topics: Topic[]
}

export interface ResearchRequest {
  topic: string
  category: string
  promptConfig?: PromptConfig
}

export interface ResearchResponse {
  idea: string
  description: string
  whyItMatters: string
  usefulTips: string
  category: string
}

/**
 * Retry function with exponential backoff for handling rate limits
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: any

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      lastError = error
      const status = error.response?.status

      // Only retry on 429 (rate limit) or 5xx errors
      if (status === 429 || (status >= 500 && status < 600)) {
        if (attempt < maxRetries - 1) {
          // Calculate delay with exponential backoff
          const delay = initialDelay * Math.pow(2, attempt)
          
          // If 429, try to use retry-after header
          const retryAfter = error.response?.headers?.['retry-after']
          const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : delay
          
          console.log(`Rate limit or server error (${status}), retrying in ${waitTime}ms (attempt ${attempt + 1}/${maxRetries})`)
          await new Promise(resolve => setTimeout(resolve, waitTime))
          continue
        }
      }
      
      // For other errors or last retry, throw immediately
      throw error
    }
  }

  throw lastError || new Error('Max retries exceeded')
}

/**
 * Generate 3 topics using Perplexity AI (Scout-Research Hunter)
 */
export async function generateTopics(
  request: TopicGenerationRequest = {}
): Promise<TopicGenerationResponse> {
  if (!PERPLEXITY_API_KEY) {
    throw new Error('PERPLEXITY_API_KEY is not configured')
  }

  const recentTopicsList = request.recentTopics || []
  const topicsArrayString = JSON.stringify(recentTopicsList)
  const config = request.promptConfig || {}

  // Parse categories from config or use default
  const categoriesList = config.categories 
    ? config.categories.split(',').map(c => c.trim()).filter(Boolean)
    : ['Trading', 'Lifestyle', 'Financial Freedom']
  
  const categoriesString = categoriesList.map(c => `"${c}"`).join(' | ')

  // Build persona section
  const personaSection = config.persona 
    ? `Persona:\n${config.persona.split('\n').map(line => `\t•\t${line.replace(/^-\s*/, '')}`).join('\n')}`
    : `Persona:
	•	Target audience: General content consumers
	•	Interests: Educational and engaging content
	•	Goals: Learn something new or get inspired`

  // Build business model section
  const businessModelSection = config.business_model
    ? `Business-model lens:\n${config.business_model.split('\n').map(line => `\t•\t${line.replace(/^-\s*/, '')}`).join('\n')}`
    : `Business-model lens:
	•	Content creation for educational and informational purposes
	•	Focus on value-driven, authentic content`

  // Build focus section
  const focusSection = config.focus
    ? `Focus:\n${config.focus.split('\n').map(line => `\t•\t${line.replace(/^-\s*/, '')}`).join('\n')}`
    : `Focus:
	•	Create engaging, educational content that provides value
	•	Topics must be fact-checked and framed positively
	•	Avoid clickbait and misleading claims
	•	Never repeat or slightly rephrase any of the last 10 topics provided in the user prompt. Always suggest new and distinct topics. If needed, invent adjacent but different angles.`

  const systemPrompt = config.systemPrompt || `Every day, find ${categoriesList.length} fresh and relevant topics for short videos (Reels/Shorts) that would interest the target persona. Provide topics ONLY as a list in a JSON array (see "Output Format").

${personaSection}

${businessModelSection}

${focusSection}

Output format:
	•	Strictly a JSON array, first line must be [.
	•	Exactly ${categoriesList.length} objects, one for each category: ${categoriesList.join(', ')}.
	•	Each object only with the fields:
"Idea": short topic in English
"Category": ${categoriesString}`

  const recentScriptsList = request.recentScripts || []
  const scriptsArrayString = JSON.stringify(recentScriptsList)

  const userPrompt = `Collect ${categoriesList.length} fresh and relevant topics for today.
Do not repeat or rephrase any of these past topics: ${topicsArrayString}.
Also avoid topics similar to these recent scripts: ${scriptsArrayString}.
Output strictly as a JSON array with objects in the form {"Idea": "...", "Category": "..."}.
Categories and order are fixed: ${categoriesList.join(', ')}.`

  try {
    const response = await retryWithBackoff(async () => {
      return await axios.post(
        PERPLEXITY_API_URL,
        {
          model: 'sonar-pro',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.5,
          web_search_options: {
            search_context_size: 'medium',
          },
        },
        {
          headers: {
            Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      )
    })

    const content = response.data.choices[0]?.message?.content || ''
    
    // Parse JSON from response (may contain markdown or extra text)
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      throw new Error('No JSON array found in Perplexity response')
    }

    const topics = JSON.parse(jsonMatch[0]) as Topic[]

    if (!Array.isArray(topics) || topics.length === 0) {
      throw new Error(`Invalid topics format: expected array with at least one topic`)
    }

    return { topics }
  } catch (error: any) {
    console.error('Perplexity API error:', error.response?.data || error.message)
    const status = error.response?.status
    
    if (status === 429) {
      const retryAfter = error.response?.headers?.['retry-after'] || error.response?.headers?.['x-ratelimit-reset']
      const waitTime = retryAfter ? `Please wait ${retryAfter} seconds` : 'Please wait a few minutes'
      throw new Error(`Rate limit exceeded. ${waitTime} before trying again.`)
    }
    
    // Provide more context for other errors
    const errorMsg = error.response?.data?.error?.message || 
                     error.response?.data?.message || 
                     error.message || 
                     'Unknown error'
    throw new Error(`Failed to generate topics: ${errorMsg}`)
  }
}

/**
 * Research a topic using Perplexity AI (Research Analyst)
 */
export async function researchTopic(
  request: ResearchRequest
): Promise<ResearchResponse> {
  if (!PERPLEXITY_API_KEY) {
    throw new Error('PERPLEXITY_API_KEY is not configured')
  }

  const config = request.promptConfig || {}

  // Build persona section
  const personaSection = config.persona
    ? `Persona:\n${config.persona.split('\n').map(line => `\t•\t${line.replace(/^-\s*/, '')}`).join('\n')}`
    : `Persona:
	•	Target audience: General content consumers
	•	Interests: Educational and engaging content
	•	Goals: Learn something new or get inspired`

  // Build core message section
  const coreMessageSection = config.core_message
    ? `Core message:\n${config.core_message.split('\n').map(line => `\t•\t${line.replace(/^-\s*/, '')}`).join('\n')}`
    : `Core message:
	•	Provide valuable, educational content that helps the audience
	•	Focus on practical insights and actionable information`

  // Parse categories from config or use default
  const categoriesList = config.categories
    ? config.categories.split(',').map(c => c.trim()).filter(Boolean)
    : ['Trading', 'Lifestyle', 'Financial Freedom']
  
  const categoriesString = categoriesList.map(c => `"${c}"`).join(' | ')

  // Build rules section
  const rulesSection = config.rules
    ? config.rules
    : `For each Idea, return only one research object. Do not split into multiple subtopics, countries, or variations. Condense into one structured result.
	•	Style: friendly, simple English.
	•	Focus on benefits and solutions that address the persona's goals and pains.
	•	Always connect the research back to the persona's context and needs.
	•	End with a light invitation or call to action.
	•	Category must always be one of: ${categoriesList.join(', ')}. Never invent new categories.`

  const systemPrompt = `System Prompt – Research Analyst

You are Research Analyst.
Your role: when Research Scout provides a topic (Idea), you must return exactly one structured research object.

${personaSection}

${coreMessageSection}

Output format:
Always return a JSON array with exactly one object in this structure:

[
  {
    "Idea": "...",
    "Description": "...",
    "WhyItMatters": "...",
    "UsefulTips": "...",
    "Category": ${categoriesString}
  }
]

Rules:
	•	${rulesSection.split('\n').join('\n\t•\t')}`

  const userPrompt = `Take the following topics and do research with internet sources:  
${request.topic}, category ${request.category}

Return strictly in JSON array with fields "Idea", "Description", "WhyItMatters", "UsefulTips", "Category".`

  try {
    const response = await retryWithBackoff(async () => {
      return await axios.post(
        PERPLEXITY_API_URL,
        {
          model: 'sonar-pro',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.5,
          web_search_options: {
            search_context_size: 'medium',
          },
        },
        {
          headers: {
            Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      )
    })

    const content = response.data.choices[0]?.message?.content || ''
    
    // Parse JSON from response (may contain markdown or extra text)
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      throw new Error('No JSON array found in Perplexity response')
    }

    const researchArray = JSON.parse(jsonMatch[0]) as ResearchResponse[]
    
    if (!Array.isArray(researchArray) || researchArray.length === 0) {
      throw new Error('Invalid research format: expected array with at least one object')
    }

    return researchArray[0]
  } catch (error: any) {
    console.error('Perplexity API error:', error.response?.data || error.message)
    const status = error.response?.status
    
    if (status === 429) {
      const retryAfter = error.response?.headers?.['retry-after'] || error.response?.headers?.['x-ratelimit-reset']
      const waitTime = retryAfter ? `Please wait ${retryAfter} seconds` : 'Please wait a few minutes'
      throw new Error(`Rate limit exceeded. ${waitTime} before trying again.`)
    }
    
    // Provide more context for other errors
    const errorMsg = error.response?.data?.error?.message || 
                     error.response?.data?.message || 
                     error.message || 
                     'Unknown error'
    throw new Error(`Failed to research topic: ${errorMsg}`)
  }
}

