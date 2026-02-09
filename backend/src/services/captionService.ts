import { supabase } from '../lib/supabase.js'
import { openai } from '../lib/openai.js'

const buildCaptionPrompt = (topic?: string | null, script?: string | null): string => {
  return `Generate a compelling social media caption/description for a short video post.\n\n${
    topic ? `Topic: ${topic}` : ''
  }\n${script ? `Script: ${script.substring(0, 500)}` : ''}\n\nRequirements:\n- Engaging and click-worthy\n- Include relevant hashtags (3-5)\n- Platform-optimized (works for Instagram, TikTok, YouTube Shorts, etc.)\n- 100-200 characters for the main caption\n- Include a call-to-action\n- Professional but approachable tone\n\nOutput ONLY the caption text, nothing else.`
}

export async function generateCaptionText(topic?: string | null, script?: string | null): Promise<string> {
  if (!topic && !script) {
    throw new Error('Topic or script is required')
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a social media content writer specializing in video captions for short-form content platforms.',
      },
      {
        role: 'user',
        content: buildCaptionPrompt(topic, script),
      },
    ],
    temperature: 0.8,
    max_tokens: 300,
  })

  return completion.choices[0]?.message?.content?.trim() || ''
}

export async function ensureVideoCaption(videoId: string): Promise<string> {
  const { data: video, error } = await supabase
    .from('videos')
    .select('id, topic, script, caption')
    .eq('id', videoId)
    .single()

  if (error || !video) {
    throw new Error(error?.message || 'Video not found')
  }

  if (video.caption && video.caption.trim().length > 0) {
    return video.caption
  }

  const caption = await generateCaptionText(video.topic, video.script)

  const { error: updateError } = await supabase
    .from('videos')
    .update({
      caption,
      updated_at: new Date().toISOString(),
    })
    .eq('id', videoId)

  if (updateError) {
    console.error('[Caption Service] Failed to update video caption:', updateError)
  }

  await ensurePlanItemCaption(videoId, caption)

  return caption
}

export async function ensurePlanItemCaption(videoId: string, caption: string): Promise<void> {
  if (!caption.trim()) {
    return
  }

  const { data: planItems, error } = await supabase
    .from('video_plan_items')
    .select('id, caption')
    .eq('video_id', videoId)

  if (error || !planItems || planItems.length === 0) {
    return
  }

  const itemsToUpdate = planItems.filter(item => !item.caption || item.caption.trim().length === 0)
  if (itemsToUpdate.length === 0) {
    return
  }

  const ids = itemsToUpdate.map(item => item.id)

  const { error: updateError } = await supabase
    .from('video_plan_items')
    .update({ caption })
    .in('id', ids)

  if (updateError) {
    console.error('[Caption Service] Failed to update plan item captions:', updateError)
  }
}
