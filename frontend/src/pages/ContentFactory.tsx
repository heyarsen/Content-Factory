import { useEffect, useMemo, useState } from 'react'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { Select } from '../components/ui/Select'
import { Badge } from '../components/ui/Badge'
import { Skeleton } from '../components/ui/Skeleton'
import api from '../lib/api'
import { CheckCircle2, Plus, RefreshCw, Save, Trash2 } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'

type TabKey = 'categories' | 'ideas' | 'research' | 'script'

interface Category {
  id: string
  category_key: string
  name: string
  status: 'active' | 'inactive'
  description: string
  sort_order: number
}

interface IdeasPrompt {
  id: string
  template_key: string
  status: 'active' | 'inactive'
  lang: string
  persona: string
  business_model: string
  focus: string
  categories: string
}

interface ResearchPrompt {
  id: string
  template_key: string
  status: 'active' | 'inactive'
  lang: string
  persona: string
  core_message: string
  rules: string
  notes: string
}

interface ScriptPrompt {
  id: string
  template_key: string
  status: 'active' | 'inactive'
  lang: string
  persona: string
  duration: string
  word_range: string
  tone: string
  structure: string
  rules: string
}

interface ContentResponse {
  categories: Category[]
  prompts: {
    ideas: IdeasPrompt | null
    research: ResearchPrompt | null
    script: ScriptPrompt | null
  }
}

interface Feedback {
  type: 'success' | 'error'
  message: string
}

function slugify(source: string) {
  return source
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function SectionTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl px-4 py-2 text-sm font-medium transition focus:outline-none whitespace-nowrap ${active
        ? 'bg-gradient-to-r from-brand-500/10 via-brand-500/5 to-transparent text-brand-600 shadow-[0_12px_40px_-25px_rgba(99,102,241,0.9)]'
        : 'text-slate-500 hover:bg-white hover:text-primary'
        }`}
    >
      {label}
    </button>
  )
}

function FeedbackBanner({ feedback, onDismiss }: { feedback: Feedback | null; onDismiss: () => void }) {
  const { t } = useLanguage()
  if (!feedback) return null

  const baseClasses = 'flex items-center justify-between rounded-2xl border px-4 py-3 text-sm'
  const palette =
    feedback.type === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : 'border-rose-200 bg-rose-50 text-rose-600'

  return (
    <div className={`${baseClasses} ${palette}`}>
      <span className="flex items-center gap-2">
        {feedback.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
        {feedback.message}
      </span>
      <button className="text-xs font-medium uppercase tracking-wide text-slate-400" onClick={onDismiss}>
        {t('content_factory.dismiss')}
      </button>
    </div>
  )
}

function CategoryEditor({
  category,
  onUpdated,
  onDeleted,
  onError,
}: {
  category: Category
  onUpdated: (category: Category) => void
  onDeleted: (categoryId: string) => void
  onError: (message: string) => void
}) {
  const { t } = useLanguage()
  const [form, setForm] = useState(() => ({
    category_key: category.category_key,
    name: category.name,
    status: category.status,
    description: category.description,
  }))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setForm({
      category_key: category.category_key,
      name: category.name,
      status: category.status,
      description: category.description,
    })
  }, [category])

  const isDirty =
    form.category_key !== category.category_key ||
    form.name !== category.name ||
    form.status !== category.status ||
    form.description !== (category.description || '')

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await api.put(`/api/content/categories/${category.id}`, {
        ...form,
      })
      onUpdated(response.data.category)
    } catch (error: any) {
      console.error('Failed to update category:', error)
      onError(error.response?.data?.error || 'Failed to update category')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(t('content_factory.remove_category_confirm'))) return
    setDeleting(true)
    try {
      await api.delete(`/api/content/categories/${category.id}`)
      onDeleted(category.id)
    } catch (error: any) {
      console.error('Failed to delete category:', error)
      onError(error.response?.data?.error || 'Failed to delete category')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">{t('content_factory.category')}</span>
          <span className="text-base font-semibold text-primary">{category.name}</span>
        </div>
        <Badge variant={form.status === 'active' ? 'success' : 'default'}>{form.status}</Badge>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Input
          label={t('content_factory.display_name')}
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          placeholder={t('content_factory.display_name_placeholder_trading')}
        />
        <Input
          label={t('content_factory.category_key_system')}
          value={form.category_key}
          onChange={(e) => setForm((prev) => ({ ...prev, category_key: e.target.value }))}
          placeholder="trading"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Select
          label={t('content_factory.status')}
          value={form.status}
          onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as 'active' | 'inactive' }))}
          options={[
            { value: 'active', label: t('content_factory.active') },
            { value: 'inactive', label: t('content_factory.inactive') },
          ]}
        />
        <div className="rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-xs text-slate-500">
          <p className="font-semibold text-slate-600">{t('content_factory.guideline')}</p>
          <p className="mt-1">
            {t('content_factory.guideline_copy')}
          </p>
        </div>
      </div>

      <Textarea
        label={t('content_factory.description')}
        rows={5}
        value={form.description}
        onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
        placeholder={t('content_factory.description_placeholder')}
      />

      <div className="flex flex-col gap-3 pt-2 sm:flex-row">
        <Button
          onClick={handleSave}
          disabled={!isDirty}
          className="sm:w-auto"
          loading={saving}
          leftIcon={!saving ? <Save className="h-4 w-4" /> : undefined}
        >
          {t('content_factory.save_changes')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="border border-white/50 text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 sm:w-auto"
          onClick={handleDelete}
          loading={deleting}
          leftIcon={!deleting ? <Trash2 className="h-4 w-4" /> : undefined}
        >
          {t('content_factory.remove')}
        </Button>
      </div>
    </Card>
  )
}

function NewCategoryCard({
  onCreated,
  onCancel,
  onError,
}: {
  onCreated: (category: Category) => void
  onCancel: () => void
  onError: (message: string) => void
}) {

  const { t } = useLanguage()
  const [name, setName] = useState('')
  const [categoryKey, setCategoryKey] = useState('')
  const [status, setStatus] = useState<'active' | 'inactive'>('active')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [keyTouched, setKeyTouched] = useState(false)

  useEffect(() => {
    if (!keyTouched) {
      setCategoryKey(slugify(name))
    }
  }, [name, keyTouched])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !categoryKey) {
      onError(t('content_factory.name_and_key_required'))
      return
    }

    setSaving(true)
    try {
      const response = await api.post('/api/content/categories', {
        name,
        category_key: categoryKey,
        status,
        description,
      })
      onCreated(response.data.category)
      setName('')
      setCategoryKey('')
      setDescription('')
      setStatus('active')
      onCancel()
    } catch (error: any) {
      console.error('Failed to create category:', error)
      onError(error.response?.data?.error || 'Failed to create category')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="p-6">
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">{t('content_factory.new_category')}</span>
            <h3 className="mt-1 text-xl font-semibold text-primary">{t('content_factory.launch_fresh_theme')}</h3>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <Input
            label={t('content_factory.display_name')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('content_factory.display_name_placeholder_mindset')}
            required
          />
          <Input
            label={t('content_factory.category_key_system')}
            value={categoryKey}
            onChange={(e) => {
              setKeyTouched(true)
              setCategoryKey(e.target.value)
            }}
            placeholder="mindset"
            required
          />
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <Select
            label={t('content_factory.status')}
            value={status}
            onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
            options={[
              { value: 'active', label: t('content_factory.active') },
              { value: 'inactive', label: t('content_factory.inactive') },
            ]}
          />
          <div className="rounded-2xl border border-dashed border-brand-200/60 bg-brand-50/30 px-4 py-3 text-xs text-brand-700">
            {t('content_factory.short_key_hint')}
          </div>
        </div>

        <Textarea
          label={t('content_factory.description')}
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('content_factory.description_placeholder_short')}
        />

        <div className="flex flex-col gap-3 pt-2 sm:flex-row">
          <Button type="submit" className="sm:w-auto" loading={saving} leftIcon={!saving ? <Save className="h-4 w-4" /> : undefined}>
            {t('content_factory.create_category')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="border border-white/60 text-slate-500 hover:border-slate-200 hover:bg-white sm:w-auto"
            onClick={onCancel}
            disabled={saving}
          >
            {t('common.cancel')}
          </Button>
        </div>
      </form>
    </Card>
  )
}

function IdeasPromptForm({
  prompt,
  onSaved,
  onError,
}: {
  prompt: IdeasPrompt | null
  onSaved: (prompt: IdeasPrompt) => void
  onError: (message: string) => void
}) {

  const { t } = useLanguage()
  const [form, setForm] = useState(() =>
    prompt
      ? {
        persona: prompt.persona,
        business_model: prompt.business_model,
        focus: prompt.focus,
        categories: prompt.categories,
      }
      : null
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (prompt) {
      setForm({
        persona: prompt.persona,
        business_model: prompt.business_model,
        focus: prompt.focus,
        categories: prompt.categories,
      })
    }
  }, [prompt])

  if (!prompt || !form) {
    return (
      <Card className="p-6 text-sm text-slate-500">
        {t('content_factory.default_prompt_not_available')}
      </Card>
    )
  }

  const isDirty =
    form.persona !== prompt.persona ||
    form.business_model !== prompt.business_model ||
    form.focus !== prompt.focus ||
    form.categories !== prompt.categories

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await api.put(`/api/content/prompts/${prompt.id}`, form)
      onSaved(response.data.prompt)
    } catch (error: any) {
      console.error('Failed to update idea prompt:', error)
      onError(error.response?.data?.error || 'Failed to update idea prompt')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">{t('content_factory.prompt_dna')}</p>
          <h3 className="mt-1 text-2xl font-semibold text-primary">{t('content_factory.idea_generation_rules')}</h3>
        </div>
        <Badge variant="default">ID: {prompt.template_key}</Badge>
      </div>

      <Textarea
        label={t('content_factory.persona')}
        rows={8}
        value={form.persona}
        onChange={(e) => setForm({ ...form, persona: e.target.value })}
        placeholder={t('content_factory.persona_placeholder_ideas')}
      />

      <Textarea
        label={t('content_factory.business_model')}
        rows={6}
        value={form.business_model}
        onChange={(e) => setForm({ ...form, business_model: e.target.value })}
        placeholder={t('content_factory.business_model_placeholder')}
      />

      <Textarea
        label={t('content_factory.focus_filters')}
        rows={6}
        value={form.focus}
        onChange={(e) => setForm({ ...form, focus: e.target.value })}
        placeholder={t('content_factory.focus_filters_placeholder')}
      />

      <Input
        label={t('content_factory.allowed_categories')}
        value={form.categories}
        onChange={(e) => setForm({ ...form, categories: e.target.value })}
        placeholder={t('content_factory.allowed_categories_placeholder')}
      />

      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={!isDirty} loading={saving} leftIcon={!saving ? <Save className="h-4 w-4" /> : undefined}>
          {t('content_factory.save_prompt')}
        </Button>
      </div>
    </Card>
  )
}

function ResearchPromptForm({
  prompt,
  onSaved,
  onError,
}: {
  prompt: ResearchPrompt | null
  onSaved: (prompt: ResearchPrompt) => void
  onError: (message: string) => void
}) {

  const { t } = useLanguage()
  const [form, setForm] = useState(() =>
    prompt
      ? {
        persona: prompt.persona,
        core_message: prompt.core_message,
        rules: prompt.rules,
        notes: prompt.notes,
      }
      : null
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (prompt) {
      setForm({
        persona: prompt.persona,
        core_message: prompt.core_message,
        rules: prompt.rules,
        notes: prompt.notes,
      })
    }
  }, [prompt])

  if (!prompt || !form) {
    return (
      <Card className="p-6 text-sm text-slate-500">
        {t('content_factory.default_prompt_not_available')}
      </Card>
    )
  }

  const isDirty =
    form.persona !== prompt.persona ||
    form.core_message !== prompt.core_message ||
    form.rules !== prompt.rules ||
    form.notes !== prompt.notes

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await api.put(`/api/content/prompts/${prompt.id}`, form)
      onSaved(response.data.prompt)
    } catch (error: any) {
      console.error('Failed to update research prompt:', error)
      onError(error.response?.data?.error || 'Failed to update research prompt')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">{t('content_factory.prompt_dna')}</p>
          <h3 className="mt-1 text-2xl font-semibold text-primary">{t('content_factory.research_synthesis_rules')}</h3>
        </div>
        <Badge variant="default">ID: {prompt.template_key}</Badge>
      </div>

      <Textarea
        label={t('content_factory.persona')}
        rows={8}
        value={form.persona}
        onChange={(e) => setForm({ ...form, persona: e.target.value })}
        placeholder={t('content_factory.persona_placeholder_research')}
      />

      <Textarea
        label={t('content_factory.core_message')}
        rows={6}
        value={form.core_message}
        onChange={(e) => setForm({ ...form, core_message: e.target.value })}
        placeholder={t('content_factory.core_message_placeholder')}
      />

      <Textarea
        label={t('content_factory.rules')}
        rows={6}
        value={form.rules}
        onChange={(e) => setForm({ ...form, rules: e.target.value })}
        placeholder={t('content_factory.rules_placeholder')}
      />

      <Textarea
        label={t('content_factory.notes')}
        rows={4}
        value={form.notes}
        onChange={(e) => setForm({ ...form, notes: e.target.value })}
        placeholder={t('content_factory.notes_placeholder')}
      />

      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={!isDirty} loading={saving} leftIcon={!saving ? <Save className="h-4 w-4" /> : undefined}>
          {t('content_factory.save_prompt')}
        </Button>
      </div>
    </Card>
  )
}

function ScriptPromptForm({
  prompt,
  onSaved,
  onError,
}: {
  prompt: ScriptPrompt | null
  onSaved: (prompt: ScriptPrompt) => void
  onError: (message: string) => void
}) {

  const { t } = useLanguage()
  const [form, setForm] = useState(() =>
    prompt
      ? {
        duration: prompt.duration,
        word_range: prompt.word_range,
        tone: prompt.tone,
        structure: prompt.structure,
        rules: prompt.rules,
      }
      : null
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (prompt) {
      setForm({
        duration: prompt.duration,
        word_range: prompt.word_range,
        tone: prompt.tone,
        structure: prompt.structure,
        rules: prompt.rules,
      })
    }
  }, [prompt])

  if (!prompt || !form) {
    return (
      <Card className="p-6 text-sm text-slate-500">
        {t('content_factory.default_prompt_not_available')}
      </Card>
    )
  }

  const isDirty =
    form.duration !== prompt.duration ||
    form.word_range !== prompt.word_range ||
    form.tone !== prompt.tone ||
    form.structure !== prompt.structure ||
    form.rules !== prompt.rules

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await api.put(`/api/content/prompts/${prompt.id}`, form)
      onSaved(response.data.prompt)
    } catch (error: any) {
      console.error('Failed to update script prompt:', error)
      onError(error.response?.data?.error || 'Failed to update script prompt')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">{t('content_factory.prompt_dna')}</p>
          <h3 className="mt-1 text-2xl font-semibold text-primary">{t('content_factory.script_writing_rules')}</h3>
        </div>
        <Badge variant="default">ID: {prompt.template_key}</Badge>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Input
          label={t('content_factory.duration')}
          value={form.duration}
          onChange={(e) => setForm({ ...form, duration: e.target.value })}
        />
        <Input
          label={t('content_factory.word_range')}
          value={form.word_range}
          onChange={(e) => setForm({ ...form, word_range: e.target.value })}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Input
          label={t('content_factory.tone')}
          value={form.tone}
          onChange={(e) => setForm({ ...form, tone: e.target.value })}
        />
        <Input
          label={t('content_factory.structure')}
          value={form.structure}
          onChange={(e) => setForm({ ...form, structure: e.target.value })}
        />
      </div>

      <Textarea
        label={t('content_factory.rules')}
        rows={6}
        value={form.rules}
        onChange={(e) => setForm({ ...form, rules: e.target.value })}
      />

      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={!isDirty} loading={saving} leftIcon={!saving ? <Save className="h-4 w-4" /> : undefined}>
          {t('content_factory.save_prompt')}
        </Button>
      </div>
    </Card>
  )
}

export function ContentFactory() {

  const { t } = useLanguage()
  const [activeTab, setActiveTab] = useState<TabKey>('categories')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [prompts, setPrompts] = useState<{ ideas: IdeasPrompt | null; research: ResearchPrompt | null; script: ScriptPrompt | null }>(
    {
      ideas: null,
      research: null,
      script: null,
    }
  )
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [creatingCategory, setCreatingCategory] = useState(false)

  useEffect(() => {
    loadContent()
  }, [])

  const loadContent = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.get<ContentResponse>('/api/content')
      setCategories(response.data.categories || [])
      setPrompts(response.data.prompts || { ideas: null, research: null, script: null })
    } catch (err: any) {
      console.error('Failed to load content settings:', err)
      setError(err.response?.data?.error || 'Failed to load content settings')
    } finally {
      setLoading(false)
    }
  }

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    [categories]
  )

  const handleCategoryUpdated = (updated: Category) => {
    setCategories((prev) => prev.map((category) => (category.id === updated.id ? updated : category)))
    setFeedback({ type: 'success', message: t('content_factory.category_updated') })
  }

  const handleCategoryDeleted = (categoryId: string) => {
    setCategories((prev) => prev.filter((category) => category.id !== categoryId))
    setFeedback({ type: 'success', message: t('content_factory.category_removed') })
  }

  const handleCategoryCreated = (category: Category) => {
    setCategories((prev) => [...prev, category])
    setFeedback({ type: 'success', message: t('content_factory.category_created') })
  }

  const handlePromptSaved = (updated: IdeasPrompt | ResearchPrompt | ScriptPrompt) => {
    setPrompts((prev) => ({
      ideas: updated.template_key === prev.ideas?.template_key ? (updated as IdeasPrompt) : prev.ideas,
      research: updated.template_key === prev.research?.template_key ? (updated as ResearchPrompt) : prev.research,
      script: updated.template_key === prev.script?.template_key ? (updated as ScriptPrompt) : prev.script,
    }))
    setFeedback({ type: 'success', message: t('content_factory.prompt_updated') })
  }

  const handleError = (message: string) => {
    setFeedback({ type: 'error', message })
  }

  const renderCategories = () => {
    if (loading) {
      return (
        <div className="space-y-6">
          {[1, 2].map((item) => (
            <Skeleton key={item} className="h-40 rounded-3xl" />
          ))}
        </div>
      )
    }

    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <Card className="flex-1 space-y-4 border border-dashed border-brand-200/60 bg-brand-50/30 p-6">
            <p className="text-sm font-semibold text-brand-700">{t('content_factory.migrated_from_sheets')}</p>
            <ul className="space-y-2 text-sm text-brand-700">
              <li>• {t('content_factory.migration_point_1')}</li>
              <li>• {t('content_factory.migration_point_2')}</li>
              <li>• {t('content_factory.migration_point_3')}</li>
            </ul>
          </Card>
          <Button
            onClick={() => setCreatingCategory(true)}
            className="h-max rounded-2xl bg-gradient-to-r from-brand-500 to-indigo-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_20px_60px_-30px_rgba(79,70,229,0.8)] hover:shadow-[0_25px_80px_-40px_rgba(79,70,229,0.9)]"
            leftIcon={<Plus className="h-4 w-4" />}
          >
            {t('content_factory.new_category')}
          </Button>
        </div>

        {creatingCategory && (
          <NewCategoryCard
            onCreated={handleCategoryCreated}
            onCancel={() => setCreatingCategory(false)}
            onError={handleError}
          />
        )}

        {sortedCategories.length === 0 ? (
          <Card className="rounded-3xl border border-dashed border-slate-200 bg-white/70 p-10 text-center text-sm text-slate-500">
            {t('content_factory.no_categories_yet')}
          </Card>
        ) : (
          <div className="space-y-6">
            {sortedCategories.map((category) => (
              <CategoryEditor
                key={category.id}
                category={category}
                onUpdated={handleCategoryUpdated}
                onDeleted={handleCategoryDeleted}
                onError={handleError}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  const renderPrompts = () => {
    if (loading) {
      return (
        <div className="space-y-6">
          <Skeleton className="h-24 rounded-[28px]" />
          <Skeleton className="h-96 rounded-3xl" />
        </div>
      )
    }

    if (activeTab === 'ideas') {
      return (
        <div className="space-y-6">
          <Card className="space-y-3 border border-dashed border-brand-200/60 bg-brand-50/30 p-6 text-sm text-brand-700">
            <p className="font-semibold">{t('content_factory.idea_prompts_intro')}</p>
            <ul className="space-y-1">
              <li>• {t('content_factory.idea_prompt_point_1')}</li>
              <li>• {t('content_factory.idea_prompt_point_2')}</li>
              <li>• {t('content_factory.idea_prompt_point_3')}</li>
            </ul>
          </Card>
          <IdeasPromptForm prompt={prompts.ideas} onSaved={handlePromptSaved} onError={handleError} />
        </div>
      )
    }

    if (activeTab === 'research') {
      return (
        <div className="space-y-6">
          <Card className="space-y-3 border border-dashed border-amber-200/60 bg-amber-50/40 p-6 text-sm text-amber-700">
            <p className="font-semibold">{t('content_factory.research_prompts_intro')}</p>
            <ul className="space-y-1">
              <li>• {t('content_factory.research_prompt_point_1')}</li>
              <li>• {t('content_factory.research_prompt_point_2')}</li>
              <li>• {t('content_factory.research_prompt_point_3')}</li>
            </ul>
          </Card>
          <ResearchPromptForm prompt={prompts.research} onSaved={handlePromptSaved} onError={handleError} />
        </div>
      )
    }

    return (
      <div className="space-y-6">
        <Card className="space-y-3 border border-dashed border-indigo-200/60 bg-indigo-50/40 p-6 text-sm text-indigo-700">
          <p className="font-semibold">{t('content_factory.script_prompts_intro')}</p>
          <ul className="space-y-1">
            <li>• {t('content_factory.script_prompt_point_1')}</li>
            <li>• {t('content_factory.script_prompt_point_2')}</li>
            <li>• {t('content_factory.script_prompt_point_3')}</li>
          </ul>
        </Card>
        <ScriptPromptForm prompt={prompts.script} onSaved={handlePromptSaved} onError={handleError} />
      </div>
    )
  }

  return (
    <Layout>
      <div className="space-y-10">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">{t('content_factory.content_ops')}</p>
          <h1 className="text-3xl font-semibold text-primary">{t('content_factory.controls_title')}</h1>
          <p className="max-w-3xl text-sm text-slate-500">
            {t('content_factory.controls_description')}
          </p>
        </div>

        <FeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

        {error && (
          <div className="rounded-2xl border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm text-rose-600">
            {error}
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto rounded-3xl border border-white/60 bg-white/70 p-2 shadow-inner scrollbar-hide">
          <SectionTab label={t('content_factory.categories_tab')} active={activeTab === 'categories'} onClick={() => setActiveTab('categories')} />
          <SectionTab label={t('content_factory.idea_prompt_tab')} active={activeTab === 'ideas'} onClick={() => setActiveTab('ideas')} />
          <SectionTab label={t('content_factory.research_prompt_tab')} active={activeTab === 'research'} onClick={() => setActiveTab('research')} />
          <SectionTab label={t('content_factory.script_prompt_tab')} active={activeTab === 'script'} onClick={() => setActiveTab('script')} />
        </div>

        {activeTab === 'categories' ? renderCategories() : renderPrompts()}
      </div>
    </Layout>
  )
}

