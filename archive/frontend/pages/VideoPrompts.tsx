import { useState, useEffect, useMemo } from 'react'
import { Layout } from '../components/layout/Layout'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { Modal } from '../components/ui/Modal'
import { EmptyState } from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'
import {
  Plus,
  Edit2,
  Trash2,
  Save,
  FileText,
  Copy,
  Lightbulb,
  PenTool
} from 'lucide-react'
import api from '../lib/api'
import { useNotifications } from '../contexts/NotificationContext'

interface VideoPrompt {
  id: string
  name: string
  topic: string | null
  category: string | null
  description: string | null
  why_important: string | null
  useful_tips: string | null
  created_at: string
  updated_at: string
}

type CategoryType = 'Research' | 'Scripting' | 'Ideation'

interface CategoryConfig {
  label: string
  icon: any
  description: string
  columns: {
    name: string
    description: string
    why_important: string
    useful_tips: string
  }
  placeholders: {
    name: string
    description: string
    why_important: string
    useful_tips: string
  }
  defaults: Array<{
    name: string
    description: string
    why_important: string
    useful_tips: string
  }>
}

const CATEGORY_CONFIG: Record<CategoryType, CategoryConfig> = {
  Research: {
    label: 'Research',
    icon: FileText,
    description: 'Manage your research topics and findings. Organize your content research here.',
    columns: {
      name: 'Topic',
      description: 'Research Goal',
      why_important: 'Key Questions',
      useful_tips: 'Notes / Findings'
    },
    placeholders: {
      name: 'e.g., Competitor Analysis',
      description: 'What are you trying to find out?',
      why_important: 'Specific questions to answer...',
      useful_tips: 'Paste your research notes here...'
    },
    defaults: [
      {
        name: 'Competitor Analysis',
        description: 'Analyze top 3 competitors in the niche.',
        why_important: 'What are they doing well? What are they missing? How can we differentiate?',
        useful_tips: 'Look at their most popular videos, comments section, and thumbnails.'
      },
      {
        name: 'Audience Pain Points',
        description: 'Identify core problems the audience is facing.',
        why_important: 'What questions are they asking in comments? What are their frustrations?',
        useful_tips: 'Check Reddit, Quora, and YouTube comments.'
      },
      {
        name: 'Trend Research',
        description: 'Find current trending topics in the industry.',
        why_important: 'Is this a rising trend or fading? How can we put a unique spin on it?',
        useful_tips: 'Use Google Trends, Twitter Trending, and TikTok Creative Center.'
      },
      {
        name: 'Product Review',
        description: 'Deep dive into a specific product or tool.',
        why_important: 'Pros, cons, pricing, and who is it for?',
        useful_tips: 'Test the product yourself if possible. Look for hidden features.'
      }
    ]
  },
  Scripting: {
    label: 'Scripting',
    icon: PenTool,
    description: 'Draft your video scripts and structures. Plan your hooks and calls to action.',
    columns: {
      name: 'Title',
      description: 'Hook',
      why_important: 'Body Points',
      useful_tips: 'Call to Action'
    },
    placeholders: {
      name: 'e.g., 5 Tips for Better Sleep',
      description: 'The first 3 seconds to grab attention...',
      why_important: 'Key points to cover...',
      useful_tips: 'What should the viewer do next?'
    },
    defaults: [
      {
        name: 'Educational Video',
        description: 'Did you know that [Surprising Fact]? Here is why...',
        why_important: '1. Concept explanation\n2. Real-world example\n3. Common misconception',
        useful_tips: 'Subscribe for more daily tips!'
      },
      {
        name: 'Storytelling',
        description: 'I almost lost everything when...',
        why_important: '1. The Inciting Incident\n2. The Struggle\n3. The Resolution',
        useful_tips: 'Check out the link in bio for the full story.'
      },
      {
        name: 'Listicle',
        description: 'Top 5 tools you need in 2024...',
        why_important: 'Item 1: Best for X\nItem 2: Best for Y\nItem 3: Budget option',
        useful_tips: 'Which one would you pick? Comment below.'
      },
      {
        name: 'Tutorial',
        description: 'Stop doing [Mistake]. Do this instead...',
        why_important: 'Step 1: Preparation\nStep 2: Execution\nStep 3: Polish',
        useful_tips: 'Save this video so you do not forget!'
      }
    ]
  },
  Ideation: {
    label: 'Ideation',
    icon: Lightbulb,
    description: 'Brainstorm new video ideas and angles. Capture inspiration before it fades.',
    columns: {
      name: 'Topic',
      description: 'Angle / Hook',
      why_important: 'Target Audience',
      useful_tips: 'Format Ideas'
    },
    placeholders: {
      name: 'e.g., AI Tools',
      description: 'Unique perspective or twist...',
      why_important: 'Who is this for?',
      useful_tips: 'Shorts, Long-form, Carousel...'
    },
    defaults: [
      {
        name: 'Trend Jacking',
        description: 'Apply a current viral trend to my niche.',
        why_important: 'Gen Z / TikTok natives',
        useful_tips: 'Recreate the trending sound/format but with industry-specific jokes.'
      },
      {
        name: 'Controversial Take',
        description: 'Why everyone is wrong about [Common Belief].',
        why_important: 'Experts and beginners in the field',
        useful_tips: 'Talking head video, serious tone, stitching a "bad advice" video.'
      },
      {
        name: 'Behind the Scenes',
        description: 'A day in the life / How I work.',
        why_important: 'Superfans and aspiring creators',
        useful_tips: 'Vlog style, raw footage, voiceover.'
      },
      {
        name: 'Q&A',
        description: 'Answering the most asked questions from comments.',
        why_important: 'Current subscribers',
        useful_tips: 'Rapid fire questions, green screen background.'
      }
    ]
  }
}

export function VideoPrompts() {
  const { addNotification } = useNotifications()
  const [prompts, setPrompts] = useState<VideoPrompt[]>([])
  const [loading, setLoading] = useState(true)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState<VideoPrompt | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [seeding, setSeeding] = useState(false)

  const [activeTab, setActiveTab] = useState<CategoryType>('Research')

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    why_important: '',
    useful_tips: '',
  })

  useEffect(() => {
    loadPrompts()
  }, [])

  const loadPrompts = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/prompts')
      setPrompts(response.data.prompts || [])
    } catch (error: any) {
      console.error('Failed to load prompts:', error)
      addNotification({
        type: 'error',
        title: 'Failed to load prompts',
        message: error.response?.data?.error || 'Could not load your prompts',
      })
    } finally {
      setLoading(false)
    }
  }

  const filteredPrompts = useMemo(() => {
    return prompts.filter(p => {
      // Handle legacy prompts with null category as 'Research'
      const category = p.category || 'Research'
      return category === activeTab
    })
  }, [prompts, activeTab])

  const config = CATEGORY_CONFIG[activeTab]

  const handleCreate = () => {
    setFormData({
      name: '',
      description: '',
      why_important: '',
      useful_tips: '',
    })
    setEditingPrompt(null)
    setCreateModalOpen(true)
  }

  const handleEdit = (prompt: VideoPrompt) => {
    setFormData({
      name: prompt.name,
      description: prompt.description || '',
      why_important: prompt.why_important || '',
      useful_tips: prompt.useful_tips || '',
    })
    setEditingPrompt(prompt)
    setCreateModalOpen(true)
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      addNotification({
        type: 'error',
        title: 'Validation Error',
        message: `${config.columns.name} is required`,
      })
      return
    }

    setSaving(true)
    try {
      if (editingPrompt) {
        await api.put(`/api/prompts/${editingPrompt.id}`, {
          ...formData,
          topic: null,
          category: activeTab
        })
        addNotification({
          type: 'success',
          title: 'Prompt updated',
          message: 'Your prompt has been updated successfully',
        })
      } else {
        await api.post('/api/prompts', {
          ...formData,
          topic: null,
          category: activeTab
        })
        addNotification({
          type: 'success',
          title: 'Prompt created',
          message: 'Your new prompt has been created successfully',
        })
      }
      setCreateModalOpen(false)
      setEditingPrompt(null)
      loadPrompts()
    } catch (error: any) {
      console.error('Failed to save prompt:', error)
      addNotification({
        type: 'error',
        title: 'Failed to save prompt',
        message: error.response?.data?.error || 'Could not save your prompt',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeleting(true)
    try {
      await api.delete(`/api/prompts/${id}`)
      addNotification({
        type: 'success',
        title: 'Prompt deleted',
        message: 'Your prompt has been deleted successfully',
      })
      setDeleteModalOpen(null)
      loadPrompts()
    } catch (error: any) {
      console.error('Failed to delete prompt:', error)
      addNotification({
        type: 'error',
        title: 'Failed to delete prompt',
        message: error.response?.data?.error || 'Could not delete your prompt',
      })
    } finally {
      setDeleting(false)
    }
  }

  const handleSeedDefaults = async () => {
    setSeeding(true)
    const defaults = config.defaults

    try {
      for (const p of defaults) {
        await api.post('/api/prompts', { ...p, category: activeTab })
      }
      addNotification({
        type: 'success',
        title: 'Defaults Added',
        message: `Added ${defaults.length} ${activeTab.toLowerCase()} templates.`
      })
      loadPrompts()
    } catch (error) {
      console.error('Failed to seed defaults', error)
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to add default templates.'
      })
    } finally {
      setSeeding(false)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="space-y-8">
          <Skeleton className="h-32 rounded-[28px]" />
          <Skeleton className="h-96 rounded-3xl" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div className="rounded-[28px] border border-white/40 bg-white/80 p-6 sm:p-8 shadow-[0_35px_80px_-50px_rgba(79,70,229,0.6)] backdrop-blur-xl">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-slate-400">
                PROMPTS
              </p>
              <h1 className="mt-3 text-2xl sm:text-3xl font-semibold text-primary">
                {config.label} Prompts
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                {config.description}
              </p>
            </div>
            <div className="flex items-center gap-3 self-end sm:self-center">
              <div className="hidden sm:flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-400 text-white shadow-md">
                <config.icon className="h-5 w-5" />
              </div>
              <Button onClick={handleCreate} leftIcon={<Plus className="h-4 w-4" />}>
                Add {config.label}
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-8 flex gap-2 border-b border-slate-200">
            {(Object.keys(CATEGORY_CONFIG) as CategoryType[]).map((tab) => {
              const isActive = activeTab === tab
              const TabIcon = CATEGORY_CONFIG[tab].icon
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all relative ${isActive
                    ? 'text-brand-600'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-t-lg'
                    }`}
                >
                  <TabIcon className={`w-4 h-4 ${isActive ? 'text-brand-500' : 'text-slate-400'}`} />
                  {tab}
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500 rounded-t-full" />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {filteredPrompts.length === 0 ? (
          <EmptyState
            icon={<config.icon className="w-16 h-16" />}
            title={`No ${activeTab.toLowerCase()} prompts yet`}
            description={`Start by adding a ${activeTab.toLowerCase()} prompt or use our templates.`}
            action={
              <div className="flex gap-3">
                <Button onClick={handleCreate} leftIcon={<Plus className="h-4 w-4" />}>
                  Add {config.label}
                </Button>
                <Button variant="secondary" onClick={handleSeedDefaults} loading={seeding} leftIcon={<Copy className="h-4 w-4" />}>
                  Use Templates
                </Button>
              </div>
            }
          />
        ) : (
          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 w-1/4">{config.columns.name}</th>
                    <th className="px-6 py-4 w-1/4">{config.columns.description}</th>
                    <th className="px-6 py-4 w-1/4">{config.columns.why_important}</th>
                    <th className="px-6 py-4 w-1/4">{config.columns.useful_tips}</th>
                    <th className="px-6 py-4 w-20 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPrompts.map((prompt) => (
                    <tr key={prompt.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 align-top font-medium text-slate-900">
                        {prompt.name}
                      </td>
                      <td className="px-6 py-4 align-top text-slate-600 whitespace-pre-wrap">
                        {prompt.description || <span className="text-slate-300 italic">-</span>}
                      </td>
                      <td className="px-6 py-4 align-top text-slate-600 whitespace-pre-wrap">
                        {prompt.why_important || <span className="text-slate-300 italic">-</span>}
                      </td>
                      <td className="px-6 py-4 align-top text-slate-600 whitespace-pre-wrap">
                        {prompt.useful_tips || <span className="text-slate-300 italic">-</span>}
                      </td>
                      <td className="px-6 py-4 align-top text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEdit(prompt)}
                            className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteModalOpen(prompt.id)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Create/Edit Modal */}
        <Modal
          isOpen={createModalOpen}
          onClose={() => {
            setCreateModalOpen(false)
            setEditingPrompt(null)
          }}
          title={editingPrompt ? `Edit ${config.label}` : `Add ${config.label}`}
          size="lg"
        >
          <div className="space-y-6">
            <Input
              label={`${config.columns.name} *`}
              placeholder={config.placeholders.name}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />

            <Textarea
              label={config.columns.description}
              placeholder={config.placeholders.description}
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />

            <Textarea
              label={config.columns.why_important}
              placeholder={config.placeholders.why_important}
              rows={3}
              value={formData.why_important}
              onChange={(e) => setFormData({ ...formData, why_important: e.target.value })}
            />

            <Textarea
              label={config.columns.useful_tips}
              placeholder={config.placeholders.useful_tips}
              rows={5}
              value={formData.useful_tips}
              onChange={(e) => setFormData({ ...formData, useful_tips: e.target.value })}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="ghost"
                onClick={() => {
                  setCreateModalOpen(false)
                  setEditingPrompt(null)
                }}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} loading={saving} leftIcon={<Save className="h-4 w-4" />}>
                {editingPrompt ? 'Save Changes' : 'Add'}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal
          isOpen={deleteModalOpen !== null}
          onClose={() => setDeleteModalOpen(null)}
          title="Delete Prompt"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Are you sure you want to delete this prompt? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setDeleteModalOpen(null)} disabled={deleting}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => deleteModalOpen && handleDelete(deleteModalOpen)}
                loading={deleting}
                leftIcon={<Trash2 className="h-4 w-4" />}
              >
                Delete
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </Layout>
  )
}
