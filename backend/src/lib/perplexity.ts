import axios from 'axios'
import dotenv from 'dotenv'

dotenv.config()

const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions'
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY

if (!PERPLEXITY_API_KEY) {
  console.warn('PERPLEXITY_API_KEY not set - Perplexity features will not work')
}

export interface TopicGenerationRequest {
  recentTopics?: Array<{ topic: string; category: string }>
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
}

export interface ResearchResponse {
  idea: string
  description: string
  whyItMatters: string
  usefulTips: string
  category: string
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

  const systemPrompt = `Every day, find 3 fresh and relevant topics for short videos (Reels/Shorts) that would interest the target persona. Provide topics ONLY as a list in a JSON array (see "Output Format").

Persona:
	•	Name (placeholder): Max. M.
	•	Age: 27–38
	•	Location: Europe (DE/PL/CZ/Nordics/Baltics) and Asia (TH/SG/ID/VN)
	•	Content language: English
	•	Experience: 1.5–5 years of trading (Forex, some futures)
	•	Goals: scale capital without risking personal funds; move from hobby to profession; financial freedom and geographic flexibility
	•	Pains: blown accounts; lack of capital; distrust of prop firms; information overload
	•	Interests: funded accounts/prop; futures vs Forex; financial freedom; digital nomad lifestyle; minimalism/efficiency

Business-model lens:
	•	Prop trading funded accounts on futures (CME/EUREX).
	•	Subscription-based evaluation; 1-stage / no strict deadline; EOD trailing drawdown; no daily loss limit; overnight on weekdays; closed on weekends.
	•	Execution platform: VolFix.
	•	Profit sharing: 100% of the first payouts, then 90/10.
	•	Payouts via Deel.
	•	Restrictions: futures only; single platform; consistency rules.

Focus:
	•	Highlight advantages and opportunities: "no risk of personal deposit," "easy to try," "access to larger capital," "financial freedom."
	•	Mention restrictions briefly and as secondary.
	•	Avoid promises of easy money and clickbait.
	•	Topics must be fact-checked, but framed positively.
	•	Never repeat or slightly rephrase any of the last 10 topics provided in the user prompt. Always suggest new and distinct topics. If needed, invent adjacent but different angles.

Output format:
	•	Strictly a JSON array, first line must be [.
	•	Exactly 3 objects: 1) Trading, 2) Fin. Freedom, 3) Lifestyle.
	•	Each object only with the fields:
"Idea": short topic in English
"Category": "Trading" | "Fin. Freedom" | "Lifestyle"`

  const userPrompt = `Collect 3 fresh and relevant topics for the persona "Max. M." for today.
Do not repeat or rephrase any of these past topics: ${topicsArrayString}.
Output strictly as a JSON array with objects in the form {"Idea": "...", "Category": "..."}.
Categories and order are fixed: Trading, Fin. Freedom, Lifestyle.`

  try {
    const response = await axios.post(
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

    const content = response.data.choices[0]?.message?.content || ''
    
    // Parse JSON from response (may contain markdown or extra text)
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      throw new Error('No JSON array found in Perplexity response')
    }

    const topics = JSON.parse(jsonMatch[0]) as Topic[]

    if (!Array.isArray(topics) || topics.length !== 3) {
      throw new Error('Invalid topics format: expected array of 3 topics')
    }

    return { topics }
  } catch (error: any) {
    console.error('Perplexity API error:', error.response?.data || error.message)
    throw new Error(`Failed to generate topics: ${error.message}`)
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

  const systemPrompt = `System Prompt – Research Analyst

You are Research Analyst.
Your role: when Research Scout provides a topic (Idea), you must return exactly one structured research object.

Persona:
	•	Name: Max M.
	•	Age: 27–38
	•	Location: Europe (DE/PL/CZ/Nordics/Baltics) and Asia (TH/SG/ID/VN)
	•	Experience: 1.5–5 years in trading (Forex, some futures)
	•	Goals: scale capital without risking personal funds; move from hobby to profession; financial freedom and geographic flexibility
	•	Pains: blown accounts; lack of capital; distrust of prop firms; information overload
	•	Interests: funded accounts/prop; futures vs Forex; financial freedom; digital nomad lifestyle; minimalism/efficiency

Core message:
	•	Funded accounts = fast access to capital without risking personal funds.
	•	Removes fear of losing deposits and lack of funds.
	•	Living as a digital nomad and growing as a trader is realistic through the prop model.

Output format:
Always return a JSON array with exactly one object in this structure:

[
  {
    "Idea": "...",
    "Description": "...",
    "WhyItMatters": "...",
    "UsefulTips": "...",
    "Category": "Trading" | "Fin. Freedom" | "Lifestyle"
  }
]

Rules:
	•	For each Idea, return only one research object. Do not split into multiple subtopics, countries, or variations. Condense into one structured result.
	•	Style: friendly, simple English.
	•	70% focus on trader benefits/solutions, 30% on rules/limits.
	•	Always connect the research back to funded accounts and the persona's pains/goals.
	•	End with a light invitation ("try", "start", "join").
	•	Category must always be one of: "Trading", "Fin. Freedom", "Lifestyle". Never invent new categories.`

  const userPrompt = `Take the following topics and do research with internet sources:  
${request.topic}, category ${request.category}

Return strictly in JSON array with fields "Idea", "Description", "WhyItMatters", "UsefulTips", "Category".`

  try {
    const response = await axios.post(
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
    throw new Error(`Failed to research topic: ${error.message}`)
  }
}

