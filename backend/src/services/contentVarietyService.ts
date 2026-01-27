import { supabase } from '../lib/supabase.js'

interface VarietyMetrics {
  topicDiversity: number
  scriptDiversity: number
  hookVariety: number
  formatVariety: number
  overallScore: number
  recommendations: string[]
}

interface ContentAnalysis {
  topics: string[]
  hooks: string[]
  formats: string[]
  scripts: string[]
}

export class ContentVarietyService {
  /**
   * Analyze content variety for a user over the last 30 days
   */
  static async analyzeContentVariety(userId: string, days: number = 30): Promise<VarietyMetrics> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    // Get recent content
    const { data: recentContent } = await supabase
      .from('video_plan_items')
      .select('topic, script, scheduled_date, status')
      .eq('user_id', userId)
      .in('status', ['completed', 'approved'])
      .gte('scheduled_date', cutoffDate.toISOString().split('T')[0])
      .order('scheduled_date', { ascending: false })

    if (!recentContent || recentContent.length === 0) {
      return {
        topicDiversity: 0,
        scriptDiversity: 0,
        hookVariety: 0,
        formatVariety: 0,
        overallScore: 0,
        recommendations: ['Start creating more content to analyze variety']
      }
    }

    // Analyze content
    const analysis = this.analyzeContent(recentContent)
    
    // Calculate metrics
    const topicDiversity = this.calculateTopicDiversity(analysis.topics)
    const scriptDiversity = this.calculateScriptDiversity(analysis.scripts)
    const hookVariety = this.calculateHookVariety(analysis.hooks)
    const formatVariety = this.calculateFormatVariety(analysis.scripts)
    
    const overallScore = (topicDiversity + scriptDiversity + hookVariety + formatVariety) / 4
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(
      topicDiversity,
      scriptDiversity,
      hookVariety,
      formatVariety,
      analysis
    )

    return {
      topicDiversity,
      scriptDiversity,
      hookVariety,
      formatVariety,
      overallScore,
      recommendations
    }
  }

  /**
   * Analyze content to extract topics, hooks, formats, and scripts
   */
  private static analyzeContent(content: any[]): ContentAnalysis {
    const topics: string[] = []
    const hooks: string[] = []
    const formats: string[] = []
    const scripts: string[] = []

    content.forEach(item => {
      if (item.topic) {
        topics.push(item.topic.toLowerCase())
      }
      
      if (item.script) {
        const script = item.script
        scripts.push(script)
        
        // Extract hook (first sentence or question)
        const hookMatch = script.match(/^([^?.!]*[?.!])/)
        if (hookMatch) {
          hooks.push(hookMatch[1].toLowerCase().trim())
        }
        
        // Detect format patterns
        if (script.includes('?')) formats.push('question')
        if (script.includes('Did you know') || script.includes('fact')) formats.push('educational')
        if (script.includes('step') || script.includes('how to')) formats.push('how-to')
        if (script.includes('story') || script.includes('I remember')) formats.push('storytelling')
        if (script.includes('%') || script.includes('statistic')) formats.push('data-driven')
        if (script.includes('tip') || script.includes('advice')) formats.push('tips')
      }
    })

    return { topics, hooks, formats, scripts }
  }

  /**
   * Calculate topic diversity (0-100)
   */
  private static calculateTopicDiversity(topics: string[]): number {
    if (topics.length === 0) return 0
    
    // Count unique topics and their variations
    const uniqueTopics = new Set(topics)
    const topicVariations = topics.filter(topic => 
      topic.includes('vs') || topic.includes('vs.') || topic.includes('versus')
    ).length
    
    // Calculate diversity based on uniqueness and variations
    const uniquenessScore = (uniqueTopics.size / topics.length) * 100
    const variationScore = Math.min((topicVariations / topics.length) * 200, 50) // Max 50 points
    
    return Math.min(uniquenessScore + variationScore, 100)
  }

  /**
   * Calculate script diversity (0-100)
   */
  private static calculateScriptDiversity(scripts: string[]): number {
    if (scripts.length === 0) return 0
    
    // Calculate similarity between scripts
    let totalSimilarity = 0
    let comparisons = 0
    
    for (let i = 0; i < scripts.length; i++) {
      for (let j = i + 1; j < scripts.length; j++) {
        const similarity = this.calculateTextSimilarity(scripts[i], scripts[j])
        totalSimilarity += similarity
        comparisons++
      }
    }
    
    const averageSimilarity = comparisons > 0 ? totalSimilarity / comparisons : 0
    return Math.max(0, 100 - (averageSimilarity * 100)) // Invert similarity to get diversity
  }

  /**
   * Calculate hook variety (0-100)
   */
  private static calculateHookVariety(hooks: string[]): number {
    if (hooks.length === 0) return 0
    
    const uniqueHooks = new Set(hooks)
    const hookTypes = {
      questions: hooks.filter(h => h.includes('?')).length,
      statements: hooks.filter(h => !h.includes('?')).length,
      statistics: hooks.filter(h => /\d+/.test(h)).length,
      shocking: hooks.filter(h => h.includes('shocking') || h.includes('surprising') || h.includes('unbelievable')).length
    }
    
    const uniquenessScore = (uniqueHooks.size / hooks.length) * 100
    const typeVarietyScore = Object.values(hookTypes).filter(count => count > 0).length * 20
    
    return Math.min(uniquenessScore + typeVarietyScore, 100)
  }

  /**
   * Calculate format variety (0-100)
   */
  private static calculateFormatVariety(formats: string[]): number {
    if (formats.length === 0) return 0
    
    const uniqueFormats = new Set(formats)
    return (uniqueFormats.size / Math.max(formats.length, 1)) * 100
  }

  /**
   * Calculate text similarity using simple word overlap
   */
  private static calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = text1.toLowerCase().split(/\s+/)
    const words2 = text2.toLowerCase().split(/\s+/)
    
    const set1 = new Set(words1)
    const set2 = new Set(words2)
    
    const intersection = new Set([...set1].filter(x => set2.has(x)))
    const union = new Set([...set1, ...set2])
    
    return intersection.size / union.size
  }

  /**
   * Generate recommendations based on analysis
   */
  private static generateRecommendations(
    topicDiversity: number,
    scriptDiversity: number,
    hookVariety: number,
    formatVariety: number,
    analysis: ContentAnalysis
  ): string[] {
    const recommendations: string[] = []
    
    if (topicDiversity < 50) {
      recommendations.push('Explore new subtopics and angles within your niche')
      recommendations.push('Try covering different aspects of your main topics')
    }
    
    if (scriptDiversity < 50) {
      recommendations.push('Vary your script structure and approach')
      recommendations.push('Use different examples and stories in your scripts')
    }
    
    if (hookVariety < 50) {
      recommendations.push('Mix questions, statements, and shocking facts as hooks')
      recommendations.push('Try different hook patterns: statistics, personal stories, surprising facts')
    }
    
    if (formatVariety < 50) {
      recommendations.push('Vary content formats: how-to, listicles, stories, educational')
      recommendations.push('Experiment with different content styles and approaches')
    }
    
    // Add specific recommendations based on content analysis
    const questionHooks = analysis.hooks.filter(h => h.includes('?')).length
    const totalHooks = analysis.hooks.length
    
    if (totalHooks > 0 && questionHooks / totalHooks > 0.8) {
      recommendations.push('Try using more statement-based hooks instead of just questions')
    }
    
    if (totalHooks > 0 && questionHooks / totalHooks < 0.2) {
      recommendations.push('Consider using more questions as hooks to engage viewers')
    }
    
    return recommendations
  }

  /**
   * Get daily variety report for monitoring
   */
  static async getDailyVarietyReport(userId: string): Promise<{
    date: string
    score: number
    issues: string[]
  }> {
    const today = new Date().toISOString().split('T')[0]
    
    const { data: todayContent } = await supabase
      .from('video_plan_items')
      .select('topic, script')
      .eq('user_id', userId)
      .eq('scheduled_date', today)
      .in('status', ['completed', 'approved'])

    if (!todayContent || todayContent.length === 0) {
      return {
        date: today,
        score: 0,
        issues: ['No content created today']
      }
    }

    const analysis = this.analyzeContent(todayContent)
    const topicDiversity = this.calculateTopicDiversity(analysis.topics)
    const scriptDiversity = this.calculateScriptDiversity(analysis.scripts)
    
    const score = (topicDiversity + scriptDiversity) / 2
    const issues: string[] = []
    
    if (topicDiversity < 30) issues.push('Low topic diversity')
    if (scriptDiversity < 30) issues.push('Low script diversity')
    if (analysis.topics.length > 0 && new Set(analysis.topics).size < analysis.topics.length) {
      issues.push('Duplicate topics detected')
    }

    return {
      date: today,
      score,
      issues
    }
  }
}
