import { useState, useEffect } from 'react'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { EmptyState } from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'
import {
  Calendar,
  Plus,
  Search,
  Sparkles,
  Video,
  Clock,
  CheckCircle2,
  XCircle,
  Loader,
  Settings,
  Trash2,
  Play,
} from 'lucide-react'
import api from '../lib/api'

interface VideoPlan {
  id: string
  name: string
  videos_per_day: number
  start_date: string
  end_date: string | null
  enabled: boolean
  auto_research: boolean
  auto_create: boolean
  created_at: string
}

interface VideoPlanItem {
  id: string
  plan_id: string
  scheduled_date: string
  scheduled_time: string | null
  topic: string | null
  category: 'Trading' | 'Lifestyle' | 'Fin. Freedom' | null
  description: string | null
  why_important: string | null
  useful_tips: string | null
  status: 'pending' | 'researching' | 'ready' | 'generating' | 'completed' | 'failed'
  video_id: string | null
  error_message: string | null
}

export function VideoPlanning() {
  const [plans, setPlans] = useState<VideoPlan[]>([])
  const [selectedPlan, setSelectedPlan] = useState<VideoPlan | null>(null)
  const [planItems, setPlanItems] = useState<VideoPlanItem[]>([])
  const [loading, setLoading] = useState(true)
  const [createModal, setCreateModal] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  )

  // Create plan form
  const [planName, setPlanName] = useState('')
  const [videosPerDay, setVideosPerDay] = useState(3)
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState('')
  const [autoResearch, setAutoResearch] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadPlans()
  }, [])

  useEffect(() => {
    if (selectedPlan) {
      loadPlanItems(selectedPlan.id)
    }
  }, [selectedPlan])

  const loadPlans = async () => {
    try {
      const response = await api.get('/api/plans')
      setPlans(response.data.plans || [])
      if (response.data.plans?.length > 0 && !selectedPlan) {
        setSelectedPlan(response.data.plans[0])
      }
    } catch (error) {
      console.error('Failed to load plans:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadPlanItems = async (planId: string) => {
    try {
      const response = await api.get(`/api/plans/${planId}`)
      setPlanItems(response.data.items || [])
    } catch (error) {
      console.error('Failed to load plan items:', error)
    }
  }

  const handleCreatePlan = async () => {
    if (!planName || !startDate) {
      alert('Please fill in plan name and start date')
      return
    }

    setCreating(true)
    try {
      const response = await api.post('/api/plans', {
        name: planName,
        videos_per_day: videosPerDay,
        start_date: startDate,
        end_date: endDate || null,
        auto_research: autoResearch,
      })

      setPlans([response.data.plan, ...plans])
      setSelectedPlan(response.data.plan)
      setCreateModal(false)
      setPlanName('')
      setVideosPerDay(3)
      setStartDate(new Date().toISOString().split('T')[0])
      setEndDate('')
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create plan')
    } finally {
      setCreating(false)
    }
  }

  const handleGenerateTopic = async (itemId: string) => {
    try {
      await api.post(`/api/plans/items/${itemId}/generate-topic`)
      if (selectedPlan) {
        loadPlanItems(selectedPlan.id)
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to generate topic')
    }
  }

  const handleCreateVideo = async (item: VideoPlanItem) => {
    try {
      await api.post(`/api/plans/items/${item.id}/create-video`, {
        style: 'professional',
        duration: 30,
      })
      if (selectedPlan) {
        loadPlanItems(selectedPlan.id)
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create video')
    }
  }

  // Group items by date
  const itemsByDate = planItems.reduce((acc, item) => {
    const date = item.scheduled_date
    if (!acc[date]) acc[date] = []
    acc[date].push(item)
    return acc
  }, {} as Record<string, VideoPlanItem[]>)

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'success' | 'error' | 'warning' | 'info'> = {
      completed: 'success',
      ready: 'success',
      generating: 'info',
      researching: 'info',
      pending: 'warning',
      failed: 'error',
    }
    const labels: Record<string, string> = {
      pending: 'Pending',
      researching: 'Researching...',
      ready: 'Ready',
      generating: 'Generating...',
      completed: 'Completed',
      failed: 'Failed',
    }
    return <Badge variant={variants[status] || 'default'}>{labels[status] || status}</Badge>
  }

  const formatTime = (time: string | null) => {
    if (!time) return ''
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
  }

  const getCategoryColor = (category: string | null) => {
    const colors: Record<string, string> = {
      Trading: 'bg-blue-100 text-blue-700',
      'Fin. Freedom': 'bg-green-100 text-green-700',
      Lifestyle: 'bg-purple-100 text-purple-700',
    }
    return colors[category || ''] || 'bg-slate-100 text-slate-700'
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
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              Video Planning
            </p>
            <h1 className="text-3xl font-semibold text-primary">Plan Your Videos</h1>
            <p className="text-sm text-slate-500">
              Schedule daily videos with automatic topic generation and research via Perplexity
            </p>
          </div>
          <Button onClick={() => setCreateModal(true)} leftIcon={<Plus className="h-4 w-4" />}>
            New Plan
          </Button>
        </div>

        {/* Plan Selector */}
        {plans.length > 0 && (
          <Card className="p-4">
            <div className="flex flex-wrap gap-2">
              {plans.map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan)}
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                    selectedPlan?.id === plan.id
                      ? 'bg-brand-500 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {plan.name} ({plan.videos_per_day}/day)
                </button>
              ))}
            </div>
          </Card>
        )}

        {/* Plan Items Calendar View */}
        {selectedPlan ? (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Calendar Sidebar */}
            <Card className="lg:col-span-1">
              <div className="p-6">
                <h2 className="mb-4 text-lg font-semibold text-primary">Select Date</h2>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full"
                />
                <div className="mt-6 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Total Items</span>
                    <span className="font-semibold">{planItems.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Ready</span>
                    <span className="font-semibold text-emerald-600">
                      {planItems.filter((i) => i.status === 'ready').length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Completed</span>
                    <span className="font-semibold text-blue-600">
                      {planItems.filter((i) => i.status === 'completed').length}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Items for Selected Date */}
            <div className="lg:col-span-2 space-y-4">
              <h2 className="text-lg font-semibold text-primary">
                {new Date(selectedDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </h2>

              {itemsByDate[selectedDate] ? (
                <div className="space-y-3">
                  {itemsByDate[selectedDate]
                    .sort((a, b) => (a.scheduled_time || '').localeCompare(b.scheduled_time || ''))
                    .map((item) => (
                      <Card key={item.id} className="p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-3">
                            <div className="flex items-center gap-3">
                              <Clock className="h-4 w-4 text-slate-400" />
                              <span className="text-sm font-medium text-slate-600">
                                {formatTime(item.scheduled_time)}
                              </span>
                              {item.category && (
                                <span
                                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${getCategoryColor(
                                    item.category
                                  )}`}
                                >
                                  {item.category}
                                </span>
                              )}
                              {getStatusBadge(item.status)}
                            </div>

                            {item.topic ? (
                              <div>
                                <h3 className="font-semibold text-primary">{item.topic}</h3>
                                {item.description && (
                                  <p className="mt-1 text-sm text-slate-600 line-clamp-2">
                                    {item.description}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p className="text-sm text-slate-400">No topic yet</p>
                            )}

                            {item.error_message && (
                              <p className="text-xs text-rose-600">{item.error_message}</p>
                            )}
                          </div>

                          <div className="flex gap-2">
                            {!item.topic && item.status === 'pending' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleGenerateTopic(item.id)}
                                leftIcon={<Sparkles className="h-4 w-4" />}
                              >
                                Generate
                              </Button>
                            )}
                            {item.status === 'ready' && (
                              <Button
                                size="sm"
                                onClick={() => handleCreateVideo(item)}
                                leftIcon={<Video className="h-4 w-4" />}
                              >
                                Create Video
                              </Button>
                            )}
                            {item.status === 'researching' || item.status === 'generating' ? (
                              <Loader className="h-4 w-4 animate-spin text-brand-500" />
                            ) : null}
                            {item.video_id && (
                              <a
                                href={`/videos`}
                                className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600"
                              >
                                View Video
                              </a>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                </div>
              ) : (
                <EmptyState
                  icon={<Calendar className="w-12 h-12" />}
                  title="No videos scheduled"
                  description={`No videos scheduled for this date. Select another date or create a plan.`}
                />
              )}
            </div>
          </div>
        ) : (
          <EmptyState
            icon={<Calendar className="w-16 h-16" />}
            title="No plans yet"
            description="Create your first video plan to schedule daily videos with automatic topic generation."
            action={
              <Button onClick={() => setCreateModal(true)} leftIcon={<Plus className="h-4 w-4" />}>
                Create Plan
              </Button>
            }
          />
        )}

        {/* Create Plan Modal */}
        <Modal
          isOpen={createModal}
          onClose={() => setCreateModal(false)}
          title="Create Video Plan"
        >
          <div className="space-y-4">
            <Input
              label="Plan Name"
              placeholder="e.g., Daily Trading Content"
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              required
            />

            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Start Date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />

              <Input
                label="End Date (optional)"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
              />
            </div>

            <Select
              label="Videos Per Day"
              value={videosPerDay.toString()}
              onChange={(e) => setVideosPerDay(parseInt(e.target.value))}
              options={[
                { value: '1', label: '1 video per day' },
                { value: '2', label: '2 videos per day' },
                { value: '3', label: '3 videos per day' },
                { value: '4', label: '4 videos per day' },
                { value: '5', label: '5 videos per day' },
              ]}
            />

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoResearch}
                  onChange={(e) => setAutoResearch(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-500"
                />
                <div>
                  <p className="text-sm font-medium text-primary">Auto-research topics</p>
                  <p className="text-xs text-slate-500">
                    Automatically generate and research topics using Perplexity AI
                  </p>
                </div>
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="ghost" onClick={() => setCreateModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreatePlan} loading={creating}>
                Create Plan
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </Layout>
  )
}
