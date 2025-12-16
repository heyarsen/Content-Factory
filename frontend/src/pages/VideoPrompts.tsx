import { useState, useEffect } from 'react'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { Modal } from '../components/ui/Modal'
import { EmptyState } from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'
import {
  Sparkles,
  Plus,
  Edit2,
  Trash2,
  Save,
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

  const [formData, setFormData] = useState({
    name: '',
    topic: '',
    category: '',
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
      topic: '',
      category: '',
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
      topic: prompt.topic || '',
      category: prompt.category || '',
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
        message: 'Prompt name is required',
      })
      return
    }

    setSaving(true)
    try {
      if (editingPrompt) {
        // Update existing prompt
        await api.put(`/api/prompts/${editingPrompt.id}`, formData)
        addNotification({
          type: 'success',
          title: 'Prompt updated',
          message: 'Your prompt has been updated successfully',
        })
      } else {
        // Create new prompt
        await api.post('/api/prompts', formData)
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

  if (loading) {
    return (
      <Layout>
        <div className="space-y-8">
          <Skeleton className="h-32 rounded-[28px]" />
          <div className="grid gap-6 lg:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-80 rounded-3xl" />
            ))}
          </div>
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
                prompts
              </p>
              <h1 className="mt-3 text-2xl sm:text-3xl font-semibold text-primary">
                Video Prompts
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                Create and manage reusable prompts for your video planning. These prompts can be
                used to quickly fill in video details when creating new videos.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-400 text-white shadow-md">
                <Sparkles className="h-5 w-5" />
              </div>
              <Button onClick={handleCreate} leftIcon={<Plus className="h-4 w-4" />}>
                Create Prompt
              </Button>
            </div>
          </div>
        </div>

        {prompts.length === 0 ? (
          <EmptyState
            icon={<Sparkles className="w-16 h-16" />}
            title="No prompts yet"
            description="Create your first prompt template to speed up video planning."
            action={
              <Button onClick={handleCreate} leftIcon={<Plus className="h-4 w-4" />}>
                Create Your First Prompt
              </Button>
            }
          />
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {prompts.map((prompt) => (
              <Card key={prompt.id} className="flex h-full flex-col gap-4 p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <h2 className="text-base sm:text-lg font-semibold text-primary">
                      {prompt.name}
                    </h2>
                    {prompt.category && (
                      <p className="text-xs font-medium text-slate-500">
                        Category: <span className="text-slate-700">{prompt.category}</span>
                      </p>
                    )}
                    {prompt.topic && (
                      <p className="text-xs text-slate-600 line-clamp-2">
                        <span className="font-medium">Topic:</span> {prompt.topic}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(prompt)}
                      leftIcon={<Edit2 className="h-3.5 w-3.5" />}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteModalOpen(prompt.id)}
                      leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                      className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                    >
                      Delete
                    </Button>
                  </div>
                </div>

                <div className="flex-1 space-y-3 text-sm">
                  {prompt.description && (
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                        Description
                      </p>
                      <p className="text-slate-600 line-clamp-3">{prompt.description}</p>
                    </div>
                  )}
                  {prompt.why_important && (
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                        Why Important
                      </p>
                      <p className="text-slate-600 line-clamp-2">{prompt.why_important}</p>
                    </div>
                  )}
                  {prompt.useful_tips && (
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                        Useful Tips
                      </p>
                      <p className="text-slate-600 line-clamp-2">{prompt.useful_tips}</p>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-white/60 text-xs text-slate-400">
                  Created {new Date(prompt.created_at).toLocaleDateString()}
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Create/Edit Modal */}
        <Modal
          isOpen={createModalOpen}
          onClose={() => {
            setCreateModalOpen(false)
            setEditingPrompt(null)
          }}
          title={editingPrompt ? 'Edit Prompt' : 'Create New Prompt'}
          size="lg"
        >
          <div className="space-y-6">
            <Input
              label="Prompt Name *"
              placeholder="e.g., Trading Tips Template"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Topic (optional)"
                placeholder="e.g., Trading mistakes"
                value={formData.topic}
                onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
              />
              <Input
                label="Category (optional)"
                placeholder="e.g., Trading, Lifestyle"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              />
            </div>

            <Textarea
              label="Description (optional)"
              placeholder="Describe what this prompt is for..."
              rows={4}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />

            <Textarea
              label="Why Important (optional)"
              placeholder="Why should viewers care about this topic?"
              rows={3}
              value={formData.why_important}
              onChange={(e) => setFormData({ ...formData, why_important: e.target.value })}
            />

            <Textarea
              label="Useful Tips (optional)"
              placeholder="Any key points or tips to include?"
              rows={3}
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
                {editingPrompt ? 'Update Prompt' : 'Create Prompt'}
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
