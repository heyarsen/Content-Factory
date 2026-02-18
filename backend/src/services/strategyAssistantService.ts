import { openai } from '../lib/openai.js'

export type Platform = 'x' | 'linkedin' | 'instagram'
export type ToneOption = 'professional' | 'conversational' | 'bold' | 'playful'

export interface StrategyGuideInput {
  goals: string
  audience: string
  offer: string
  concept: string
  draftContent: string
  callToAction: string
  platform: Platform
  tone: ToneOption
  targetMonth: string
  engagement: {
    impressions: number
    likes: number
    comments: number
    shares: number
    saves: number
    clicks: number
  }
}

export interface StrategyGuideResult {
  campaignBrief: {
    summary: string
    objective: string
    audienceInsight: string
    offerAngle: string
    keyMessage: string
  }
  contentPillars: string[]
  monthlyPlan: Array<{ week: string; focus: string; contentType: string; cta: string }>
  repurposing: {
    x: string
    linkedin: string
    instagram: string
  }
  discovery: {
    hashtags: string[]
    keywords: string[]
    toneNotes: Record<Platform, string>
  }
  qualityChecks: {
    hookStrength: { score: number; reason: string }
    ctaClarity: { score: number; reason: string }
    lengthFit: { score: number; reason: string; recommendedRange: string }
    policyRisks: string[]
  }
  postPublishRecommendations: string[]
}

const PLATFORM_LENGTH_GUIDE: Record<Platform, { ideal: number; max: number; recommendedRange: string }> = {
  x: { ideal: 220, max: 280, recommendedRange: '160-250 characters' },
  linkedin: { ideal: 900, max: 3000, recommendedRange: '500-1,200 characters' },
  instagram: { ideal: 1200, max: 2200, recommendedRange: '900-1,600 characters' },
}

function sentence(input: string, fallback: string) {
  const normalized = input.trim()
  return normalized.length > 0 ? normalized : fallback
}

function scoreHook(draft: string) {
  const strongPatterns = ['how', 'why', '?', 'mistake', 'secret', 'stop', 'before you']
  const draftLower = draft.toLowerCase()
  const matches = strongPatterns.filter((pattern) => draftLower.includes(pattern)).length
  const score = Math.min(10, 4 + matches * 2)

  if (score >= 8) return { score, reason: 'The opening uses curiosity-driven language and likely creates scroll-stopping tension.' }
  if (score >= 6) return { score, reason: 'The opening is clear but can be stronger with a sharper contrast, question, or bold claim.' }
  return { score, reason: 'The opening is descriptive but lacks a strong hook; add tension, urgency, or a surprising fact.' }
}

function scoreCta(callToAction: string) {
  const normalized = callToAction.trim()
  if (!normalized) {
    return { score: 2, reason: 'No explicit CTA detected. Add a direct next step like comment, click, or DM.' }
  }

  const actionVerbs = ['comment', 'download', 'book', 'dm', 'message', 'click', 'signup', 'share', 'follow']
  const hasActionVerb = actionVerbs.some((verb) => normalized.toLowerCase().includes(verb))

  if (hasActionVerb && normalized.length < 90) {
    return { score: 9, reason: 'CTA is concise, action-oriented, and easy to follow.' }
  }

  if (hasActionVerb) {
    return { score: 7, reason: 'CTA has action language but can be shorter and more specific.' }
  }

  return { score: 5, reason: 'CTA exists but lacks a strong action verb and measurable direction.' }
}

function scoreLengthFit(platform: Platform, draft: string) {
  const guide = PLATFORM_LENGTH_GUIDE[platform]
  const length = draft.trim().length

  if (!length) {
    return { score: 1, reason: 'No draft content provided for length analysis.', recommendedRange: guide.recommendedRange }
  }

  if (length <= guide.max && length >= Math.floor(guide.ideal * 0.5)) {
    return {
      score: 9,
      reason: `Draft length (${length}) is well aligned for ${platform.toUpperCase()}.`,
      recommendedRange: guide.recommendedRange,
    }
  }

  if (length > guide.max) {
    return {
      score: 3,
      reason: `Draft is too long for ${platform.toUpperCase()} by ${length - guide.max} characters.`,
      recommendedRange: guide.recommendedRange,
    }
  }

  return {
    score: 5,
    reason: `Draft is short for ${platform.toUpperCase()}; consider expanding context or examples.`,
    recommendedRange: guide.recommendedRange,
  }
}

function findPolicyRisks(draft: string, offer: string) {
  const risks: string[] = []
  const combined = `${draft} ${offer}`.toLowerCase()

  if (/(guaranteed|risk-free|100%|no risk|overnight success)/.test(combined)) {
    risks.push('Potential misleading promise detected (e.g., guaranteed or risk-free outcomes).')
  }
  if (/(before and after|cure|diagnose|treatment)/.test(combined)) {
    risks.push('Potential regulated/health claim detected; validate compliance requirements.')
  }
  if (/(free money|double your|instant income)/.test(combined)) {
    risks.push('Potential financial exaggeration detected; rewrite to educational framing.')
  }

  if (risks.length === 0) {
    risks.push('No critical policy red flags detected. Perform final legal/compliance review before publishing.')
  }

  return risks
}

function deriveEngagementRecommendations(input: StrategyGuideInput) {
  const { impressions, likes, comments, shares, saves, clicks } = input.engagement
  const safeImpressions = impressions > 0 ? impressions : 1
  const engagementRate = ((likes + comments + shares + saves) / safeImpressions) * 100
  const clickRate = (clicks / safeImpressions) * 100
  const recommendations: string[] = []

  if (engagementRate < 2) {
    recommendations.push('Low engagement signal: test a stronger first-line hook and publish 2 alternative creatives in the next 48 hours.')
  } else {
    recommendations.push('Healthy engagement signal: repurpose the same angle into a follow-up series while momentum is high.')
  }

  if (comments < Math.max(5, likes * 0.08)) {
    recommendations.push('Comment depth is limited: end posts with a binary question to stimulate discussion and social proof.')
  }

  if (saves > likes * 0.4) {
    recommendations.push('Saves are strong: convert this topic into a carousel/checklist lead magnet and pin it.')
  }

  if (clickRate < 0.8) {
    recommendations.push('CTR is weak: tighten CTA copy and move the offer value proposition above the fold.')
  } else {
    recommendations.push('CTR is healthy: keep CTA structure and test urgency variants to improve conversion quality.')
  }

  return recommendations
}

function buildFallbackResult(input: StrategyGuideInput): StrategyGuideResult {
  const campaignBrief = {
    summary: `Campaign focused on ${sentence(input.goals, 'growth')} for ${sentence(input.audience, 'a defined audience')} with an offer centered on ${sentence(input.offer, 'clear customer value')}.`,
    objective: sentence(input.goals, 'Drive measurable awareness and qualified engagement.'),
    audienceInsight: sentence(input.audience, 'Audience seeks practical, low-friction actions and proof of outcomes.'),
    offerAngle: sentence(input.offer, 'Position the offer as a concrete shortcut with clear next steps.'),
    keyMessage: `Use the concept "${sentence(input.concept, 'core concept')}" to connect pain points to outcomes with evidence-led storytelling.`,
  }

  const contentPillars = [
    'Education: explain the core problem and strategic context.',
    'Proof: showcase outcomes, testimonials, and concrete examples.',
    'Conversion: objection handling, offer walkthroughs, and CTA content.',
  ]

  const monthlyPlan = [
    { week: 'Week 1', focus: 'Problem awareness', contentType: 'Myth-busting short posts', cta: 'Comment your current challenge' },
    { week: 'Week 2', focus: 'Solution education', contentType: 'Framework/carousel explainers', cta: 'Save this framework' },
    { week: 'Week 3', focus: 'Trust and proof', contentType: 'Case studies and behind-the-scenes', cta: 'DM for full breakdown' },
    { week: 'Week 4', focus: 'Offer conversion', contentType: 'FAQ + objection handling', cta: 'Book a call / click link' },
  ]

  const repurposing = {
    x: `Hot take: ${sentence(input.concept, 'this strategy')} is underused. Most teams focus on outputs, not outcomes. Try this this week and reply with your result.`,
    linkedin: `Most teams miss growth because their content is disconnected from business goals.\n\nUse this concept: ${sentence(input.concept, 'goal-offer alignment')}.\n\n1) Start with audience pain\n2) Connect to your offer with proof\n3) End with a focused CTA\n\nWhat would you add to this framework?`,
    instagram: `If your content feels busy but not converting, simplify around one idea: ${sentence(input.concept, 'a single strategic concept')}.\n\n✅ Hook with pain\n✅ Teach one shift\n✅ Close with one CTA\n\nSave this for your next content sprint.`,
  }

  return {
    campaignBrief,
    contentPillars,
    monthlyPlan,
    repurposing,
    discovery: {
      hashtags: ['#contentstrategy', '#digitalmarketing', '#socialmediatips', '#creatorgrowth', '#brandbuilding'],
      keywords: ['campaign brief', 'content pillars', 'social repurposing', 'post optimization', 'engagement strategy'],
      toneNotes: {
        x: 'Use concise, opinionated, high-contrast phrasing with one clear takeaway.',
        linkedin: 'Use authority-led educational tone with examples and practical frameworks.',
        instagram: 'Use conversational language, visual cues, and save-worthy checklist formatting.',
      },
    },
    qualityChecks: {
      hookStrength: scoreHook(input.draftContent),
      ctaClarity: scoreCta(input.callToAction),
      lengthFit: scoreLengthFit(input.platform, input.draftContent),
      policyRisks: findPolicyRisks(input.draftContent, input.offer),
    },
    postPublishRecommendations: deriveEngagementRecommendations(input),
  }
}

export async function generateStrategyGuide(input: StrategyGuideInput): Promise<StrategyGuideResult> {
  const fallback = buildFallbackResult(input)

  if (!process.env.OPENAI_API_KEY) {
    return fallback
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.6,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are a senior social strategist. Return valid JSON only with fields: campaignBrief, contentPillars, monthlyPlan, repurposing, discovery. Keep responses practical and concise.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            goals: input.goals,
            audience: input.audience,
            offer: input.offer,
            concept: input.concept,
            tone: input.tone,
            platform: input.platform,
          }),
        },
      ],
    })

    const parsed = JSON.parse(completion.choices[0]?.message?.content || '{}')

    return {
      ...fallback,
      campaignBrief: parsed.campaignBrief || fallback.campaignBrief,
      contentPillars: parsed.contentPillars || fallback.contentPillars,
      monthlyPlan: parsed.monthlyPlan || fallback.monthlyPlan,
      repurposing: parsed.repurposing || fallback.repurposing,
      discovery: parsed.discovery || fallback.discovery,
    }
  } catch (error) {
    console.error('Strategy assistant AI generation failed, using fallback:', error)
    return fallback
  }
}
