import { useState, useEffect } from 'react'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Textarea } from '../components/ui/Textarea'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { EmptyState } from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'
import {
  Calendar,
  Plus,
  Sparkles,
  Video,
  Clock,
  Loader,
  PenSquare,
  Check,
  X,
  Edit2,
  Save,
  Trash2,
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
  auto_schedule_trigger?: 'daily' | 'time_based' | 'manual'
  trigger_time?: string | null
  default_platforms?: string[] | null
  auto_approve?: boolean
  created_at: string
}

interface VideoPlanItem {
  id: string
  plan_id: string
  scheduled_date: string
  scheduled_time: string | null
  topic: string | null
  category: string | null
  description: string | null
  why_important: string | null
  useful_tips: string | null
  script?: string | null
  script_status?: 'draft' | 'approved' | 'rejected' | null
  platforms?: string[] | null
  caption?: string | null
  status:
    | 'pending'
    | 'researching'
    | 'ready'
    | 'draft'
    | 'approved'
    | 'generating'
    | 'completed'
    | 'scheduled'
    | 'posted'
    | 'failed'
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
    new Date().toISOString().split('T')[0],
  )
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [scriptPreviewItem, setScriptPreviewItem] =
    useState<VideoPlanItem | null>(null)
  const [editingItem, setEditingItem] = useState<VideoPlanItem | null>(null)
  const [editForm, setEditForm] = useState<{
    topic: string
    scheduled_time: string
    description: string
    why_important: string
    useful_tips: string
    caption: string
    platforms: string[]
  }>({
    topic: '',
    scheduled_time: '',
    description: '',
    why_important: '',
    useful_tips: '',
    caption: '',
    platforms: [],
  })

  // Create plan form
  const [planName, setPlanName] = useState('')
  const [videosPerDay, setVideosPerDay] = useState(3)
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split('T')[0],
  )
  const [endDate, setEndDate] = useState('')
  const [autoResearch, setAutoResearch] = useState(true)
  const [autoScheduleTrigger, setAutoScheduleTrigger] = useState<
    'daily' | 'time_based' | 'manual'
  >('daily')
  const [triggerTime, setTriggerTime] = useState(() => {
    // Default to 9 AM in user's local time
    const hours = 9
    const minutes = 0
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  })
  const [defaultPlatforms, setDefaultPlatforms] = useState<string[]>([])
  const [autoApprove, setAutoApprove] = useState(false)
  const [autoCreate, setAutoCreate] = useState(false)
  const [timezone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  )
  const [videoTimes, setVideoTimes] = useState<string[]>([
    '09:00',
    '14:00',
    '19:00',
  ]) // Default times for 3 videos
  const [videoTopics, setVideoTopics] = useState<string[]>(['', '', '']) // Topics for each video slot
  const [deleteModal, setDeleteModal] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [editPlanModal, setEditPlanModal] = useState<VideoPlan | null>(null)
  const [editingPlan, setEditingPlan] = useState(false)

  // Preset times for quick selection
  const timePresets = [
    { label: 'Morning (9:00 AM)', value: '09:00' },
    { label: 'Midday (12:00 PM)', value: '12:00' },
    { label: 'Afternoon (3:00 PM)', value: '15:00' },
    { label: 'Evening (6:00 PM)', value: '18:00' },
  ]

  // Update videoTimes and videoTopics when videosPerDay changes
  useEffect(() => {
    const defaultTimes = ['09:00', '14:00', '19:00', '10:00', '11:00']
    if (videoTimes.length !== videosPerDay) {
      // If we need more times, add defaults. If fewer, keep first N.
      setVideoTimes(defaultTimes.slice(0, videosPerDay))
      setVideoTopics(Array(videosPerDay).fill(''))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videosPerDay])

  // Available platforms
  const availablePlatforms = ['instagram', 'youtube', 'tiktok', 'twitter']
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
        auto_schedule_trigger: autoScheduleTrigger,
        trigger_time:
          autoScheduleTrigger === 'daily' ? `${triggerTime}:00` : null,
        default_platforms:
          defaultPlatforms.length > 0 ? defaultPlatforms : null,
        auto_approve: autoApprove,
        auto_create: autoCreate,
        timezone: timezone,
        video_times: videoTimes.map((time: string) => `${time}:00`), // Send custom times
        video_topics: videoTopics, // Send topics for each slot
      })

      setPlans([response.data.plan, ...plans])
      setSelectedPlan(response.data.plan)
      setCreateModal(false)
      setPlanName('')
      setVideosPerDay(3)
      setStartDate(new Date().toISOString().split('T')[0])
      setEndDate('')
      setAutoScheduleTrigger('daily')
      setTriggerTime('09:00')
      setDefaultPlatforms([])
      setAutoApprove(false)
      setAutoCreate(false)
      setVideoTimes(['09:00', '14:00', '19:00'])
      setVideoTopics(['', '', ''])
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create plan')
    } finally {
      setCreating(false)
    }
  }

  const handleApproveScript = async (itemId: string) => {
    try {
      await api.post(`/api/plans/items/${itemId}/approve-script`)
      if (selectedPlan) {
        loadPlanItems(selectedPlan.id)
      }
      setScriptPreviewItem(null)
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to approve script')
    }
  }

  const handleRejectScript = async (itemId: string) => {
    try {
      await api.post(`/api/plans/items/${itemId}/reject-script`)
      if (selectedPlan) {
        loadPlanItems(selectedPlan.id)
      }
      setScriptPreviewItem(null)
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to reject script')
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

  const handleEditPlan = (plan: VideoPlan) => {
    setEditPlanModal(plan)
    setPlanName(plan.name)
    setVideosPerDay(plan.videos_per_day)
    setStartDate(plan.start_date.split('T')[0])
    setEndDate(plan.end_date ? plan.end_date.split('T')[0] : '')
    setAutoResearch(plan.auto_research)
    setAutoScheduleTrigger(plan.auto_schedule_trigger || 'daily')
    setTriggerTime(
      plan.trigger_time ? plan.trigger_time.substring(0, 5) : '09:00',
    )
    setDefaultPlatforms(plan.default_platforms || [])
    setAutoApprove(plan.auto_approve || false)
    setAutoCreate(plan.auto_create || false)
    // Load existing video times and topics from plan items if needed
    // For now, use defaults
    setVideoTimes(['09:00', '14:00', '19:00'].slice(0, plan.videos_per_day))
    setVideoTopics(Array(plan.videos_per_day).fill(''))
  }

  const handleSavePlan = async () => {
    if (!editPlanModal || !planName || !startDate) {
      alert('Please fill in plan name and start date')
      return
    }

    setEditingPlan(true)
    try {
      await api.patch(`/api/plans/${editPlanModal.id}`, {
        name: planName,
        videos_per_day: videosPerDay,
        start_date: startDate,
        end_date: endDate || null,
        auto_research: autoResearch,
        auto_schedule_trigger: autoScheduleTrigger,
        trigger_time:
          autoScheduleTrigger === 'daily' ? `${triggerTime}:00` : null,
        default_platforms:
          defaultPlatforms.length > 0 ? defaultPlatforms : null,
        auto_approve: autoApprove,
        auto_create: autoCreate,
      })

      // Reload plans to get updated data
      await loadPlans()
      setEditPlanModal(null)
      // Reset form
      setPlanName('')
      setVideosPerDay(3)
      setStartDate(new Date().toISOString().split('T')[0])
      setEndDate('')
      setAutoScheduleTrigger('daily')
      setTriggerTime('09:00')
      setDefaultPlatforms([])
      setAutoApprove(false)
      setAutoCreate(false)
      setVideoTimes(['09:00', '14:00', '19:00'])
      setVideoTopics(['', '', ''])
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update plan')
    } finally {
      setEditingPlan(false)
    }
  }

  const handleDeletePlan = async () => {
    if (!deleteModal) return

    setDeleting(true)
    try {
      await api.delete(`/api/plans/${deleteModal}`)
      setPlans(plans.filter((p) => p.id !== deleteModal))
      if (selectedPlan?.id === deleteModal) {
        const remainingPlans = plans.filter((p) => p.id !== deleteModal)
        setSelectedPlan(remainingPlans.length > 0 ? remainingPlans[0] : null)
      }
      setDeleteModal(null)
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete plan')
    } finally {
      setDeleting(false)
    }
  }

  const handleEditItem = (item: VideoPlanItem) => {
    setEditingItem(item)
    setEditForm({
      topic: item.topic || '',
      scheduled_time: item.scheduled_time || '',
      description: item.description || '',
      why_important: item.why_important || '',
      useful_tips: item.useful_tips || '',
      caption: item.caption || '',
      platforms: item.platforms || [],
    })
  }

  const handleSaveItem = async () => {
    if (!editingItem || !selectedPlan) return

    try {
      await api.patch(`/api/plans/items/${editingItem.id}`, {
        topic: editForm.topic || null,
        scheduled_time: editForm.scheduled_time || null,
        description: editForm.description || null,
        why_important: editForm.why_important || null,
        useful_tips: editForm.useful_tips || null,
        caption: editForm.caption || null,
        platforms: editForm.platforms.length > 0 ? editForm.platforms : null,
      })

      setEditingItem(null)
      loadPlanItems(selectedPlan.id)
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update item')
    }
  }

  // Filter items by status
  const filteredItems =
    statusFilter === 'all'
      ? planItems
      : planItems.filter((item) => item.status === statusFilter)

  // Group items by date
  const itemsByDate = filteredItems.reduce(
    (acc, item) => {
      const date = item.scheduled_date
      if (!acc[date]) acc[date] = []
      acc[date].push(item)
      return acc
    },
    {} as Record<string, VideoPlanItem[]>,
  )

  // Calendar helper functions
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days: (Date | null)[] = []
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }
    // Add all days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i))
    }
    return days
  }

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth((prev) => {
      const newDate = new Date(prev)
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1)
      } else {
        newDate.setMonth(prev.getMonth() + 1)
      }
      return newDate
    })
  }

  const getDateKey = (date: Date | null) => {
    if (!date) return ''
    return date.toISOString().split('T')[0]
  }

  const getItemsForDate = (date: Date | null) => {
    if (!date) return []
    const dateKey = getDateKey(date)
    return itemsByDate[dateKey] || []
  }

  const getStatusCounts = () => {
    return {
      all: planItems.length,
      pending: planItems.filter((i) => i.status === 'pending').length,
      ready: planItems.filter((i) => i.status === 'ready').length,
      completed: planItems.filter((i) => i.status === 'completed').length,
      failed: planItems.filter((i) => i.status === 'failed').length,
    }
  }

  const statusCounts = getStatusCounts()

  const getStatusBadge = (status: string, scriptStatus?: string | null) => {
    // Show script status if it's draft or approved
    if (scriptStatus === 'draft') {
      return <Badge variant="warning">Draft Script</Badge>
    }
    if (scriptStatus === 'approved') {
      return <Badge variant="info">Approved</Badge>
    }

    const variants: Record<
      string,
      'default' | 'success' | 'error' | 'warning' | 'info'
    > = {
      completed: 'success',
      scheduled: 'success',
      posted: 'success',
      ready: 'success',
      approved: 'success',
      generating: 'info',
      researching: 'info',
      pending: 'warning',
      draft: 'info', // Show as info when generating script
      failed: 'error',
    }
    const labels: Record<string, string> = {
      pending: 'Pending',
      researching: 'Researching...',
      ready: 'Ready',
      draft: 'Generating Script', // Show "Generating Script" when status is draft
      approved: 'Approved',
      generating: 'Creating Video', // Show "Creating Video" when generating
      completed: 'Completed',
      scheduled: 'Scheduled',
      posted: 'Posted',
      failed: 'Failed',
    }
    return (
      <Badge variant={variants[status] || 'default'}>
        {labels[status] || status}
      </Badge>
    )
  }

  const formatTime = (time: string | null) => {
    if (!time) return ''
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
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
            <h1 className="text-3xl font-semibold text-primary">
              Plan Your Videos
            </h1>
            <p className="text-sm text-slate-500">
              Schedule daily videos with automatic topic generation and research
              via Perplexity
            </p>
          </div>
          <Button
            onClick={() => setCreateModal(true)}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            New Plan
          </Button>
        </div>

        {/* Plan Selector */}
        {plans.length > 0 && (
          <Card className="p-4">
            <div className="flex flex-wrap gap-2">
              {plans.map((plan) => (
                <div key={plan.id} className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedPlan(plan)}
                    className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                      selectedPlan?.id === plan.id
                        ? 'bg-brand-500 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {plan.name} ({plan.videos_per_day}/day)
                  </button>
                  <button
                    onClick={() => handleEditPlan(plan)}
                    className="rounded-xl p-2 text-slate-400 hover:bg-brand-50 hover:text-brand-600 transition"
                    title="Edit plan"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleteModal(plan.id)}
                    className="rounded-xl p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                    title="Delete plan"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Plan Items Calendar View */}
        {selectedPlan ? (
          <div className="space-y-6">
            {/* Status Summary and Filters */}
            <Card className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-6">
                  <div className="text-sm">
                    <span className="text-slate-600">Total: </span>
                    <span className="font-semibold">{statusCounts.all}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-slate-600">Ready: </span>
                    <span className="font-semibold text-emerald-600">
                      {statusCounts.ready}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-slate-600">Completed: </span>
                    <span className="font-semibold text-blue-600">
                      {statusCounts.completed}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-slate-600">Pending: </span>
                    <span className="font-semibold text-yellow-600">
                      {statusCounts.pending}
                    </span>
                  </div>
                  {statusCounts.failed > 0 && (
                    <div className="text-sm">
                      <span className="text-slate-600">Failed: </span>
                      <span className="font-semibold text-red-600">
                        {statusCounts.failed}
                      </span>
                    </div>
                  )}
                </div>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  options={[
                    { value: 'all', label: 'All Status' },
                    { value: 'pending', label: 'Pending' },
                    { value: 'ready', label: 'Ready' },
                    { value: 'completed', label: 'Completed' },
                    { value: 'failed', label: 'Failed' },
                  ]}
                  className="w-40"
                />
              </div>
            </Card>

            {/* Calendar Grid */}
            <Card className="p-6">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-primary">
                  {formatMonthYear(currentMonth)}
                </h2>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigateMonth('prev')}
                  >
                    ← Prev
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentMonth(new Date())}
                  >
                    Today
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigateMonth('next')}
                  >
                    Next →
                  </Button>
                </div>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-2">
                {/* Day Headers */}
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(
                  (day) => (
                    <div
                      key={day}
                      className="p-2 text-center text-xs font-semibold text-slate-500"
                    >
                      {day}
                    </div>
                  ),
                )}

                {/* Calendar Days */}
                {getDaysInMonth(currentMonth).map((date, index) => {
                  const dateKey = getDateKey(date)
                  const items = getItemsForDate(date)
                  const isToday =
                    date && dateKey === new Date().toISOString().split('T')[0]
                  const isSelected = date && dateKey === selectedDate

                  return (
                    <button
                      key={index}
                      onClick={() => date && setSelectedDate(dateKey)}
                      className={`min-h-[80px] rounded-lg border p-2 text-left transition ${
                        !date
                          ? 'border-transparent bg-transparent'
                          : isSelected
                            ? 'border-brand-500 bg-brand-50'
                            : isToday
                              ? 'border-brand-200 bg-brand-50/50'
                              : 'border-slate-200 bg-white hover:border-brand-200 hover:bg-slate-50'
                      }`}
                      disabled={!date}
                    >
                      {date && (
                        <>
                          <div
                            className={`text-sm font-medium ${isToday ? 'text-brand-600' : 'text-slate-700'}`}
                          >
                            {date.getDate()}
                          </div>
                          {items.length > 0 && (
                            <div className="mt-1 space-y-1">
                              {items.slice(0, 2).map((item) => (
                                <div
                                  key={item.id}
                                  className={`truncate rounded px-1.5 py-0.5 text-xs ${
                                    item.status === 'completed' ||
                                    item.status === 'posted'
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : item.status === 'ready'
                                        ? 'bg-blue-100 text-blue-700'
                                        : item.status === 'failed'
                                          ? 'bg-red-100 text-red-700'
                                          : 'bg-yellow-100 text-yellow-700'
                                  }`}
                                  title={item.topic || 'No topic'}
                                >
                                  {item.topic ||
                                    formatTime(item.scheduled_time) ||
                                    'Item'}
                                </div>
                              ))}
                              {items.length > 2 && (
                                <div className="text-xs text-slate-500">
                                  +{items.length - 2} more
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </button>
                  )
                })}
              </div>
            </Card>

            {/* Items for Selected Date */}
            {itemsByDate[selectedDate] &&
              itemsByDate[selectedDate].length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-primary">
                    {new Date(selectedDate).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </h2>

                  <div className="space-y-3">
                    {itemsByDate[selectedDate]
                      .sort((a, b) =>
                        (a.scheduled_time || '').localeCompare(
                          b.scheduled_time || '',
                        ),
                      )
                      .map((item) => (
                        <Card key={item.id} className="p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-3">
                              <div className="flex items-center gap-3">
                                <Clock className="h-4 w-4 text-slate-400" />
                                <span className="text-sm font-medium text-slate-600">
                                  {formatTime(item.scheduled_time)}
                                </span>
                                {getStatusBadge(
                                  item.status,
                                  item.script_status,
                                )}
                              </div>

                              {editingItem?.id === item.id ? (
                                <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                                  <div className="flex items-center justify-between">
                                    <h4 className="font-semibold text-primary">
                                      Edit Video Details
                                    </h4>
                                  </div>
                                  <Input
                                    label="Topic *"
                                    value={editForm.topic}
                                    onChange={(e) =>
                                      setEditForm({
                                        ...editForm,
                                        topic: e.target.value,
                                      })
                                    }
                                    placeholder="Enter topic (e.g., Best Trading Strategies for 2024)..."
                                    required
                                  />
                                  <div className="space-y-3">
                                    <div>
                                      <label className="mb-2 block text-xs font-medium text-slate-700">
                                        Posting Time
                                      </label>
                                      <Input
                                        type="time"
                                        value={editForm.scheduled_time}
                                        onChange={(e) =>
                                          setEditForm({
                                            ...editForm,
                                            scheduled_time: e.target.value,
                                          })
                                        }
                                        className="mb-2"
                                      />
                                      <div className="flex flex-wrap gap-2">
                                        {timePresets.map((preset) => (
                                          <button
                                            key={preset.value}
                                            type="button"
                                            onClick={() =>
                                              setEditForm({
                                                ...editForm,
                                                scheduled_time: preset.value,
                                              })
                                            }
                                            className={`rounded-lg border px-2 py-1 text-xs font-medium transition ${
                                              editForm.scheduled_time ===
                                              preset.value
                                                ? 'border-brand-500 bg-brand-50 text-brand-700'
                                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                            }`}
                                          >
                                            {preset.label.split(' ')[0]}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                    <div className="space-y-2">
                                      <label className="block text-xs font-medium text-slate-700">
                                        Platforms
                                      </label>
                                      <div className="flex flex-wrap gap-2">
                                        {availablePlatforms.map((platform) => (
                                          <button
                                            key={platform}
                                            type="button"
                                            onClick={() => {
                                              const newPlatforms =
                                                editForm.platforms.includes(
                                                  platform,
                                                )
                                                  ? editForm.platforms.filter(
                                                      (p) => p !== platform,
                                                    )
                                                  : [
                                                      ...editForm.platforms,
                                                      platform,
                                                    ]
                                              setEditForm({
                                                ...editForm,
                                                platforms: newPlatforms,
                                              })
                                            }}
                                            className={`rounded-lg border px-2 py-1 text-xs font-medium transition ${
                                              editForm.platforms.includes(
                                                platform,
                                              )
                                                ? 'border-brand-500 bg-brand-50 text-brand-700'
                                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                            }`}
                                          >
                                            {platform}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                  <Textarea
                                    label="Description"
                                    value={editForm.description}
                                    onChange={(e) =>
                                      setEditForm({
                                        ...editForm,
                                        description: e.target.value,
                                      })
                                    }
                                    placeholder="Video description..."
                                    rows={2}
                                  />
                                  <Textarea
                                    label="Caption (for social posts)"
                                    value={editForm.caption}
                                    onChange={(e) =>
                                      setEditForm({
                                        ...editForm,
                                        caption: e.target.value,
                                      })
                                    }
                                    placeholder="Custom caption for social media..."
                                    rows={2}
                                  />
                                </div>
                              ) : (
                                <div>
                                  {item.topic ? (
                                    <>
                                      <h3 className="font-semibold text-primary">
                                        {item.topic}
                                      </h3>
                                      {item.description && (
                                        <p className="mt-1 text-sm text-slate-600 line-clamp-2">
                                          {item.description}
                                        </p>
                                      )}
                                      {item.caption && (
                                        <p className="mt-1 text-xs text-slate-500 italic">
                                          Caption: {item.caption}
                                        </p>
                                      )}
                                      {item.platforms &&
                                        item.platforms.length > 0 && (
                                          <div className="mt-2 flex flex-wrap gap-1">
                                            {item.platforms.map((platform) => (
                                              <span
                                                key={platform}
                                                className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700"
                                              >
                                                {platform}
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                    </>
                                  ) : (
                                    <p className="text-sm text-slate-400">
                                      No topic yet
                                    </p>
                                  )}
                                </div>
                              )}

                              {item.error_message && (
                                <p className="text-xs text-rose-600">
                                  {item.error_message}
                                </p>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {editingItem?.id === item.id ? (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={handleSaveItem}
                                    leftIcon={<Save className="h-4 w-4" />}
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setEditingItem(null)}
                                    leftIcon={<X className="h-4 w-4" />}
                                  >
                                    Cancel
                                  </Button>
                                </>
                              ) : (
                                <>
                                  {!item.topic ? (
                                    <>
                                      <Button
                                        size="sm"
                                        onClick={() => handleEditItem(item)}
                                        leftIcon={<Edit2 className="h-4 w-4" />}
                                      >
                                        Set Topic
                                      </Button>
                                      {item.status === 'pending' && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() =>
                                            handleGenerateTopic(item.id)
                                          }
                                          leftIcon={
                                            <Sparkles className="h-4 w-4" />
                                          }
                                        >
                                          Auto Generate
                                        </Button>
                                      )}
                                    </>
                                  ) : (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleEditItem(item)}
                                        leftIcon={<Edit2 className="h-4 w-4" />}
                                      >
                                        Edit Topic
                                      </Button>
                                      {item.status === 'pending' && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() =>
                                            handleGenerateTopic(item.id)
                                          }
                                          leftIcon={
                                            <Sparkles className="h-4 w-4" />
                                          }
                                        >
                                          Regenerate
                                        </Button>
                                      )}
                                    </>
                                  )}
                                </>
                              )}
                              {item.script_status === 'draft' &&
                                item.script && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setScriptPreviewItem(item)}
                                    leftIcon={<PenSquare className="h-4 w-4" />}
                                  >
                                    Review Script
                                  </Button>
                                )}
                              {item.status === 'ready' && !item.script && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={async () => {
                                    try {
                                      await api.post(
                                        `/api/plans/items/${item.id}/generate-script`,
                                      )
                                      if (selectedPlan)
                                        loadPlanItems(selectedPlan.id)
                                    } catch (error: any) {
                                      alert(
                                        error.response?.data?.error ||
                                          'Failed to generate script',
                                      )
                                    }
                                  }}
                                  leftIcon={<Sparkles className="h-4 w-4" />}
                                >
                                  Generate Script
                                </Button>
                              )}
                              {item.status === 'approved' && (
                                <Button
                                  size="sm"
                                  onClick={() => handleCreateVideo(item)}
                                  leftIcon={<Video className="h-4 w-4" />}
                                >
                                  Create Video
                                </Button>
                              )}
                              {item.status === 'researching' ||
                              item.status === 'generating' ? (
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
                </div>
              )}
          </div>
        ) : (
          <EmptyState
            icon={<Calendar className="w-16 h-16" />}
            title="No plans yet"
            description="Create your first video plan to schedule daily videos with automatic topic generation."
            action={
              <Button
                onClick={() => setCreateModal(true)}
                leftIcon={<Plus className="h-4 w-4" />}
              >
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

            {/* Posting Times and Topics for Each Video */}
            <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <label className="block text-sm font-medium text-slate-700">
                Video Slots Configuration
                <span className="ml-2 text-xs font-normal text-slate-500">
                  (Set time and topic for each video)
                </span>
              </label>
              <div className="space-y-4">
                {Array.from({ length: videosPerDay }).map((_, index) => (
                  <div
                    key={index}
                    className="rounded-lg border border-slate-200 bg-white p-4"
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <span className="rounded-full bg-brand-500 px-2 py-1 text-xs font-semibold text-white">
                        Video {index + 1}
                      </span>
                    </div>

                    {/* Time Selection */}
                    <div className="mb-3 space-y-2">
                      <label className="block text-xs font-medium text-slate-600">
                        Posting Time
                      </label>
                      <div className="flex gap-2">
                        <Input
                          type="time"
                          value={videoTimes[index] || ''}
                          onChange={(e) => {
                            const newTimes = [...videoTimes]
                            newTimes[index] = e.target.value
                            setVideoTimes(newTimes)
                          }}
                          className="flex-1"
                        />
                        <div className="flex flex-wrap gap-1">
                          {timePresets.map((preset) => (
                            <button
                              key={preset.value}
                              type="button"
                              onClick={() => {
                                const newTimes = [...videoTimes]
                                newTimes[index] = preset.value
                                setVideoTimes(newTimes)
                              }}
                              className={`rounded border px-2 py-1 text-xs ${
                                videoTimes[index] === preset.value
                                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              {preset.label.split('(')[0].trim()}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Topic Input */}
                    <div className="mb-3 space-y-2">
                      <label className="block text-xs font-medium text-slate-600">
                        Topic{' '}
                        <span className="text-slate-400">
                          (optional - leave empty to auto-generate)
                        </span>
                      </label>
                      <Input
                        value={videoTopics[index] || ''}
                        onChange={(e) => {
                          const newTopics = [...videoTopics]
                          newTopics[index] = e.target.value
                          setVideoTopics(newTopics)
                        }}
                        placeholder="e.g., Best Trading Strategies for 2024"
                        className="w-full"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Select
              label="Schedule Trigger"
              value={autoScheduleTrigger}
              onChange={(e) =>
                setAutoScheduleTrigger(
                  e.target.value as 'daily' | 'time_based' | 'manual',
                )
              }
              options={[
                { value: 'daily', label: 'Daily at specific time' },
                { value: 'time_based', label: 'Based on scheduled post times' },
                { value: 'manual', label: 'Manual only' },
              ]}
            />

            {autoScheduleTrigger === 'daily' && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-700">
                  Trigger Time
                  <span className="ml-2 text-xs text-slate-500">
                    (Timezone: {timezone})
                  </span>
                </label>

                {/* Quick preset buttons */}
                <div className="flex flex-wrap gap-2">
                  {timePresets.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setTriggerTime(preset.value)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                        triggerTime === preset.value
                          ? 'border-brand-500 bg-brand-50 text-brand-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {preset.label.split('(')[0].trim()}
                    </button>
                  ))}
                </div>

                <Input
                  label="Custom Time"
                  type="time"
                  value={triggerTime}
                  onChange={(e) => setTriggerTime(e.target.value)}
                  min="00:00"
                  max="23:59"
                />
                <p className="text-xs text-slate-500">
                  Topics will be generated automatically at this time each day
                </p>
              </div>
            )}

            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="autoResearch"
                  checked={autoResearch}
                  onChange={(e) => setAutoResearch(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                />
                <div className="flex-1">
                  <label
                    htmlFor="autoResearch"
                    className="text-sm font-medium text-slate-700"
                  >
                    Enable automatic research
                  </label>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Automatically research topics using Perplexity AI when they
                    are generated.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="autoApprove"
                  checked={autoApprove}
                  onChange={(e) => setAutoApprove(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                />
                <div className="flex-1">
                  <label
                    htmlFor="autoApprove"
                    className="text-sm font-medium text-slate-700"
                  >
                    Auto-approve scripts
                  </label>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Automatically approve generated scripts without manual
                    review. Recommended for trusted AI outputs.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="autoCreate"
                  checked={autoCreate}
                  onChange={(e) => setAutoCreate(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                />
                <div className="flex-1">
                  <label
                    htmlFor="autoCreate"
                    className="text-sm font-medium text-slate-700"
                  >
                    Auto-generate videos
                  </label>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Automatically request video generation for approved scripts using
                    your default avatar. Works best when auto-approve is enabled.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-700">
                Default Platforms
                <span className="ml-2 text-xs font-normal text-slate-500">
                  (for automated posting)
                </span>
              </label>
              <div className="flex flex-wrap gap-2">
                {availablePlatforms.map((platform) => (
                  <button
                    key={platform}
                    type="button"
                    onClick={() => {
                      if (defaultPlatforms.includes(platform)) {
                        setDefaultPlatforms(
                          defaultPlatforms.filter((p) => p !== platform),
                        )
                      } else {
                        setDefaultPlatforms([...defaultPlatforms, platform])
                      }
                    }}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition ${
                      defaultPlatforms.includes(platform)
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {platform}
                    {defaultPlatforms.includes(platform) && (
                      <span className="ml-1">✓</span>
                    )}
                  </button>
                ))}
              </div>
              {defaultPlatforms.length === 0 && (
                <p className="text-xs text-slate-500">
                  Select at least one platform to enable automated distribution
                </p>
              )}
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

        {/* Edit Plan Modal */}
        <Modal
          isOpen={!!editPlanModal}
          onClose={() => {
            setEditPlanModal(null)
            // Reset form
            setPlanName('')
            setVideosPerDay(3)
            setStartDate(new Date().toISOString().split('T')[0])
            setEndDate('')
            setAutoScheduleTrigger('daily')
            setTriggerTime('09:00')
            setDefaultPlatforms([])
            setAutoApprove(false)
            setAutoCreate(false)
            setVideoTimes(['09:00', '14:00', '19:00'])
            setVideoTopics(['', '', ''])
          }}
          title="Edit Video Plan"
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

            <Select
              label="Schedule Trigger"
              value={autoScheduleTrigger}
              onChange={(e) =>
                setAutoScheduleTrigger(
                  e.target.value as 'daily' | 'time_based' | 'manual',
                )
              }
              options={[
                { value: 'daily', label: 'Daily at specific time' },
                { value: 'time_based', label: 'Based on scheduled post times' },
                { value: 'manual', label: 'Manual only' },
              ]}
            />

            {autoScheduleTrigger === 'daily' && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-700">
                  Trigger Time
                  <span className="ml-2 text-xs text-slate-500">
                    (Timezone: {timezone})
                  </span>
                </label>

                <div className="flex flex-wrap gap-2">
                  {timePresets.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setTriggerTime(preset.value)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                        triggerTime === preset.value
                          ? 'border-brand-500 bg-brand-50 text-brand-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {preset.label.split('(')[0].trim()}
                    </button>
                  ))}
                </div>

                <Input
                  label="Custom Time"
                  type="time"
                  value={triggerTime}
                  onChange={(e) => setTriggerTime(e.target.value)}
                  min="00:00"
                  max="23:59"
                />
              </div>
            )}

            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="editAutoResearch"
                  checked={autoResearch}
                  onChange={(e) => setAutoResearch(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                />
                <div>
                  <label
                    htmlFor="editAutoResearch"
                    className="text-sm font-medium text-slate-700"
                  >
                    Auto Research Topics
                  </label>
                  <p className="mt-1 text-xs text-slate-500">
                    Automatically research topics using Perplexity AI
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="editAutoApprove"
                  checked={autoApprove}
                  onChange={(e) => setAutoApprove(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                />
                <div>
                  <label
                    htmlFor="editAutoApprove"
                    className="text-sm font-medium text-slate-700"
                  >
                    Auto Approve Scripts
                  </label>
                  <p className="mt-1 text-xs text-slate-500">
                    Automatically approve generated scripts without manual
                    review
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="editAutoCreate"
                  checked={autoCreate}
                  onChange={(e) => setAutoCreate(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                />
                <div>
                  <label
                    htmlFor="editAutoCreate"
                    className="text-sm font-medium text-slate-700"
                  >
                    Auto Generate Videos
                  </label>
                  <p className="mt-1 text-xs text-slate-500">
                    Automatically start video generation for approved scripts. Works best
                    with auto approval enabled and requires a configured avatar.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                Default Platforms
              </label>
              <div className="flex flex-wrap gap-2">
                {availablePlatforms.map((platform) => (
                  <button
                    key={platform}
                    type="button"
                    onClick={() => {
                      const newPlatforms = defaultPlatforms.includes(platform)
                        ? defaultPlatforms.filter((p) => p !== platform)
                        : [...defaultPlatforms, platform]
                      setDefaultPlatforms(newPlatforms)
                    }}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                      defaultPlatforms.includes(platform)
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {platform.charAt(0).toUpperCase() + platform.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="ghost"
                onClick={() => {
                  setEditPlanModal(null)
                  setPlanName('')
                  setVideosPerDay(3)
                  setStartDate(new Date().toISOString().split('T')[0])
                  setEndDate('')
                  setAutoScheduleTrigger('daily')
                  setTriggerTime('09:00')
                  setDefaultPlatforms([])
                  setAutoApprove(false)
                  setAutoCreate(false)
                  setVideoTimes(['09:00', '14:00', '19:00'])
                  setVideoTopics(['', '', ''])
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSavePlan}
                loading={editingPlan}
                leftIcon={<Save className="h-4 w-4" />}
              >
                Save Changes
              </Button>
            </div>
          </div>
        </Modal>

        {/* Delete Plan Modal */}
        <Modal
          isOpen={!!deleteModal}
          onClose={() => setDeleteModal(null)}
          title="Delete Plan"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Are you sure you want to delete this plan? This will also delete
              all associated plan items. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="ghost"
                onClick={() => setDeleteModal(null)}
                className="border border-white/60 bg-white/70 text-slate-500 hover:border-slate-200 hover:bg-white"
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDeletePlan}
                loading={deleting}
              >
                Delete Plan
              </Button>
            </div>
          </div>
        </Modal>

        {/* Script Preview Modal */}
        <Modal
          isOpen={!!scriptPreviewItem}
          onClose={() => setScriptPreviewItem(null)}
          title="Review Script"
        >
          {scriptPreviewItem && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-primary">
                  {scriptPreviewItem.topic}
                </h3>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="whitespace-pre-wrap text-sm text-slate-700">
                  {scriptPreviewItem.script}
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="ghost"
                  onClick={() => handleRejectScript(scriptPreviewItem.id)}
                  leftIcon={<X className="h-4 w-4" />}
                >
                  Reject
                </Button>
                <Button
                  onClick={() => handleApproveScript(scriptPreviewItem.id)}
                  leftIcon={<Check className="h-4 w-4" />}
                >
                  Approve
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </Layout>
  )
}
