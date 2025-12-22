import { useState, useEffect } from 'react'
import { Layout } from '../components/layout/Layout'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { Modal } from '../components/ui/Modal'
import { EmptyState } from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Save,
  FileText,
  Copy
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
        message: 'Topic is required',
      })
      return
    }

    setSaving(true)
    try {
      if (editingPrompt) {
        await api.put(`/api/prompts/${editingPrompt.id}`, {
          ...formData,
          // Preserve other fields or set them to null if not used
          topic: null,
          category: 'Research'
        })
        addNotification({
          type: 'success',
          title: 'Research prompt updated',
          message: 'Your research prompt has been updated successfully',
        })
      } else {
        await api.post('/api/prompts', {
          ...formData,
          topic: null,
          category: 'Research'
        })
        addNotification({
          type: 'success',
          title: 'Research prompt created',
          message: 'Your new research prompt has been created successfully',
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
    const defaults = [
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

    try {
      for (const p of defaults) {
        await api.post('/api/prompts', { ...p, category: 'Research' })
      }
      addNotification({
        type: 'success',
        title: 'Defaults Added',
        message: 'Added 4 research templates to your list.'
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
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-slate-400">
                RESEARCH
              </p>
              <h1 className="mt-3 text-2xl sm:text-3xl font-semibold text-primary">
                Research Prompts
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                Manage your research topics and findings. Use these prompts to organize your content research.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-400 text-white shadow-md">
                <FileText className="h-5 w-5" />
              </div>
              <Button onClick={handleCreate} leftIcon={<Plus className="h-4 w-4" />}>
                Add Research Topic
              </Button>
            </div>
          </div>
        </div>

        {prompts.length === 0 ? (
          <EmptyState
            icon={<Search className="w-16 h-16" />}
            title="No research prompts yet"
            description="Start by adding a research topic or use our templates."
            action={
              <div className="flex gap-3">
                <Button onClick={handleCreate} leftIcon={<Plus className="h-4 w-4" />}>
                  Add Research Topic
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
                    <th className="px-6 py-4 w-1/4">Topic</th>
                    <th className="px-6 py-4 w-1/4">Research Goal</th>
                    <th className="px-6 py-4 w-1/4">Key Questions</th>
                    <th className="px-6 py-4 w-1/4">Notes / Findings</th>
                    <th className="px-6 py-4 w-20 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {prompts.map((prompt) => (
                    <tr key={prompt.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 align-top font-medium text-slate-900">
                        {prompt.name}
                      </td>
                      <td className="px-6 py-4 align-top text-slate-600">
                        {prompt.description || <span className="text-slate-300 italic">No goal set</span>}
                      </td>
                      <td className="px-6 py-4 align-top text-slate-600">
                        {prompt.why_important || <span className="text-slate-300 italic">-</span>}
                      </td>
                      <td className="px-6 py-4 align-top text-slate-600">
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
          title={editingPrompt ? 'Edit Research Topic' : 'Add Research Topic'}
          size="lg"
        >
          <div className="space-y-6">
            <Input
              label="Topic *"
              placeholder="e.g., Competitor Analysis"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />

            <Textarea
              label="Research Goal"
              placeholder="What are you trying to find out?"
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />

            <Textarea
              label="Key Questions"
              placeholder="Specific questions to answer..."
              rows={3}
              value={formData.why_important}
              onChange={(e) => setFormData({ ...formData, why_important: e.target.value })}
            />

            <Textarea
              label="Notes / Findings"
              placeholder="Paste your research notes here..."
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
                {editingPrompt ? 'Save Changes' : 'Add Topic'}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal
          isOpen={deleteModalOpen !== null}
          onClose={() => setDeleteModalOpen(null)}
          title="Delete Research Topic"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Are you sure you want to delete this research topic? This action cannot be undone.
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
