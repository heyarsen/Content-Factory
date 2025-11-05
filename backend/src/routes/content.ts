import { Router, Response } from 'express'
import { supabase } from '../lib/supabase.js'
import { authenticate, AuthRequest } from '../middleware/auth.js'

const router = Router()

type CategorySeed = {
  category_key: string
  name: string
  status: 'active' | 'inactive'
  description: string
  sort_order: number
}

type PromptSeed = {
  template_key: string
  template_type: 'ideas' | 'research' | 'script'
  status: 'active' | 'inactive'
  lang: string
  persona: string
  config: Record<string, string>
}

const DEFAULT_CATEGORIES: CategorySeed[] = [
  {
    category_key: 'trading',
    name: 'Trading',
    status: 'active',
    description:
      'Educational content about trading with a focus on discipline, risk awareness, and understanding how markets work. Explains how traders grow professionally by using safe models like funded accounts instead of risking personal money. No direct trade advice or income promises. The goal is to build critical thinking, emotional control, and responsible use of trading tools. Always neutral, educational, and transparent in tone.',
    sort_order: 1,
  },
  {
    category_key: 'lifestyle',
    name: 'Lifestyle',
    status: 'active',
    description:
      'Stories about life beyond the office: balance, daily habits, productivity, and emotional clarity. Shows how minimalism, travel, and flexible work can support focus and well-being. Practical rather than flashy - grounded, human perspectives on freedom, self-care, and modern efficiency. The tone stays inspiring but realistic, avoiding any exaggeration or lifestyle hype.',
    sort_order: 2,
  },
  {
    category_key: 'financial_freedom',
    name: 'Financial Freedom',
    status: 'active',
    description:
      'Stories about money discipline, smart risk management, and long-term independence. Focus on sustainable growth, ethical decision-making, and how funded models reduce personal risk. Encourages realistic planning and highlights practical steps toward financial autonomy without hype.',
    sort_order: 3,
  },
]

const DEFAULT_PROMPTS: PromptSeed[] = [
  {
    template_key: 'ideas_daily_v1',
    template_type: 'ideas',
    status: 'active',
    lang: 'english',
    persona:
      '- Name: Max M.\n- Age: 27-38\n- Location: Europe (DE/PL/CZ/Nordics/Baltics) and Asia (TH/SG/ID/VN)\n- Experience: 1.5-5 years of trading (Forex, some futures)\n- Goals: scale capital without risking personal funds; move from hobby to profession; financial freedom and geographic flexibility\n- Pains: blown accounts; lack of capital; distrust of prop firms; information overload\n- Interests: funded accounts/prop; futures vs Forex; financial freedom; digital nomad lifestyle; minimalism/efficiency',
    config: {
      business_model:
        '- Prop trading funded accounts on futures (CME/EUREX).\n- Subscription-based evaluation with one stage and no strict deadline.\n- End-of-day trailing drawdown; no daily loss limit.\n- Overnight trading allowed on weekdays; closed on weekends.\n- Execution platform: VolFix.\n- Profit sharing: 100% of the first payouts, then 90/10.\n- Payouts via Deel.\n- Restrictions: futures only; single platform; consistency rules.',
      focus:
        'Highlight advantages and opportunities: no risk of personal deposit, easy to try, access to larger capital, and financial freedom. Mention restrictions briefly and as secondary. Avoid promises of easy money or clickbait. Topics must be fact-checked, but framed positively. Never repeat or slightly rephrase any of the last 10 topics provided in the user prompt. Always suggest new and distinct angles.',
      categories: 'Trading, Lifestyle, Financial Freedom',
    },
  },
  {
    template_key: 'research_softtechn_v1',
    template_type: 'research',
    status: 'active',
    lang: 'english',
    persona:
      '- Name: Max M.\n- Age: 27-38\n- Location: Europe (DE/PL/CZ/Nordics/Baltics) and Asia (TH/SG/ID/VN)\n- Experience: 1.5-5 years of trading (Forex, some futures)\n- Goals: scale capital without risking personal funds; move from hobby to profession; financial freedom and geographic flexibility\n- Pains: blown accounts; lack of capital; distrust of prop firms; information overload\n- Interests: funded accounts/prop; futures vs Forex; financial freedom; digital nomad lifestyle; minimalism/efficiency',
    config: {
      core_message:
        'Funded accounts mean fast access to capital without risking personal funds. They remove fear of losing deposits and the barrier of limited cash. Living as a digital nomad and growing as a trader becomes realistic through the prop model.',
      rules:
        'For each idea, return only one research object. Do not split into multiple subtopics or countries. Keep results condensed into one structured summary. Use friendly, simple English. Focus 70 percent on trader benefits or solutions and 30 percent on rules or limits. Always connect the research back to funded accounts and the persona goals or pains. End with a light invitation such as try, start, or join. Category must always be one of: Trading, Fin. Freedom, Lifestyle. Never invent new categories.',
      notes: '',
    },
  },
  {
    template_key: 'script_default_v1',
    template_type: 'script',
    status: 'active',
    lang: 'english',
    persona: '',
    config: {
      duration: '25 - 30 seconds',
      word_range: '60 - 80 words',
      tone: 'neutral, educational',
      structure: 'Hook -> Insight -> Call-to-Action',
      rules:
        'No hype, no brands, no advice. Keep tone factual and inclusive. End with: "Follow for daily tips, and for deeper insights, use the link in our profile."',
    },
  },
]

async function ensureDefaults(userId: string) {
  try {
    const { data: existingCategories } = await supabase
      .from('content_categories')
      .select('id')
      .eq('user_id', userId)
      .limit(1)

    if (!existingCategories || existingCategories.length === 0) {
      const inserts = DEFAULT_CATEGORIES.map((category) => ({
        user_id: userId,
        ...category,
      }))
      const { error } = await supabase.from('content_categories').insert(inserts)
      if (error) {
        console.error('Failed to seed default categories:', error)
      }
    }

    const { data: existingPrompts } = await supabase
      .from('prompt_templates')
      .select('id')
      .eq('user_id', userId)
      .limit(1)

    if (!existingPrompts || existingPrompts.length === 0) {
      const inserts = DEFAULT_PROMPTS.map((prompt) => ({
        user_id: userId,
        ...prompt,
      }))
      const { error } = await supabase.from('prompt_templates').insert(inserts)
      if (error) {
        console.error('Failed to seed default prompts:', error)
      }
    }
  } catch (error) {
    console.error('ensureDefaults error:', error)
  }
}

function mapPrompt(row: any) {
  if (!row) {
    return null
  }

  const config = row.config || {}
  const base = {
    id: row.id,
    template_key: row.template_key,
    template_type: row.template_type,
    status: row.status,
    lang: row.lang,
    persona: row.persona || '',
    created_at: row.created_at,
    updated_at: row.updated_at,
  }

  if (row.template_type === 'ideas') {
    return {
      ...base,
      business_model: config.business_model || '',
      focus: config.focus || '',
      categories: config.categories || '',
    }
  }

  if (row.template_type === 'research') {
    return {
      ...base,
      core_message: config.core_message || '',
      rules: config.rules || '',
      notes: config.notes || '',
    }
  }

  return {
    ...base,
    duration: config.duration || '',
    word_range: config.word_range || '',
    tone: config.tone || '',
    structure: config.structure || '',
    rules: config.rules || '',
  }
}

router.use(authenticate)

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    await ensureDefaults(userId)

    const { data: categories, error: categoryError } = await supabase
      .from('content_categories')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (categoryError) {
      console.error('Fetch categories error:', categoryError)
      return res.status(500).json({ error: 'Failed to load categories' })
    }

    const { data: promptRows, error: promptError } = await supabase
      .from('prompt_templates')
      .select('*')
      .eq('user_id', userId)

    if (promptError) {
      console.error('Fetch prompts error:', promptError)
      return res.status(500).json({ error: 'Failed to load prompts' })
    }

    const prompts = {
      ideas: null as any,
      research: null as any,
      script: null as any,
    }

    promptRows?.forEach((row) => {
      if (row.template_type in prompts) {
        prompts[row.template_type as 'ideas' | 'research' | 'script'] = mapPrompt(row)
      }
    })

    return res.json({
      categories: categories || [],
      prompts,
    })
  } catch (error) {
    console.error('Content fetch error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/categories', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { category_key, name, status = 'active', description = '', sort_order } = req.body

    if (!category_key || !name) {
      return res.status(400).json({ error: 'category_key and name are required' })
    }

    const normalizedStatus = status === 'inactive' ? 'inactive' : 'active'
    let order = sort_order

    if (order === undefined || order === null) {
      const { data: maxOrderData } = await supabase
        .from('content_categories')
        .select('sort_order')
        .eq('user_id', userId)
        .order('sort_order', { ascending: false })
        .limit(1)

      order = maxOrderData && maxOrderData.length > 0 ? (maxOrderData[0].sort_order || 0) + 1 : 1
    }

    const { data, error } = await supabase
      .from('content_categories')
      .insert({
        user_id: userId,
        category_key,
        name,
        status: normalizedStatus,
        description,
        sort_order: order,
      })
      .select()
      .single()

    if (error) {
      console.error('Create category error:', error)
      return res.status(500).json({ error: 'Failed to create category' })
    }

    return res.status(201).json({ category: data })
  } catch (error) {
    console.error('Create category exception:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

router.put('/categories/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params
    const { category_key, name, status, description, sort_order } = req.body

    const updates: Record<string, any> = { updated_at: new Date().toISOString() }

    if (category_key !== undefined) {
      if (!category_key) {
        return res.status(400).json({ error: 'category_key cannot be empty' })
      }
      updates.category_key = category_key
    }

    if (name !== undefined) {
      if (!name) {
        return res.status(400).json({ error: 'name cannot be empty' })
      }
      updates.name = name
    }

    if (status !== undefined) {
      updates.status = status === 'inactive' ? 'inactive' : 'active'
    }

    if (description !== undefined) {
      updates.description = description
    }

    if (sort_order !== undefined) {
      updates.sort_order = sort_order
    }

    const { data, error } = await supabase
      .from('content_categories')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      if ((error as any).code === 'PGRST116') {
        return res.status(404).json({ error: 'Category not found' })
      }
      console.error('Update category error:', error)
      return res.status(500).json({ error: 'Failed to update category' })
    }

    if (!data) {
      return res.status(404).json({ error: 'Category not found' })
    }

    return res.json({ category: data })
  } catch (error) {
    console.error('Update category exception:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

router.delete('/categories/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params

    const { error } = await supabase
      .from('content_categories')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('id')
      .single()

    if (error) {
      if ((error as any).code === 'PGRST116') {
        return res.status(404).json({ error: 'Category not found' })
      }
      console.error('Delete category error:', error)
      return res.status(500).json({ error: 'Failed to delete category' })
    }

    return res.status(204).send()
  } catch (error) {
    console.error('Delete category exception:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

router.put('/prompts/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params
    const { persona, lang, status } = req.body

    const { data: existing, error: fetchError } = await supabase
      .from('prompt_templates')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (fetchError) {
      if ((fetchError as any).code === 'PGRST116') {
        return res.status(404).json({ error: 'Prompt not found' })
      }
      console.error('Fetch prompt error:', fetchError)
      return res.status(500).json({ error: 'Failed to load prompt' })
    }

    if (!existing) {
      return res.status(404).json({ error: 'Prompt not found' })
    }

    const config = { ...(existing?.config || {}) }

    if (existing.template_type === 'ideas') {
      if (req.body.business_model !== undefined) {
        config.business_model = req.body.business_model
      }
      if (req.body.focus !== undefined) {
        config.focus = req.body.focus
      }
      if (req.body.categories !== undefined) {
        config.categories = req.body.categories
      }
    } else if (existing.template_type === 'research') {
      if (req.body.core_message !== undefined) {
        config.core_message = req.body.core_message
      }
      if (req.body.rules !== undefined) {
        config.rules = req.body.rules
      }
      if (req.body.notes !== undefined) {
        config.notes = req.body.notes
      }
    } else {
      if (req.body.duration !== undefined) {
        config.duration = req.body.duration
      }
      if (req.body.word_range !== undefined) {
        config.word_range = req.body.word_range
      }
      if (req.body.tone !== undefined) {
        config.tone = req.body.tone
      }
      if (req.body.structure !== undefined) {
        config.structure = req.body.structure
      }
      if (req.body.rules !== undefined) {
        config.rules = req.body.rules
      }
    }

    const updates: Record<string, any> = {
      config,
      updated_at: new Date().toISOString(),
    }

    if (persona !== undefined) {
      updates.persona = persona
    }

    if (lang !== undefined) {
      updates.lang = lang
    }

    if (status !== undefined) {
      updates.status = status === 'inactive' ? 'inactive' : 'active'
    }

    const { data, error } = await supabase
      .from('prompt_templates')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      if ((error as any).code === 'PGRST116') {
        return res.status(404).json({ error: 'Prompt not found' })
      }
      console.error('Update prompt error:', error)
      return res.status(500).json({ error: 'Failed to update prompt' })
    }

    if (!data) {
      return res.status(404).json({ error: 'Prompt not found' })
    }

    return res.json({ prompt: mapPrompt(data) })
  } catch (error) {
    console.error('Update prompt exception:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// Scout-Research Hunter: Generate topics
router.post('/generate-topics', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { ResearchService } = await import('../services/researchService.js')
    const { ContentService } = await import('../services/contentService.js')

    // Generate 3 topics
    const topics = await ResearchService.generateTopics(userId)

    // Create content items for each topic
    const createdItems = []
    for (const topic of topics) {
      const category = topic.Category === 'Fin. Freedom' ? 'Fin. Freedom' : topic.Category
      const contentItem = await ContentService.createContentItem(userId, {
        topic: topic.Idea,
        category: category as 'Trading' | 'Lifestyle' | 'Fin. Freedom',
      })
      createdItems.push(contentItem)
    }

    return res.json({ topics: createdItems })
  } catch (error: any) {
    console.error('Generate topics error:', error)
    return res.status(500).json({ error: error.message || 'Failed to generate topics' })
  }
})

// Research a topic
router.post('/research', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { topic, category, content_item_id } = req.body

    if (!topic || !category) {
      return res.status(400).json({ error: 'topic and category are required' })
    }

    const { ResearchService } = await import('../services/researchService.js')
    const { ContentService } = await import('../services/contentService.js')

    const research = await ResearchService.researchTopic(
      topic,
      category as 'Trading' | 'Lifestyle' | 'Fin. Freedom'
    )

    // If content_item_id provided, update it with research
    if (content_item_id) {
      await ContentService.updateContentResearch(content_item_id, research)
    }

    return res.json({ research })
  } catch (error: any) {
    console.error('Research error:', error)
    return res.status(500).json({ error: error.message || 'Failed to research topic' })
  }
})

// Get all content items
router.get('/items', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { ContentService } = await import('../services/contentService.js')

    const items = await ContentService.getAllContentItems(userId)
    return res.json({ items })
  } catch (error: any) {
    console.error('Get content items error:', error)
    return res.status(500).json({ error: error.message || 'Failed to fetch content items' })
  }
})

// A_Script Creation: Generate script from content item
router.post('/generate-script', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { content_item_id } = req.body

    if (!content_item_id) {
      return res.status(400).json({ error: 'content_item_id is required' })
    }

    const { ContentService } = await import('../services/contentService.js')
    const { ScriptService } = await import('../services/scriptService.js')
    const { ReelService } = await import('../services/reelService.js')
    const { JobService } = await import('../services/jobService.js')

    // Get content item
    const contentItem = await ContentService.getContentItemById(content_item_id)
    if (!contentItem) {
      return res.status(404).json({ error: 'Content item not found' })
    }

    if (contentItem.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    if (!contentItem.research) {
      return res.status(400).json({ error: 'Content item must have research data' })
    }

    // Generate script
    const script = await ScriptService.generateScriptFromContent(contentItem)

    // Create reel with script
    const research = contentItem.research
    const reel = await ReelService.createReel(userId, {
      content_item_id: contentItem.id,
      topic: research.Idea || contentItem.topic,
      category: contentItem.category,
      description: research.Description || null,
      why_it_matters: research.WhyItMatters || null,
      useful_tips: research.UsefulTips || null,
      script,
    })

    // Mark content item as done
    await ContentService.markContentDone(contentItem.id)

    // Schedule auto-approval check (already handled by cron, but we can trigger it)
    await JobService.scheduleJob('auto_approval', { reel_id: reel.id })

    return res.json({ reel, script })
  } catch (error: any) {
    console.error('Generate script error:', error)
    return res.status(500).json({ error: error.message || 'Failed to generate script' })
  }
})

// Quick Create: Generate script directly from user input
router.post('/quick-create/generate-script', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { category, topic, description, whyImportant, usefulTips } = req.body

    if (!category || !topic) {
      return res.status(400).json({ error: 'category and topic are required' })
    }

    // Map category_key to category name
    const categoryMap: Record<string, 'Trading' | 'Lifestyle' | 'Fin. Freedom'> = {
      'trading': 'Trading',
      'lifestyle': 'Lifestyle',
      'fin_freedom': 'Fin. Freedom',
      'financial_freedom': 'Fin. Freedom',
      'fin. freedom': 'Fin. Freedom',
      'Fin. Freedom': 'Fin. Freedom',
      'Financial Freedom': 'Fin. Freedom',
      'Trading': 'Trading',
      'Lifestyle': 'Lifestyle',
    }

    // Normalize the category key
    const normalizedCategory = category.toLowerCase().trim().replace(/\s+/g, '_')
    const mappedCategory = categoryMap[normalizedCategory] || categoryMap[category] || categoryMap[category.toLowerCase()]
    
    if (!mappedCategory || !['Trading', 'Lifestyle', 'Fin. Freedom'].includes(mappedCategory)) {
      return res.status(400).json({ 
        error: `Invalid category "${category}". Must be Trading, Lifestyle, or Fin. Freedom` 
      })
    }

    const { ScriptService } = await import('../services/scriptService.js')

    // Generate script using custom data
    const script = await ScriptService.generateScriptCustom({
      idea: topic,
      description: description || '',
      whyItMatters: whyImportant || '',
      usefulTips: usefulTips || '',
      category: mappedCategory,
    })

    return res.json({ script })
  } catch (error: any) {
    console.error('Quick create script generation error:', error)
    return res.status(500).json({ error: error.message || 'Failed to generate script' })
  }
})

export default router

