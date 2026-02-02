import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { Select } from '../components/ui/Select'
import { Sparkles, Video, Share2, Instagram, Youtube, Users, Facebook } from 'lucide-react'
import api from '../lib/api'
import { DEFAULT_VERTICAL_ASPECT_RATIO, DEFAULT_VERTICAL_DIMENSION } from '../lib/videos'
import { useNotifications } from '../contexts/NotificationContext'
import { useLanguage } from '../contexts/LanguageContext'

interface SocialAccount {
  id: string
  platform: string
  status: string
}

const platformIcons: Record<string, React.FC<any>> = {
  instagram: Instagram,
  youtube: Youtube,
  tiktok: Users,
  facebook: Facebook,
  x: Share2,
}

const platformNames: Record<string, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  x: 'X (Twitter)',
}

export function QuickCreate() {
  const navigate = useNavigate()
  const { addNotification } = useNotifications()
  const { t } = useLanguage()
  const [topic, setTopic] = useState('')
  const [description, setDescription] = useState('')
  const [style, setStyle] = useState('Cinematic')
  const [duration] = useState(15)
  const [generateCaption, setGenerateCaption] = useState(true)
  const [generatingVideo, setGeneratingVideo] = useState(false)
  const [formError, setFormError] = useState('')
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([])

  useEffect(() => {
    loadSocialAccounts()
  }, [])

  const loadSocialAccounts = async () => {
    try {
      const response = await api.get('/api/social/accounts')
      const accounts = response.data.accounts || []
      setSocialAccounts(accounts)
    } catch (error) {
      console.error('Failed to load social accounts:', error)
    }
  }

  const handleGenerateVideo = async () => {
    if (!topic.trim()) {
      setFormError(t('validation.required_field'))
      return
    }

    setGeneratingVideo(true)
    setFormError('')

    try {
      const verticalDimension = { ...DEFAULT_VERTICAL_DIMENSION }
      await api.post('/api/videos/generate', {
        topic,
        description: description || undefined,
        style,
        duration,
        provider: 'sora',
        generateScript: true,
        generate_caption: generateCaption,
        aspect_ratio: DEFAULT_VERTICAL_ASPECT_RATIO,
        dimension: verticalDimension,
      })

      addNotification({
        type: 'success',
        title: t('quick_create.gen_start_title'),
        message: t('quick_create.gen_start_desc'),
      })

      navigate('/videos')
    } catch (error: any) {
      console.error('Video generation error:', error)
      setFormError(error.response?.data?.error || t('errors.something_went_wrong'))
    } finally {
      setGeneratingVideo(false)
    }
  }

  const connectedPlatforms = socialAccounts
    .filter((acc: SocialAccount) => acc.status === 'connected')
    .map((acc: SocialAccount) => acc.platform)

  return (
    <Layout>
      <div className="mx-auto w-full max-w-4xl space-y-6 sm:space-y-8">
        <div className="rounded-[28px] border border-white/40 bg-white/80 p-5 sm:p-6 lg:p-8 shadow-[0_35px_80px_-50px_rgba(79,70,229,0.6)] backdrop-blur-xl">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 leading-none">{t('common.create')}</p>
          <h1 className="mt-3 text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">{t('quick_create.title')}</h1>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">
            {t('quick_create.desc')}
          </p>
        </div>

        {formError && (
          <div className="rounded-2xl border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm text-rose-600">
            {formError}
          </div>
        )}

        <Card className="p-4 sm:p-6 lg:p-8">
          <div className="mb-6 flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-brand-500" />
            <h2 className="text-xl font-semibold text-primary">{t('common.manual_creation')}</h2>
          </div>

          {connectedPlatforms.length > 0 && (
            <div className="mb-6 rounded-2xl border border-blue-200/60 bg-blue-50/40 p-4">
              <p className="mb-2 text-sm font-semibold text-blue-700">Connected Social Media</p>
              <div className="flex flex-wrap gap-2">
                {connectedPlatforms.map((platform: string) => {
                  const Icon = platformIcons[platform] || Share2
                  return (
                    <div
                      key={platform}
                      className="flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-1.5"
                    >
                      <Icon className="h-4 w-4 text-blue-600" />
                      <span className="text-xs font-medium text-blue-700">
                        {platformNames[platform] || platform}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="space-y-6">
            <Input
              label={t('quick_create.topic_label')}
              placeholder={t('quick_create.topic_placeholder')}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              required
            />

            <Textarea
              label={t('quick_create.desc_label')}
              placeholder={t('quick_create.desc_placeholder')}
              rows={4}
              value={description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
            />

            <Select
              label={t('quick_create.video_style')}
              value={style}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStyle(e.target.value)}
              options={[
                { value: 'Cinematic', label: 'Cinematic' },
                { value: 'Realistic', label: 'Realistic' },
                { value: 'Anime', label: 'Anime' },
                { value: '3D Render', label: '3D Render' },
                { value: 'Cyberpunk', label: 'Cyberpunk' },
                { value: 'Minimalist', label: 'Minimalist' },
                { value: 'Documentary', label: 'Documentary' },
              ]}
              className="w-full"
            />

            <div className="rounded-2xl border border-white/60 bg-white/70 p-6">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="generateCaption"
                  checked={generateCaption}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGenerateCaption(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                />
                <div className="flex-1">
                  <label
                    htmlFor="generateCaption"
                    className="text-sm font-semibold text-primary cursor-pointer"
                  >
                    {t('quick_create.gen_caption_label')}
                  </label>
                  <p className="mt-1 text-xs text-slate-500">
                    {t('quick_create.gen_caption_desc')}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between gap-3 pt-6">
              <Button
                variant="ghost"
                onClick={() => navigate('/videos')}
                className="w-full sm:w-auto border border-slate-200"
              >
                {t('common.cancel')}
              </Button>
              <Button
                onClick={handleGenerateVideo}
                disabled={generatingVideo}
                loading={generatingVideo}
                leftIcon={!generatingVideo ? <Video className="h-4 w-4" /> : undefined}
                className="w-full sm:w-auto shadow-lg shadow-brand-500/20"
              >
                {t('quick_create.generate_video_sora')}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </Layout>
  )
}
