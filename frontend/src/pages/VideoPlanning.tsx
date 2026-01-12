import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
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
  Check,
  Clapperboard,
  Clock,
  RefreshCw,
  Loader,
  PenSquare,
  X,
  Edit2,
  Save,
  Trash2,
  FileText,
  ExternalLink,
  Video,
} from 'lucide-react'
import api from '../lib/api'
import { timezones } from '../lib/timezones'

const STATUS_FILTER_KEY = 'video_planning_status_filter'

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
  timezone?: string
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
  // avatar_id removed - using Sora for video generation
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
  created_at?: string
  updated_at?: string
}

interface ScheduledPost {
  id: string
  video_id: string
  platform: 'instagram' | 'tiktok' | 'youtube' | 'facebook' | 'twitter'
  scheduled_time: string | null
  status: 'pending' | 'posted' | 'failed' | 'cancelled' | 'scheduled'
  posted_at: string | null
  error_message: string | null
  videos?: {
    topic: string
    video_url: string | null
  } | null
}

export function VideoPlanning() {
  const navigate = useNavigate()
  const [plans, setPlans] = useState<VideoPlan[]>([])
  const [selectedPlan, setSelectedPlan] = useState<VideoPlan | null>(null)
  const [planItems, setPlanItems] = useState<VideoPlanItem[]>([])
  const [loading, setLoading] = useState(true)
  const [createModal, setCreateModal] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    // Initialize with today's date in YYYY-MM-DD format using local timezone
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  })
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    if (typeof window === 'undefined') return 'all'
    return localStorage.getItem(STATUS_FILTER_KEY) || 'all'
  })
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
  const [timezone, setTimezone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  )
  const [videoTimes, setVideoTimes] = useState<string[]>([
    '09:00',
    '14:00',
    '19:00',
  ]) // Default times for 3 videos
  const [videoTopics, setVideoTopics] = useState<string[]>(['', '', '']) // Topics for each video slot
  // Avatar-related state removed - using Sora for video generation
  const [deleteModal, setDeleteModal] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [editPlanModal, setEditPlanModal] = useState<VideoPlan | null>(null)
  const [editingPlan, setEditingPlan] = useState(false)
  const [selectedItem, setSelectedItem] = useState<VideoPlanItem | null>(null)
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([])
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false)


  // Preset times for quick selection
  const timePresets = [
    { label: 'Morning (9:00 AM)', value: '09:00' },
    { label: 'Midday (12:00 PM)', value: '12:00' },
    { label: 'Afternoon (3:00 PM)', value: '15:00' },
    { label: 'Evening (6:00 PM)', value: '18:00' },
  ]




  // Persist compact status filter choice
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STATUS_FILTER_KEY, statusFilter)
    }
  }, [statusFilter])

  // Avatar-related functions removed - using Sora for video generation

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
    loadUserPreferences()
  }, [])

  const loadUserPreferences = async () => {
    try {
      const response = await api.get('/api/preferences')
      if (response.data.preferences?.timezone) {
        setTimezone(response.data.preferences.timezone)
      }
    } catch (error) {
      console.error('Failed to load user preferences:', error)
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem('videoPlanning.statusFilter', statusFilter)
  }, [statusFilter])

  // Avatar-related useEffect removed - using Sora for video generation

  useEffect(() => {
    if (selectedPlan) {
      loadPlanItems(selectedPlan.id)
      // Navigate calendar to plan start date so items are visible
      if (selectedPlan.start_date) {
        const planStartDate = new Date(selectedPlan.start_date)
        setCurrentMonth(planStartDate)
        // Set selected date to plan start date
        const year = planStartDate.getFullYear()
        const month = String(planStartDate.getMonth() + 1).padStart(2, '0')
        const day = String(planStartDate.getDate()).padStart(2, '0')
        setSelectedDate(`${year}-${month}-${day}`)
      }
    }
    loadScheduledPosts()
  }, [selectedPlan])

  useEffect(() => {
    setSelectedItem(null)
    setIsDetailDrawerOpen(false)
  }, [selectedPlan?.id])

  useEffect(() => {
    // Reload scheduled posts periodically to show updates
    // Use a longer interval to reduce API calls
    const interval = setInterval(() => {
      loadScheduledPosts()
    }, 30000) // Poll every 30 seconds (reduced from 10 seconds)

    return () => clearInterval(interval)
  }, [])

  // Smart polling for plan items - only poll frequently when items are in progress
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastPollTimeRef = useRef<number>(0)

  useEffect(() => {
    if (!selectedPlan) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
      return
    }

    const planId = selectedPlan.id

    // Check if there are items in active states that need frequent updates
    const hasActiveItems = () => {
      return planItems.some(item =>
        ['pending', 'researching', 'generating', 'ready', 'draft', 'approved'].includes(item.status)
      )
    }

    // Determine polling interval based on item states
    // If items are active, poll more frequently; otherwise poll less frequently
    const getPollInterval = () => {
      if (hasActiveItems()) {
        return 15000 // Poll every 15 seconds when items are active (reduced from 3 seconds)
      }
      return 60000 // Poll every 60 seconds when all items are stable
    }

    // Clear existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }

    const poll = async () => {
      const now = Date.now()
      // Throttle: don't poll more than once every 10 seconds
      if (now - lastPollTimeRef.current < 10000) {
        return
      }
      lastPollTimeRef.current = now

      await loadPlanItems(planId)

      // After loading, check if we need to adjust polling interval
      // Use a timeout to check after state updates
      setTimeout(() => {
        const newInterval = getPollInterval()
        // Only restart if interval changed significantly (more than 5 seconds difference)
        const currentInterval = pollingIntervalRef.current ? getPollInterval() : null
        if (!currentInterval || Math.abs(newInterval - currentInterval) > 5000) {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
          }
          pollingIntervalRef.current = setInterval(poll, newInterval)
        }
      }, 1000)
    }

    // Start polling with initial interval
    const initialInterval = getPollInterval()
    pollingIntervalRef.current = setInterval(poll, initialInterval)

    // Initial load
    poll()

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlan?.id])

  // Update polling interval when planItems change (but don't recreate the effect)
  useEffect(() => {
    if (!selectedPlan || !pollingIntervalRef.current) return

    const hasActiveItems = () => {
      return planItems.some(item =>
        ['pending', 'researching', 'generating', 'ready', 'draft', 'approved'].includes(item.status)
      )
    }

    const getPollInterval = () => {
      if (hasActiveItems()) {
        return 15000
      }
      return 60000
    }

    // Debounce the interval update
    const timeoutId = setTimeout(() => {
      const newInterval = getPollInterval()
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)

        const poll = async () => {
          const now = Date.now()
          if (now - lastPollTimeRef.current < 10000) {
            return
          }
          lastPollTimeRef.current = now
          await loadPlanItems(selectedPlan.id)
        }

        pollingIntervalRef.current = setInterval(poll, newInterval)
      }
    }, 2000)

    return () => clearTimeout(timeoutId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planItems, selectedPlan?.id])

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
      console.log(`[VideoPlanning] Loading plan items for plan ${planId}...`)
      const response = await api.get(`/api/plans/${planId}`)
      const items = response.data.items || []
      console.log(`[VideoPlanning] API response:`, {
        planId,
        itemsCount: items.length,
        responseData: response.data
      })
      setPlanItems(items)
      console.log(`[VideoPlanning] ✓ Loaded ${items.length} plan items for plan ${planId}`)
      if (items.length > 0) {
        console.log(`[VideoPlanning] Sample items:`, items.slice(0, 5).map((item: VideoPlanItem) => ({
          id: item.id,
          date: item.scheduled_date,
          dateType: typeof item.scheduled_date,
          time: item.scheduled_time,
          topic: item.topic,
          status: item.status
        })))
        // Log date range
        const dates = items.map((item: VideoPlanItem) => item.scheduled_date).filter(Boolean)
        if (dates.length > 0) {
          const sortedDates = [...new Set(dates)].sort()
          console.log(`[VideoPlanning] Date range: ${sortedDates[0]} to ${sortedDates[sortedDates.length - 1]} (${sortedDates.length} unique dates)`)
          console.log(`[VideoPlanning] All dates:`, sortedDates.slice(0, 10))
        }
      } else {
        console.warn(`[VideoPlanning] ⚠️ No plan items found for plan ${planId}. Plan might not have items created yet.`)
      }
    } catch (error: any) {
      console.error('Failed to load plan items:', error)
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      })
    }
  }

  const loadScheduledPosts = async () => {
    try {
      // Don't pass status parameter to get all scheduled posts
      const response = await api.get('/api/posts')
      const posts = response.data.posts || []
      setScheduledPosts(posts)
      console.log(`[VideoPlanning] Loaded ${posts.length} scheduled posts`)
    } catch (error) {
      console.error('Failed to load scheduled posts:', error)
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
        auto_research: true,
        auto_schedule_trigger: autoScheduleTrigger,
        trigger_time:
          autoScheduleTrigger === 'daily' ? `${triggerTime}:00` : null,
        timezone: timezone,
        default_platforms:
          defaultPlatforms.length > 0 ? defaultPlatforms : null,
        auto_approve: true,
        auto_create: true,
        video_times: videoTimes.map((time: string) => {
          // Ensure time is in HH:MM format (remove :00 if present, then add it back)
          const cleanTime = time.replace(/:00$/, '')
          return cleanTime.length === 5 ? cleanTime : time
        }), // Send custom times in HH:MM format
        video_topics: videoTopics, // Send topics for each slot
        // Avatars removed - using Sora for video generation
      })

      console.log(`[VideoPlanning] Plan creation response:`, {
        plan: response.data.plan,
        items: response.data.items,
        itemsCount: response.data.itemsCount ?? response.data.items?.length ?? 0,
        hasItems: response.data.hasItems ?? (!!response.data.items && response.data.items.length > 0),
        warning: response.data.warning
      })

      // Show warning if items generation had issues
      if (response.data.warning) {
        console.warn(`[VideoPlanning] ⚠️ Warning from server:`, response.data.warning)
        // You could show a toast notification here if you have a toast system
      }

      setPlans([response.data.plan, ...plans])
      setSelectedPlan(response.data.plan)

      // Navigate to plan start date
      if (response.data.plan.start_date) {
        const planStartDate = new Date(response.data.plan.start_date + 'T00:00:00') // Add time to avoid timezone issues
        setCurrentMonth(planStartDate)
        const year = planStartDate.getFullYear()
        const month = String(planStartDate.getMonth() + 1).padStart(2, '0')
        const day = String(planStartDate.getDate()).padStart(2, '0')
        setSelectedDate(`${year}-${month}-${day}`)
      }

      // Load plan items - use itemsCount/hasItems from response if available, otherwise check items array
      const itemsCount = response.data.itemsCount ?? response.data.items?.length ?? 0
      const hasItems = response.data.hasItems ?? (response.data.items && Array.isArray(response.data.items) && response.data.items.length > 0)

      if (hasItems && response.data.items && Array.isArray(response.data.items) && response.data.items.length > 0) {
        setPlanItems(response.data.items)
        console.log(`[VideoPlanning] ✓ Plan created with ${itemsCount} items`)
      } else {
        console.warn(`[VideoPlanning] ⚠️ Plan created but no items in response (itemsCount: ${itemsCount}, hasItems: ${hasItems}). Items array:`, response.data.items)
        if (response.data.warning) {
          console.warn(`[VideoPlanning] Server warning: ${response.data.warning}`)
        }
        // Wait a bit then try to load items (might be async creation or items were created but not returned)
        setTimeout(async () => {
          console.log(`[VideoPlanning] Attempting to load items for plan ${response.data.plan.id}...`)
          await loadPlanItems(response.data.plan.id)
        }, 1000)
      }
      setCreateModal(false)
      setPlanName('')
      setVideosPerDay(3)
      setStartDate(new Date().toISOString().split('T')[0])
      setEndDate('')
      // Avatar state reset removed - using Sora for video generation
      setAutoScheduleTrigger('daily')
      setTriggerTime('09:00')
      setDefaultPlatforms([])
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
    setAutoScheduleTrigger(plan.auto_schedule_trigger || 'daily')
    setTriggerTime(
      plan.trigger_time ? plan.trigger_time.substring(0, 5) : '09:00',
    )
    setDefaultPlatforms(plan.default_platforms || [])
    setTimezone(plan.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone)
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
        auto_research: true,
        auto_schedule_trigger: autoScheduleTrigger,
        trigger_time:
          autoScheduleTrigger === 'daily' ? `${triggerTime}:00` : null,
        default_platforms:
          defaultPlatforms.length > 0 ? defaultPlatforms : null,
        auto_approve: true,
        auto_create: true,
        timezone: timezone,
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
    const targetItem = editingItem || selectedItem
    if (!targetItem || !selectedPlan) return

    try {
      await api.patch(`/api/plans/items/${targetItem.id}`, {
        topic: editForm.topic || null,
        scheduled_time: editForm.scheduled_time || null,
        description: editForm.description || null,
        why_important: editForm.why_important || null,
        useful_tips: editForm.useful_tips || null,
        caption: editForm.caption || null,
        platforms: editForm.platforms.length > 0 ? editForm.platforms : null,
      })

      // Keep drawer data in sync for inline edits
      if (selectedItem && selectedItem.id === targetItem.id) {
        setSelectedItem({ ...selectedItem, ...editForm })
      }

      setEditingItem(null)
      loadPlanItems(selectedPlan.id)
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update item')
    }
  }

  // Calendar helper function - defined before use
  const getDateKey = (date: Date | null) => {
    if (!date) return ''
    // Format date as YYYY-MM-DD using local timezone (not UTC)
    // This matches the format from the database (scheduled_date)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Filter items by status (for plan items only, scheduled posts are shown separately)
  const filteredItems = useMemo(() => {
    if (statusFilter === 'all') return planItems
    if (statusFilter === 'active') {
      const activeStatuses = [
        'pending',
        'researching',
        'ready',
        'draft',
        'approved',
        'scheduled',
      ]
      return planItems.filter((item) => activeStatuses.includes(item.status))
    }
    if (statusFilter === 'completed') {
      return planItems.filter(
        (item) => item.status === 'completed' || item.status === 'posted',
      )
    }
    if (statusFilter === 'failed') {
      return planItems.filter((item) => item.status === 'failed')
    }
    return planItems.filter((item) => item.status === statusFilter)
  }, [planItems, statusFilter])

  // Filter scheduled posts by status
  const filteredPosts =
    statusFilter === 'all'
      ? scheduledPosts
      : statusFilter === 'scheduled' || statusFilter === 'pending'
        ? scheduledPosts.filter((p) => p.status === 'pending' || p.status === 'scheduled')
        : statusFilter === 'posted'
          ? scheduledPosts.filter((p) => p.status === 'posted')
          : statusFilter === 'failed'
            ? scheduledPosts.filter((p) => p.status === 'failed')
            : []

  // Group plan items by date
  // Normalize date format - database returns DATE type as YYYY-MM-DD string
  const normalizeDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return ''
    // PostgreSQL DATE type is returned as YYYY-MM-DD string, use it directly
    // Handle both DATE string and ISO timestamp formats
    const dateMatch = dateStr.match(/^(\d{4}-\d{2}-\d{2})/)
    if (dateMatch) {
      return dateMatch[1] // Return YYYY-MM-DD format
    }
    // Fallback: try to parse as date
    try {
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) return ''
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    } catch (e) {
      console.warn(`[VideoPlanning] Failed to parse date: ${dateStr}`)
      return ''
    }
  }

  // Use useMemo to avoid recalculating on every render
  const planItemsByDate = useMemo(() => {
    const grouped = filteredItems.reduce(
      (acc, item) => {
        // Database returns scheduled_date as YYYY-MM-DD string, use it directly
        const dateKey = normalizeDate(item.scheduled_date)
        if (!dateKey) {
          console.warn(`[VideoPlanning] Item ${item.id} has invalid scheduled_date:`, item.scheduled_date)
          return acc
        }
        if (!acc[dateKey]) acc[dateKey] = []
        acc[dateKey].push(item)
        return acc
      },
      {} as Record<string, VideoPlanItem[]>,
    )

    // Debug logging (only log once when items change)
    if (Object.keys(grouped).length > 0 && filteredItems.length > 0) {
      const dateKeys = Object.keys(grouped).sort()
      console.log(`[VideoPlanning] Grouped ${filteredItems.length} items into ${dateKeys.length} dates`, {
        firstDate: dateKeys[0],
        lastDate: dateKeys[dateKeys.length - 1],
        sampleDates: dateKeys.slice(0, 3).map(d => ({ date: d, count: grouped[d].length }))
      })
    }

    return grouped
  }, [filteredItems])

  // Debug warning if items exist but none are grouped
  useEffect(() => {
    if (planItems.length > 0 && Object.keys(planItemsByDate).length === 0) {
      console.warn(`[VideoPlanning] WARNING: ${planItems.length} items but none grouped!`, {
        sampleItems: planItems.slice(0, 3).map(item => ({
          id: item.id,
          scheduled_date: item.scheduled_date,
          normalized: normalizeDate(item.scheduled_date),
          status: item.status
        }))
      })
    }
  }, [planItems, planItemsByDate])

  // Group scheduled posts by date (using filtered posts)
  const postsByDate = useMemo(() => {
    return filteredPosts.reduce(
      (acc, post: ScheduledPost) => {
        if (!post.scheduled_time) return acc
        const date = new Date(post.scheduled_time)
        const dateKey = getDateKey(date)
        if (!dateKey) return acc
        if (!acc[dateKey]) acc[dateKey] = []
        acc[dateKey].push(post)
        return acc
      },
      {} as Record<string, ScheduledPost[]>,
    )
  }, [filteredPosts])

  // Combine plan items and scheduled posts by date
  type CalendarItem = VideoPlanItem | (ScheduledPost & { _isScheduledPost: true; scheduled_date: string; topic: string })
  const itemsByDate = useMemo(() => {
    const combined: Record<string, CalendarItem[]> = {}

    // Add plan items
    Object.keys(planItemsByDate).forEach(date => {
      combined[date] = [...(planItemsByDate[date] || [])]
    })

    // Add scheduled posts
    Object.keys(postsByDate).forEach(date => {
      if (!combined[date]) {
        combined[date] = []
      }
      // Add scheduled posts to the date, marking them as posts
      postsByDate[date].forEach((post: ScheduledPost) => {
        combined[date].push({
          ...post,
          _isScheduledPost: true,
          scheduled_date: date, // Add scheduled_date for compatibility
          topic: post.videos?.topic || 'Scheduled Post',
        })
      })
    })

    return combined
  }, [planItemsByDate, postsByDate])

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

  const getItemsForDate = (date: Date | null) => {
    if (!date) return []
    const dateKey = getDateKey(date)
    return itemsByDate[dateKey] || []
  }

  // Helper to check if an item is a scheduled post
  const isScheduledPost = (item: CalendarItem): item is ScheduledPost & { _isScheduledPost: true; scheduled_date: string; topic: string } => {
    return '_isScheduledPost' in item && (item as any)._isScheduledPost === true
  }


  const openDetailDrawer = (item: VideoPlanItem) => {
    setSelectedItem(item)
    setEditForm({
      topic: item.topic || '',
      scheduled_time: item.scheduled_time || '',
      description: item.description || '',
      why_important: item.why_important || '',
      useful_tips: item.useful_tips || '',
      caption: item.caption || '',
      platforms: item.platforms || [],
    })
    setIsDetailDrawerOpen(true)
  }

  const closeDetailDrawer = () => {
    setIsDetailDrawerOpen(false)
    setSelectedItem(null)
  }

  const clearSelection = () => { }


  const getStatusCounts = () => {
    const scheduledCount = scheduledPosts.filter((p) => p.status === 'pending' || p.status === 'scheduled').length
    const postedCount = scheduledPosts.filter((p) => p.status === 'posted').length

    return {
      all: planItems.length + scheduledPosts.length,
      pending: planItems.filter((i) => i.status === 'pending').length + scheduledCount,
      ready: planItems.filter((i) => i.status === 'ready').length,
      completed: planItems.filter((i) => i.status === 'completed').length,
      scheduled: planItems.filter((i) => i.status === 'scheduled').length + scheduledCount,
      posted: planItems.filter((i) => i.status === 'posted').length + postedCount,
      failed: planItems.filter((i) => i.status === 'failed').length + scheduledPosts.filter((p) => p.status === 'failed').length,
    }
  }

  const statusCounts = getStatusCounts()

  const getStatusBadge = (status: string, scriptStatus?: string | null, item?: VideoPlanItem) => {
    // Clear, user-friendly status labels that explain what's happening in the workflow

    // Handle rejected scripts first (highest priority)
    if (scriptStatus === 'rejected') {
      return <Badge variant="error">Script Rejected</Badge>
    }

    // Check if there are pending scheduled posts for this item (indicates publishing in progress)
    const itemScheduledPosts = item?.video_id
      ? scheduledPosts.filter(p => p.video_id === item.video_id)
      : []
    const hasPendingPosts = itemScheduledPosts.some(p => p.status === 'pending' || p.status === 'scheduled')
    const allPostsPublished = itemScheduledPosts.length > 0 && itemScheduledPosts.every(p => p.status === 'posted')

    // Determine the most descriptive label based on status and script_status
    let label = ''
    let variant: 'default' | 'success' | 'error' | 'warning' | 'info' = 'default'
    let showLoader = false

    switch (status) {
      case 'pending':
        label = 'Waiting to Start'
        variant = 'warning'
        break
      case 'researching':
        label = 'Gathering Research'
        variant = 'info'
        showLoader = true
        break
      case 'ready':
        label = 'Ready for Script'
        variant = 'info'
        break
      case 'draft':
        if (scriptStatus === 'draft') {
          label = 'Writing Script'
          showLoader = true
        } else {
          label = 'Draft'
        }
        variant = 'info'
        break
      case 'approved':
        if (scriptStatus === 'approved') {
          label = 'Script Ready'
        } else if (scriptStatus === 'draft') {
          label = 'Reviewing Script'
        } else {
          label = 'Approved'
        }
        variant = 'success'
        break
      case 'generating':
        label = 'Generating Video'
        variant = 'info'
        showLoader = true
        break
      case 'completed':
        // Check if there are pending posts (publishing in progress)
        if (hasPendingPosts) {
          label = 'Publishing'
          variant = 'info'
          showLoader = true
        } else if (allPostsPublished) {
          // All posts are published, but status might not be updated yet
          label = 'Published'
          variant = 'success'
        } else if (item?.scheduled_date && item?.scheduled_time) {
          const now = new Date()
          const scheduledDateTime = new Date(`${item.scheduled_date}T${item.scheduled_time}`)

          if (scheduledDateTime > now) {
            // Video is ready but waiting for post time
            label = 'Waiting for Post Time'
            variant = 'success'
          } else {
            // Post time has passed - likely publishing or about to publish
            label = 'Publishing'
            variant = 'info'
            showLoader = true
          }
        } else {
          // No scheduled time, video is ready
          label = 'Video Ready'
          variant = 'success'
        }
        break
      case 'scheduled':
        label = 'Scheduled to Post'
        variant = 'success'
        break
      case 'posted':
        label = 'Published'
        variant = 'success'
        break
      case 'failed':
        label = 'Error Occurred'
        variant = 'error'
        break
      default:
        label = status
        variant = 'default'
    }

    return (
      <Badge variant={variant}>
        {showLoader && <Loader className="h-3 w-3 animate-spin" />}
        {label}
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
                    className={`rounded-xl px-4 py-2 text-sm font-medium transition ${selectedPlan?.id === plan.id
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
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-6">
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
                  {statusCounts.scheduled > 0 && (
                    <div className="text-sm">
                      <span className="text-slate-600">Scheduled: </span>
                      <span className="font-semibold text-purple-600">
                        {statusCounts.scheduled}
                      </span>
                    </div>
                  )}
                  {statusCounts.posted > 0 && (
                    <div className="text-sm">
                      <span className="text-slate-600">Posted: </span>
                      <span className="font-semibold text-emerald-600">
                        {statusCounts.posted}
                      </span>
                    </div>
                  )}
                  {statusCounts.failed > 0 && (
                    <div className="text-sm">
                      <span className="text-slate-600">Failed: </span>
                      <span className="font-semibold text-red-600">
                        {statusCounts.failed}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { value: 'all', label: 'All' },
                    { value: 'pending', label: 'Pending' },
                    { value: 'ready', label: 'Ready' },
                    { value: 'approved', label: 'Approved' },
                    { value: 'scheduled', label: 'Scheduled' },
                    { value: 'posted', label: 'Posted' },
                    { value: 'failed', label: 'Failed' },
                  ].map((chip) => (
                    <button
                      key={chip.value}
                      onClick={() => setStatusFilter(chip.value)}
                      className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition ${statusFilter === chip.value
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-brand-200'
                        }`}
                    >
                      <span>{chip.label}</span>
                      {chip.value !== 'all' && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                          {statusCounts[
                            chip.value as keyof typeof statusCounts
                          ] || 0}
                        </span>
                      )}
                    </button>
                  ))}
                  <button
                    onClick={() => setStatusFilter('all')}
                    className="ml-auto text-xs font-medium text-slate-500 hover:text-slate-700"
                  >
                    Clear filter
                  </button>
                </div>
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
                    date && dateKey === getDateKey(new Date())
                  const isSelected = date && dateKey === selectedDate

                  return (
                    <button
                      key={index}
                      onClick={() => {
                        if (!date) return
                        setSelectedDate(dateKey)
                        setIsDetailDrawerOpen(true)
                      }}
                      className={`min-h-[120px] rounded-lg border p-2 text-left transition relative ${!date
                        ? 'border-transparent bg-transparent cursor-default'
                        : isSelected
                          ? 'border-brand-500 bg-brand-50 shadow-md'
                          : isToday
                            ? 'border-brand-300 bg-brand-50/70 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-brand-300 hover:bg-slate-50 hover:shadow-sm'
                        }`}
                      disabled={!date}
                      title={items.length > 0 ? `${items.length} item(s) scheduled` : ''}
                    >
                      {date && (
                        <>
                          <div className="flex items-center justify-between mb-1">
                            <div
                              className={`text-sm font-semibold ${isToday ? 'text-brand-600' : 'text-slate-700'}`}
                            >
                              {date.getDate()}
                            </div>
                            {items.length > 0 && (
                              <div className="flex items-center gap-1">
                                <div className="h-1.5 w-1.5 rounded-full bg-brand-500"></div>
                                <span className="text-xs font-medium text-slate-600">
                                  {items.length}
                                </span>
                              </div>
                            )}
                          </div>
                          {items.length > 0 && (
                            <div className="mt-1 space-y-1 max-h-[88px] overflow-y-auto">
                              {items.slice(0, 4).map((item) => {
                                const isPost = isScheduledPost(item)
                                let status: string
                                let displayTopic: string
                                let displayTime: string

                                if (isPost) {
                                  status = item.status
                                  displayTopic = item.videos?.topic || `${item.platform} Post`
                                  displayTime = item.scheduled_time
                                    ? new Date(item.scheduled_time).toLocaleTimeString('en-US', {
                                      hour: 'numeric',
                                      minute: '2-digit',
                                      hour12: true
                                    })
                                    : ''
                                } else {
                                  status = item.status
                                  // Show "Planned" or time if no topic, otherwise show topic
                                  if (item.topic) {
                                    displayTopic = item.topic
                                  } else if (item.scheduled_time) {
                                    displayTopic = `Planned (${formatTime(item.scheduled_time)})`
                                  } else {
                                    displayTopic = 'Planned'
                                  }
                                  displayTime = item.scheduled_time ? formatTime(item.scheduled_time) : ''
                                }

                                return (
                                  <div
                                    key={item.id}
                                    className={`truncate rounded px-1.5 py-1 text-xs border ${status === 'completed' ||
                                      status === 'posted'
                                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                      : status === 'scheduled'
                                        ? 'bg-purple-50 border-purple-200 text-purple-800'
                                        : status === 'ready'
                                          ? 'bg-blue-50 border-blue-200 text-blue-800'
                                          : status === 'generating'
                                            ? 'bg-indigo-50 border-indigo-200 text-indigo-800'
                                            : status === 'approved'
                                              ? 'bg-teal-50 border-teal-200 text-teal-800'
                                              : status === 'failed'
                                                ? 'bg-red-50 border-red-200 text-red-800'
                                                : status === 'pending'
                                                  ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
                                                  : status === 'researching'
                                                    ? 'bg-cyan-50 border-cyan-200 text-cyan-800'
                                                    : 'bg-slate-50 border-slate-200 text-slate-700'
                                      }`}
                                    title={`${displayTime ? displayTime + ' - ' : ''}${displayTopic} (${status})`}
                                  >
                                    <div className="flex items-center gap-1">
                                      {displayTime && (
                                        <span className="text-[10px] font-medium opacity-75">
                                          {displayTime}
                                        </span>
                                      )}
                                      <span className="flex-1 truncate font-medium">
                                        {displayTopic}
                                      </span>
                                    </div>
                                  </div>
                                )
                              })}
                              {items.length > 4 && (
                                <div className="text-xs font-medium text-slate-500 px-1.5 py-0.5 bg-slate-100 rounded">
                                  +{items.length - 4} more
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

              {/* Status Legend */}
              <div className="mt-6 pt-6 border-t border-slate-200">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Status Legend</h3>
                <div className="flex flex-wrap gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded border border-yellow-200 bg-yellow-50"></div>
                    <span className="text-slate-600">Pending</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded border border-cyan-200 bg-cyan-50"></div>
                    <span className="text-slate-600">Researching</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded border border-blue-200 bg-blue-50"></div>
                    <span className="text-slate-600">Ready</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded border border-teal-200 bg-teal-50"></div>
                    <span className="text-slate-600">Approved</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded border border-indigo-200 bg-indigo-50"></div>
                    <span className="text-slate-600">Generating</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded border border-emerald-200 bg-emerald-50"></div>
                    <span className="text-slate-600">Completed/Posted</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded border border-purple-200 bg-purple-50"></div>
                    <span className="text-slate-600">Scheduled</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded border border-red-200 bg-red-50"></div>
                    <span className="text-slate-600">Failed</span>
                  </div>
                </div>
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
                      .sort((a, b) => {
                        // Sort by scheduled_time, handling both plan items and scheduled posts
                        let timeA = ''
                        let timeB = ''

                        if (isScheduledPost(a)) {
                          // For scheduled posts, extract time from ISO string
                          timeA = a.scheduled_time ? new Date(a.scheduled_time).toISOString().substring(11, 16) : '00:00'
                        } else {
                          // For plan items, use scheduled_time directly (HH:MM format)
                          timeA = a.scheduled_time || '00:00'
                        }

                        if (isScheduledPost(b)) {
                          timeB = b.scheduled_time ? new Date(b.scheduled_time).toISOString().substring(11, 16) : '00:00'
                        } else {
                          timeB = b.scheduled_time || '00:00'
                        }

                        return timeA.localeCompare(timeB)
                      })
                      .map((item) => {
                        const isPost = isScheduledPost(item)
                        if (isPost) {
                          // Render scheduled post differently
                          const scheduledTime = item.scheduled_time
                          return (
                            <Card
                              key={item.id}
                              className="p-5 border-purple-200 bg-purple-50/50"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 space-y-3">
                                  <div className="flex items-center gap-3">
                                    <Clock className="h-4 w-4 text-slate-400" />
                                    <span className="text-sm font-medium text-slate-600">
                                      {scheduledTime ? new Date(scheduledTime).toLocaleTimeString('en-US', {
                                        hour: 'numeric',
                                        minute: '2-digit',
                                        hour12: true
                                      }) : 'No time set'}
                                    </span>
                                    <Badge variant={item.status === 'posted' ? 'success' : item.status === 'pending' ? 'warning' : item.status === 'failed' ? 'error' : 'default'}>
                                      {item.status === 'posted' ? 'Posted' : item.status === 'pending' ? 'Scheduled' : item.status === 'failed' ? 'Failed' : item.status}
                                    </Badge>
                                    <Badge variant="info">{item.platform}</Badge>
                                  </div>
                                  <div>
                                    <h3 className="font-semibold text-primary">
                                      {item.videos?.topic || 'Scheduled Post'}
                                    </h3>
                                    {item.videos && (
                                      <p className="mt-1 text-sm text-slate-600">
                                        Video ID: {item.video_id}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {item.video_id && (
                                    <Button
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        navigate(`/videos?videoId=${item.video_id}`)
                                      }}
                                      className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600"
                                    >
                                      View Video
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </Card>
                          )
                        }
                        // Render regular plan item (existing code)
                        return (
                          <Card
                            key={item.id}
                            className="p-5 cursor-pointer transition hover:shadow-md"
                            onClick={(e: React.MouseEvent<HTMLDivElement>) => {
                              // Don't open modal if clicking on buttons or interactive elements
                              const target = e.target as HTMLElement
                              if (target.closest('button') || target.closest('a') || editingItem?.id === item.id) {
                                return
                              }
                              openDetailDrawer(item)
                            }}
                          >
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
                                    item,
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
                                              className={`rounded-lg border px-2 py-1 text-xs font-medium transition ${editForm.scheduled_time ===
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
                                              className={`rounded-lg border px-2 py-1 text-xs font-medium transition ${editForm.platforms.includes(
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
                                              {item.platforms.map((platform: string) => (
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
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEditItem(item)}
                                  leftIcon={<Edit2 className="h-4 w-4" />}
                                >
                                  {item.topic ? 'Edit Item' : 'Set Topic'}
                                </Button>
                                {item.status === 'pending' && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleGenerateTopic(item.id)}
                                    leftIcon={<Sparkles className="h-4 w-4" />}
                                  >
                                    {item.topic ? 'Regenerate' : 'Auto Generate'}
                                  </Button>
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
                                  <Button
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      navigate(`/videos?videoId=${item.video_id}`)
                                    }}
                                    className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600"
                                  >
                                    View Video
                                  </Button>
                                )}
                              </div>
                            </div>
                          </Card>
                        )
                      })}
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

        {/* Item Detail Modal */}
        <Modal
          isOpen={isDetailDrawerOpen && !!selectedItem}
          onClose={closeDetailDrawer}
          title={selectedItem?.topic || 'Video Detail'}
          size="xl"
        >
          {selectedItem && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Preview/Video */}
              <div className="space-y-4">
                <div className="aspect-video w-full rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
                  {selectedItem.video_id ? (
                    <div className="text-center p-4">
                      <Video className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">Video generated (ID: {selectedItem.video_id})</p>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/videos?videoId=${selectedItem.video_id}`)}
                      >
                        View Full Video
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center p-4">
                      <Clapperboard className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">Video preview will appear here once generated</p>
                    </div>
                  )}
                </div>

                <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-700">Script</p>
                    {selectedItem.script_status && (
                      <Badge variant="info">Script: {selectedItem.script_status}</Badge>
                    )}
                  </div>
                  <div className="max-h-[300px] overflow-y-auto rounded border border-slate-200 bg-white p-3 text-sm text-slate-700">
                    {selectedItem.script ? (
                      <pre className="whitespace-pre-wrap font-sans leading-relaxed">
                        {selectedItem.script}
                      </pre>
                    ) : (
                      <p className="text-slate-500 italic">No script generated yet.</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleGenerateTopic(selectedItem.id)}
                      leftIcon={<Sparkles className="h-4 w-4" />}
                    >
                      Regenerate
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        api
                          .post(`/api/plans/items/${selectedItem.id}/generate-script`)
                          .then(() => selectedPlan && loadPlanItems(selectedPlan.id))
                      }
                      leftIcon={<PenSquare className="h-4 w-4" />}
                    >
                      Regenerate Script
                    </Button>
                  </div>
                </div>
              </div>

              {/* Right Column: Details/Form */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                  <Clock className="h-4 w-4" />
                  <span>{formatTime(selectedItem.scheduled_time)}</span>
                  <span className="text-slate-300">|</span>
                  <span>{selectedItem.scheduled_date}</span>
                  {getStatusBadge(
                    selectedItem.status,
                    selectedItem.script_status,
                    selectedItem,
                  )}
                </div>

                <div className="space-y-4">
                  <Input
                    label="Topic"
                    value={editForm.topic}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, topic: e.target.value }))
                    }
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Posting Time"
                      type="time"
                      value={editForm.scheduled_time}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setEditForm((prev: any) => ({
                          ...prev,
                          scheduled_time: e.target.value,
                        }))
                      }
                    />
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-slate-700">
                        Platforms
                      </label>
                      <div className="flex flex-wrap gap-1">
                        {availablePlatforms.map((platform) => (
                          <button
                            key={platform}
                            type="button"
                            onClick={() => {
                              const newPlatforms = editForm.platforms.includes(
                                platform,
                              )
                                ? editForm.platforms.filter((p: string) => p !== platform)
                                : [...editForm.platforms, platform]
                              setEditForm((prev: any) => ({
                                ...prev,
                                platforms: newPlatforms,
                              }))
                            }}
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize transition ${editForm.platforms.includes(platform)
                              ? 'border-brand-500 bg-brand-50 text-brand-700'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-brand-200'
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
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setEditForm((prev: any) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    rows={3}
                  />
                  <Textarea
                    label="Caption"
                    value={editForm.caption}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setEditForm((prev: any) => ({
                        ...prev,
                        caption: e.target.value,
                      }))
                    }
                    rows={2}
                  />
                </div>

                <div className="flex items-center justify-between gap-3 pt-6 border-t border-slate-100">
                  <div className="flex gap-2">
                    {selectedItem.status === 'approved' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleCreateVideo(selectedItem)}
                        leftIcon={<Video className="h-4 w-4" />}
                      >
                        Create Video
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={closeDetailDrawer}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={async () => {
                        await handleSaveItem()
                        closeDetailDrawer()
                      }}
                      leftIcon={<Save className="h-4 w-4" />}
                    >
                      Save Changes
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Modal>

        {/* Create Plan Modal */}
        <Modal
          isOpen={createModal}
          onClose={() => {
            setCreateModal(false)
            setCreateStep(1)

          }}
          title="Create Video Plan"
        >
          <div className="space-y-6">
            <div className="text-xs text-slate-500">Timezone: {timezone}</div>
          </div>

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
              label="Plan Timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              options={timezones}
            />

            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <label className="block text-sm font-medium text-slate-700">
                Social media where this video will be posted
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
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition ${defaultPlatforms.includes(platform)
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
            </div>

            <div className="flex items-center justify-end pt-2">
              <Button
                onClick={handleCreatePlan}
                loading={creating}
              >
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
            setTriggerTime('09:00')
            setDefaultPlatforms([])
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
              label="Plan Timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              options={timezones}
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
                  (Timezone: {timezone})
                </label>

                <div className="flex flex-wrap gap-2">
                  {timePresets.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setTriggerTime(preset.value)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${triggerTime === preset.value
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


            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                Social media where this video will be posted
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
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${defaultPlatforms.includes(platform)
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

        {/* Edit Plan Item Modal */}
        <Modal
          isOpen={!!editingItem}
          onClose={() => setEditingItem(null)}
          title="Edit Plan Item"
          size="lg"
        >
          {editingItem && (
            <div className="space-y-4">


              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label="Topic"
                  value={editForm.topic}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, topic: e.target.value }))
                  }
                  placeholder="Enter topic"
                />
                <Input
                  label="Scheduled Time"
                  type="time"
                  value={editForm.scheduled_time}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      scheduled_time: e.target.value,
                    }))
                  }
                />
              </div>

              <Textarea
                label="Description"
                value={editForm.description}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
              />

              <Textarea
                label="Why it matters"
                value={editForm.why_important}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    why_important: e.target.value,
                  }))
                }
              />

              <Textarea
                label="Useful tips"
                value={editForm.useful_tips}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    useful_tips: e.target.value,
                  }))
                }
              />

              <Textarea
                label="Caption"
                value={editForm.caption}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    caption: e.target.value,
                  }))
                }
              />

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost" onClick={() => setEditingItem(null)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveItem} leftIcon={<Save className="h-4 w-4" />}>
                  Save changes
                </Button>
              </div>
            </div>
          )}
        </Modal>

        {/* Plan Item Details Modal */}
        <Modal
          isOpen={selectedItem !== null}
          onClose={() => setSelectedItem(null)}
          title="Plan Item Details"
          size="lg"
        >
          {selectedItem && (() => {
            // Get all items for the selected item's date
            const itemDate = selectedItem.scheduled_date
            const itemsForDate = planItems.filter(item => item.scheduled_date === itemDate)
              .sort((a, b) => {
                // Sort by scheduled_time
                const timeA = a.scheduled_time || '00:00'
                const timeB = b.scheduled_time || '00:00'
                return timeA.localeCompare(timeB)
              })

            // Find current item index
            const currentIndex = itemsForDate.findIndex(item => item.id === selectedItem.id)
            const hasPrev = currentIndex > 0
            const hasNext = currentIndex < itemsForDate.length - 1

            const navigateToItem = (direction: 'prev' | 'next') => {
              if (direction === 'prev' && hasPrev) {
                setSelectedItem(itemsForDate[currentIndex - 1])
              } else if (direction === 'next' && hasNext) {
                setSelectedItem(itemsForDate[currentIndex + 1])
              }
            }

            return (
              <div className="space-y-6">
                {/* Pagination Navigation - matching calendar style */}
                {itemsForDate.length > 1 && (
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-2">
                    <div className="text-sm text-slate-600">
                      Item {currentIndex + 1} of {itemsForDate.length}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigateToItem('prev')}
                        disabled={!hasPrev}
                      >
                        ← Prev
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigateToItem('next')}
                        disabled={!hasNext}
                      >
                        Next →
                      </Button>
                    </div>
                  </div>
                )}

                {/* Header Info */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Scheduled Time
                    </label>
                    <p className="mt-1 text-sm font-medium text-primary">
                      {formatTime(selectedItem.scheduled_time)}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Scheduled Date
                    </label>
                    <p className="mt-1 text-sm font-medium text-primary">
                      {new Date(selectedItem.scheduled_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Status
                    </label>
                    <div className="mt-1">
                      {getStatusBadge(selectedItem.status, selectedItem.script_status, selectedItem)}
                    </div>
                  </div>
                </div>

                {/* Topic */}
                {selectedItem.topic && (
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Topic
                    </label>
                    <p className="mt-1 text-lg font-semibold text-primary">
                      {selectedItem.topic}
                    </p>
                  </div>
                )}

                {/* Category */}
                {selectedItem.category && (
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Category
                    </label>
                    <p className="mt-1 text-sm font-medium text-primary">
                      {selectedItem.category}
                    </p>
                  </div>
                )}

                {/* Avatar display removed - using Sora for video generation */}

                {/* Description */}
                {selectedItem.description && (
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Description
                    </label>
                    <p className="mt-1 text-sm text-slate-700">
                      {selectedItem.description}
                    </p>
                  </div>
                )}

                {/* Why Important */}
                {selectedItem.why_important && (
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Why It Matters
                    </label>
                    <p className="mt-1 text-sm text-slate-700">
                      {selectedItem.why_important}
                    </p>
                  </div>
                )}

                {/* Useful Tips */}
                {selectedItem.useful_tips && (
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Useful Tips
                    </label>
                    <p className="mt-1 text-sm text-slate-700">
                      {selectedItem.useful_tips}
                    </p>
                  </div>
                )}

                {/* Script */}
                {selectedItem.script && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-slate-400" />
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Script
                      </label>
                      {selectedItem.script_status && (
                        <Badge variant={selectedItem.script_status === 'approved' ? 'success' : selectedItem.script_status === 'rejected' ? 'error' : 'info'}>
                          {selectedItem.script_status === 'approved' ? 'Approved' :
                            selectedItem.script_status === 'rejected' ? 'Rejected' :
                              'Draft'}
                        </Badge>
                      )}
                    </div>
                    <Textarea
                      value={selectedItem.script}
                      readOnly
                      rows={8}
                      className="font-mono text-sm"
                    />
                    {selectedItem.script_status === 'draft' && (
                      <div className="flex gap-3 pt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            handleRejectScript(selectedItem.id)
                            setSelectedItem(null)
                          }}
                          leftIcon={<X className="h-4 w-4" />}
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            handleApproveScript(selectedItem.id)
                            setSelectedItem(null)
                          }}
                          leftIcon={<Check className="h-4 w-4" />}
                        >
                          Approve
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Caption */}
                {selectedItem.caption && (
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Social Media Caption
                    </label>
                    <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">
                      {selectedItem.caption}
                    </p>
                  </div>
                )}

                {/* Platforms */}
                {selectedItem.platforms && selectedItem.platforms.length > 0 && (
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Platforms
                    </label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedItem.platforms.map((platform) => (
                        <Badge key={platform} variant="default">
                          {platform}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Video Link */}
                {selectedItem.video_id && (
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Video
                    </label>
                    <div className="mt-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/videos?videoId=${selectedItem.video_id}`)}
                        leftIcon={<ExternalLink className="h-4 w-4" />}
                      >
                        View Video
                      </Button>
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {selectedItem.error_message && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                    <label className="text-xs font-semibold uppercase tracking-wide text-rose-700">
                      Error Message
                    </label>
                    <p className="mt-1 text-sm text-rose-600">
                      {selectedItem.error_message}
                    </p>
                  </div>
                )}

                {/* Timestamps */}
                {(selectedItem.created_at || selectedItem.updated_at) && (
                  <div className="grid grid-cols-2 gap-4 border-t border-slate-200 pt-4">
                    {selectedItem.created_at && (
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Created
                        </label>
                        <p className="mt-1 text-sm font-medium text-primary">
                          {new Date(selectedItem.created_at).toLocaleString()}
                        </p>
                      </div>
                    )}
                    {selectedItem.updated_at && (
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Updated
                        </label>
                        <p className="mt-1 text-sm font-medium text-primary">
                          {new Date(selectedItem.updated_at).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 border-t border-slate-200 pt-4">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setEditingItem(selectedItem)
                      setEditForm({
                        topic: selectedItem.topic || '',
                        scheduled_time: selectedItem.scheduled_time || '',
                        description: selectedItem.description || '',
                        why_important: selectedItem.why_important || '',
                        useful_tips: selectedItem.useful_tips || '',
                        caption: selectedItem.caption || '',
                        platforms: selectedItem.platforms || [],
                      })
                      setSelectedItem(null)
                    }}
                    leftIcon={<Edit2 className="h-4 w-4" />}
                  >
                    Edit
                  </Button>
                  {(selectedItem.status === 'completed' || selectedItem.status === 'scheduled' || selectedItem.status === 'generating') && selectedItem.video_id && (
                    <Button
                      variant="ghost"
                      onClick={async () => {
                        try {
                          const response = await api.post(`/api/plans/items/${selectedItem.id}/refresh-status`)
                          if (response.data.item) {
                            // Update the item in the planItems array
                            setPlanItems(prevItems =>
                              prevItems.map(item =>
                                item.id === selectedItem.id ? response.data.item : item
                              )
                            )
                            // Update selectedItem
                            setSelectedItem(response.data.item)
                            console.log('[VideoPlanning] Status refreshed:', response.data.message)
                          }
                        } catch (error: any) {
                          console.error('[VideoPlanning] Error refreshing status:', error)
                        }
                      }}
                      leftIcon={<RefreshCw className="h-4 w-4" />}
                    >
                      Refresh Status
                    </Button>
                  )}
                  {selectedItem.script && selectedItem.script_status === 'draft' && (
                    <>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          handleRejectScript(selectedItem.id)
                          setSelectedItem(null)
                        }}
                        leftIcon={<X className="h-4 w-4" />}
                      >
                        Reject Script
                      </Button>
                      <Button
                        onClick={() => {
                          handleApproveScript(selectedItem.id)
                          setSelectedItem(null)
                        }}
                        leftIcon={<Check className="h-4 w-4" />}
                      >
                        Approve Script
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )
          })()}
        </Modal>

        {/* Avatar and Look Selection Modals removed - using Sora for video generation */}
      </div >
    </Layout >
  )
}
