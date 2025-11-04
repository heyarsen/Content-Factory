import { useState, useEffect } from 'react'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { Modal } from '../components/ui/Modal'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'
import { Plus, Edit2, Trash2, Tag } from 'lucide-react'
import api from '../lib/api'

interface Category {
  id: string
  name: string
  category_key: string
  description: string | null
  status: 'active' | 'inactive'
  sort_order: number
}

export function Categories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [createModal, setCreateModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    category_key: '',
    description: '',
    status: 'active' as 'active' | 'inactive',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadCategories()
  }, [])

  const loadCategories = async () => {
    try {
      const response = await api.get('/api/content')
      setCategories(response.data.categories || [])
    } catch (error) {
      console.error('Failed to load categories:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!formData.name || !formData.category_key) {
      alert('Name and category key are required')
      return
    }

    setSaving(true)
    try {
      await api.post('/api/content/categories', {
        name: formData.name,
        category_key: formData.category_key.toLowerCase().replace(/\s+/g, '_'),
        description: formData.description || '',
        status: formData.status,
      })
      await loadCategories()
      setCreateModal(false)
      resetForm()
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create category')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!editingCategory || !formData.name || !formData.category_key) {
      alert('Name and category key are required')
      return
    }

    setSaving(true)
    try {
      await api.put(`/api/content/categories/${editingCategory.id}`, {
        name: formData.name,
        category_key: formData.category_key.toLowerCase().replace(/\s+/g, '_'),
        description: formData.description || '',
        status: formData.status,
      })
      await loadCategories()
      setEditingCategory(null)
      resetForm()
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update category')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (category: Category) => {
    if (!confirm(`Are you sure you want to delete "${category.name}"? This action cannot be undone.`)) {
      return
    }

    try {
      await api.delete(`/api/content/categories/${category.id}`)
      await loadCategories()
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete category')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      category_key: '',
      description: '',
      status: 'active',
    })
  }

  const openEdit = (category: Category) => {
    setEditingCategory(category)
    setFormData({
      name: category.name,
      category_key: category.category_key,
      description: category.description || '',
      status: category.status,
    })
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
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Settings</p>
            <h1 className="text-3xl font-semibold text-primary">Categories</h1>
            <p className="text-sm text-slate-500">
              Manage your content categories. Create custom categories for organizing your videos.
            </p>
          </div>
          <Button onClick={() => setCreateModal(true)} leftIcon={<Plus className="h-4 w-4" />}>
            New Category
          </Button>
        </div>

        {/* Categories List */}
        {categories.length === 0 ? (
          <EmptyState
            icon={<Tag className="w-16 h-16" />}
            title="No categories yet"
            description="Create your first category to organize your content."
            action={
              <Button onClick={() => setCreateModal(true)} leftIcon={<Plus className="h-4 w-4" />}>
                Create Category
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => (
              <Card key={category.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-primary">{category.name}</h3>
                      <Badge variant={category.status === 'active' ? 'success' : 'default'}>
                        {category.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Key: {category.category_key}</p>
                    {category.description && (
                      <p className="mt-2 text-sm text-slate-600">{category.description}</p>
                    )}
                  </div>
                  <div className="ml-4 flex gap-2">
                    <button
                      onClick={() => openEdit(category)}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(category)}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Create Modal */}
        <Modal
          isOpen={createModal}
          onClose={() => {
            setCreateModal(false)
            resetForm()
          }}
          title="Create Category"
        >
          <div className="space-y-4">
            <Input
              label="Name"
              placeholder="e.g., Trading"
              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value })
                if (!formData.category_key) {
                  setFormData({
                    ...formData,
                    name: e.target.value,
                    category_key: e.target.value.toLowerCase().replace(/\s+/g, '_'),
                  })
                }
              }}
              required
            />
            <Input
              label="Category Key"
              placeholder="e.g., trading"
              value={formData.category_key}
              onChange={(e) => setFormData({ ...formData, category_key: e.target.value })}
              required
            />
            <Textarea
              label="Description"
              placeholder="Describe this category..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="ghost"
                onClick={() => {
                  setCreateModal(false)
                  resetForm()
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleCreate} loading={saving}>
                Create
              </Button>
            </div>
          </div>
        </Modal>

        {/* Edit Modal */}
        <Modal
          isOpen={!!editingCategory}
          onClose={() => {
            setEditingCategory(null)
            resetForm()
          }}
          title="Edit Category"
        >
          <div className="space-y-4">
            <Input
              label="Name"
              placeholder="e.g., Trading"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <Input
              label="Category Key"
              placeholder="e.g., trading"
              value={formData.category_key}
              onChange={(e) => setFormData({ ...formData, category_key: e.target.value })}
              required
            />
            <Textarea
              label="Description"
              placeholder="Describe this category..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="status"
                checked={formData.status === 'active'}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.checked ? 'active' : 'inactive' })
                }
                className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
              />
              <label htmlFor="status" className="text-sm text-slate-700">
                Active
              </label>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="ghost"
                onClick={() => {
                  setEditingCategory(null)
                  resetForm()
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleUpdate} loading={saving}>
                Save Changes
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </Layout>
  )
}
