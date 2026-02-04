import React, { useState, useEffect, useRef, useMemo } from 'react'
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
import { normalizeTimezone, timezones } from '../lib/timezones'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { useCreditsContext } from '../contexts/CreditContext'
import { CreditBanner } from '../components/ui/CreditBanner'

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
  // avatar_id removed - using AI video generation
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
  videos?: {
    status?: string | null
    topic?: string | null
    video_url?: string | null
  } | null
  error_message: string | null
  created_at?: string
  updated_at?: string
}

interface SocialAccount {
  id: string
  platform: string
  status: string
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
  const { t, language } = useLanguage()
  const { user } = useAuth()
  const { credits, unlimited, loading: creditsLoading } = useCreditsContext()
  const hasSubscription = !!(user?.hasActiveSubscription || user?.role === 'admin')
  const safeCanCreate = hasSubscription || (credits !== null && credits > 0) || unlimited
  const showUpgrade = !creditsLoading && !safeCanCreate
  const navigate = useNavigate()
  const [plans, setPlans] = useState<VideoPlan[]>([])
  const [selectedPlan, setSelectedPlan] = useState<VideoPlan | null>(null)
  const [planItems, setPlanItems] = useState<VideoPlanItem[]>([])
  const [loading, setLoading] = useState(true)
  const [varietyMetrics, setVarietyMetrics] = useState<any>(null)
  const [createModal, setCreateModal] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    // Initialize with today's date in YYYY-MM-DD format using local timezone
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  })
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([])
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
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split('T')[0],
  )
  const [endDate, setEndDate] = useState('')
  const [triggerTime, setTriggerTime] = useState('08:00')
  const [defaultPlatforms, setDefaultPlatforms] = useState<string[]>([])
  const [timezone, setTimezone] = useState(
    () => normalizeTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone) || 'UTC',
  )
  const [videosPerDay, setVideosPerDay] = useState(3)
  const [videoTimes, setVideoTimes] = useState<string[]>(['09:00', '12:00', '15:00']) // Initial video slots
  const [videoTopics, setVideoTopics] = useState<string[]>(['', '', '']) // Topics for each video slot
  // Avatar-related state removed - using AI video generation
  const [deleteModal, setDeleteModal] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [editPlanModal, setEditPlanModal] = useState<VideoPlan | null>(null)
  const [editingPlan, setEditingPlan] = useState(false)
  const [selectedItem, setSelectedItem] = useState<VideoPlanItem | null>(null)
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([])
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false)
  // Preset times for quick selection
  const timePresets = [
    { label: t('video_planning.morning_preset'), value: '09:00' },
    { label: t('video_planning.midday_preset'), value: '12:00' },
    { label: t('video_planning.afternoon_preset'), value: '15:00' },
    { label: t('video_planning.evening_preset'), value: '18:00' },
  ]
  // Persist compact status filter choice
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STATUS_FILTER_KEY, statusFilter)
    }
  }, [statusFilter])

  // Avatar-related functions removed - using AI video generation


  const [creating, setCreating] = useState(false)
  const loadSocialAccounts = async () => {
    try {
      const response = await api.get('/api/social/accounts')
      const accounts = response.data.accounts || []
      setSocialAccounts(accounts)

      // Auto-select connected platforms by default for new plans
      const connected = accounts
        .filter((acc: SocialAccount) => acc.status === 'connected')
        .map((acc: SocialAccount) => acc.platform)
      setDefaultPlatforms(connected)
    } catch (error) {
      console.error('Failed to load social accounts:', error)
    }
  }

  useEffect(() => {
    loadPlans()
    loadUserPreferences()
    loadSocialAccounts()
  }, [])

  const loadUserPreferences = async () => {
    try {
      const response = await api.get('/api/preferences')
      if (response.data.preferences?.timezone) {
        setTimezone(normalizeTimezone(response.data.preferences.timezone) || 'UTC')
      }
    } catch (error) {
      console.error('Failed to load user preferences:', error)
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem('videoPlanning.statusFilter', statusFilter)
  }, [statusFilter])

  // Avatar-related useEffect removed - using AI video generation

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
  const pollingIntervalRef = useRef<any | null>(null)
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

      // Load variety metrics if we have plans
      if (response.data.plans && response.data.plans.length > 0) {
        loadVarietyMetrics()
      }
    } catch (error: any) {
      console.error('Failed to load plans:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadVarietyMetrics = async () => {
    try {
      const response = await api.get('/api/plans/variety-analysis?days=30')
      setVarietyMetrics(response.data.analysis)
    } catch (error: any) {
      console.error('Failed to load variety metrics:', error)
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

  const getDefaultTimeForIndex = (index: number) => {
    const defaultTimes = ['09:00', '12:00', '15:00', '18:00']
    return defaultTimes[index] || '12:00'
  }

  const setVideoSlotCount = (count: number) => {
    const nextCount = Math.max(1, Math.min(count, 10))
    setVideosPerDay(nextCount)
    setVideoTimes((prev) => {
      const next = [...prev]
      while (next.length < nextCount) {
        next.push(getDefaultTimeForIndex(next.length))
      }
      return next.slice(0, nextCount)
    })
    setVideoTopics((prev) => {
      const next = [...prev]
      while (next.length < nextCount) {
        next.push('')
      }
      return next.slice(0, nextCount)
    })
  }

  const addVideoSlot = () => {
    setVideoSlotCount(videoTimes.length + 1)
  }

  const removeVideoSlot = (index: number) => {
    if (videoTimes.length <= 1) return
    const newTimes = videoTimes.filter((_: any, i: number) => i !== index)
    const newTopics = videoTopics.filter((_: any, i: number) => i !== index)
    setVideoTimes(newTimes)
    setVideoTopics(newTopics)
    setVideosPerDay(newTimes.length)
  }

  const updateVideoSlotTime = (index: number, time: string) => {
    const newTimes = [...videoTimes]
    newTimes[index] = time
    setVideoTimes(newTimes)
  }

  const updateVideoSlotTopic = (index: number, topic: string) => {
    const newTopics = [...videoTopics]
    newTopics[index] = topic
    setVideoTopics(newTopics)
  }

  const handleCreatePlan = async () => {
    if (creditsLoading) {
      return
    }
    if (!safeCanCreate) {
      alert(t('common.upgrade_required') || 'Subscription Required')
      return
    }

    if (!planName || !startDate || !videoTopics.some((t: string) => t.trim() !== '')) {
      alert(t('video_planning.create_plan_alert'))
      return
    }

    setCreating(true)
    try {
      const response = await api.post('/api/plans', {
        name: planName,
        videos_per_day: videoTimes.length,
        start_date: startDate,
        end_date: endDate || null,
        auto_research: true,
        auto_schedule_trigger: 'daily',
        trigger_time:
          `${triggerTime}:00`,
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
        video_topics: videoTopics.filter((t: string) => t.trim() !== ''), // Send only non-empty topics
        // Avatars removed - using AI video generation
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
      setStartDate(new Date().toISOString().split('T')[0])
      setEndDate('')
      // Avatar state reset removed - using AI video generation
      setTriggerTime('08:00')
      setDefaultPlatforms([])
      setVideosPerDay(3)
      setVideoTimes(['09:00', '12:00', '15:00'])
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
      alert(error.response?.data?.error || t('video_planning.approve_script_failed'))
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
      alert(error.response?.data?.error || t('video_planning.reject_script_failed'))
    }
  }

  const handleGenerateTopic = async (itemId: string) => {
    try {
      await api.post(`/api/plans/items/${itemId}/generate-topic`)
      if (selectedPlan) {
        loadPlanItems(selectedPlan.id)
      }
    } catch (error: any) {
      alert(error.response?.data?.error || t('video_planning.generate_topic_failed'))
    }
  }

  const handleCreateVideo = async (item: VideoPlanItem) => {
    try {
      await api.post(`/api/plans/items/${item.id}/create-video`, {
        style: 'Realistic',
        duration: 30,
      })
      if (selectedPlan) {
        loadPlanItems(selectedPlan.id)
      }
    } catch (error: any) {
      alert(error.response?.data?.error || t('video_planning.create_video_failed'))
    }
  }

  const handleEditPlan = (plan: VideoPlan) => {
    setEditPlanModal(plan)
    setPlanName(plan.name)
    setStartDate(plan.start_date.split('T')[0])
    setEndDate(plan.end_date ? plan.end_date.split('T')[0] : '')
    setTriggerTime(
      plan.trigger_time ? plan.trigger_time.substring(0, 5) : '08:00',
    )
    setDefaultPlatforms(plan.default_platforms || [])
    setTimezone(normalizeTimezone(plan.timezone) || normalizeTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone) || 'UTC')
    // Load existing video times and topics from plan items if needed
    // For now, use defaults based on plan.videos_per_day count
    setVideosPerDay(plan.videos_per_day || 1)
    setVideoTimes(Array(plan.videos_per_day).fill('09:00').map((_, i) => {
      // Very rough approximation - ideally we fetch items here
      return ['09:00', '14:00', '19:00', '21:00', '12:00'][i] || '09:00'
    }).slice(0, plan.videos_per_day))
    setVideoTopics(Array(plan.videos_per_day).fill(''))
  }

  const handleSavePlan = async () => {
    if (!editPlanModal || !planName || !startDate) {
      alert(t('video_planning.update_plan_alert'))
      return
    }

    setEditingPlan(true)
    try {
      await api.patch(`/api/plans/${editPlanModal.id}`, {
        name: planName,
        videos_per_day: videoTimes.length,
        start_date: startDate,
        end_date: endDate || null,
        auto_research: true,
        auto_schedule_trigger: 'daily',
        trigger_time:
          `${triggerTime}:00`,
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
      setStartDate(new Date().toISOString().split('T')[0])
      setEndDate('')
      setTriggerTime('08:00')
      setDefaultPlatforms([])
      setVideosPerDay(3)
      setVideoTimes(['09:00', '12:00', '15:00'])
      setVideoTopics(['', '', ''])
    } catch (error: any) {
      alert(error.response?.data?.error || t('video_planning.update_plan_failed'))
    } finally {
      setEditingPlan(false)
    }
  }

  const handleDeletePlan = async () => {
    if (!deleteModal) return

    setDeleting(true)
    try {
      await api.delete(`/api/plans/${deleteModal}`)
      setPlans(plans.filter((p: VideoPlan) => p.id !== deleteModal))
      if (selectedPlan?.id === deleteModal) {
        const remainingPlans = plans.filter((p: VideoPlan) => p.id !== deleteModal)
        setSelectedPlan(remainingPlans.length > 0 ? remainingPlans[0] : null)
      }
      setDeleteModal(null)
    } catch (error: any) {
      alert(error.response?.data?.error || t('video_planning.delete_plan_failed'))
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
      alert(error.response?.data?.error || t('video_planning.update_item_failed'))
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
      return planItems.filter((item: VideoPlanItem) => activeStatuses.includes(item.status))
    }
    if (statusFilter === 'completed') {
      return planItems.filter(
        (item: VideoPlanItem) => item.status === 'completed' || item.status === 'posted',
      )
    }
    if (statusFilter === 'failed') {
      return planItems.filter((item: VideoPlanItem) => item.status === 'failed')
    }
    return planItems.filter((item: VideoPlanItem) => item.status === statusFilter)
  }, [planItems, statusFilter])

  // Filter scheduled posts by status
  const filteredPosts =
    statusFilter === 'all'
      ? scheduledPosts
      : statusFilter === 'scheduled' || statusFilter === 'pending'
        ? scheduledPosts.filter((p: ScheduledPost) => p.status === 'pending' || p.status === 'scheduled')
        : statusFilter === 'posted'
          ? scheduledPosts.filter((p: ScheduledPost) => p.status === 'posted')
          : statusFilter === 'failed'
            ? scheduledPosts.filter((p: ScheduledPost) => p.status === 'failed')
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
      (acc: Record<string, VideoPlanItem[]>, item: VideoPlanItem) => {
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

  const connectedAccounts = useMemo(
    () => socialAccounts.filter((acc) => acc.status === 'connected'),
    [socialAccounts],
  )

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
    return date.toLocaleDateString(language === 'ru' ? 'ru-RU' : language === 'uk' ? 'uk-UA' : language === 'es' ? 'es-ES' : language === 'de' ? 'de-DE' : 'en-US', { month: 'long', year: 'numeric' })
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth((prev: Date) => {
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



  const getStatusCounts = () => {
    const scheduledCount = scheduledPosts.filter((p: ScheduledPost) => p.status === 'pending' || p.status === 'scheduled').length
    const postedCount = scheduledPosts.filter((p: ScheduledPost) => p.status === 'posted').length

    return {
      all: planItems.length + scheduledPosts.length,
      pending: planItems.filter((i: VideoPlanItem) => i.status === 'pending').length + scheduledCount,
      ready: planItems.filter((i: VideoPlanItem) => i.status === 'ready').length,
      completed: planItems.filter((i: VideoPlanItem) => i.status === 'completed').length,
      scheduled: planItems.filter((i: VideoPlanItem) => i.status === 'scheduled').length + scheduledCount,
      posted: planItems.filter((i: VideoPlanItem) => i.status === 'posted').length + postedCount,
      failed: planItems.filter((i: VideoPlanItem) => i.status === 'failed').length + scheduledPosts.filter((p: ScheduledPost) => p.status === 'failed').length,
    }
  }

  const statusCounts = getStatusCounts()

  const getStatusBadge = (status: string, scriptStatus?: string | null, item?: VideoPlanItem) => {
    // Clear, user-friendly status labels that explain what's happening in the workflow
    const effectiveStatus = item?.videos?.status || status

    // Handle rejected scripts first (highest priority)
    if (scriptStatus === 'rejected') {
      return <Badge variant="error">{t('video_planning.script_rejected')}</Badge>;
    }

    // Check if there are pending scheduled posts for this item (indicates publishing in progress)
    const itemScheduledPosts = item?.video_id
      ? scheduledPosts.filter((p: ScheduledPost) => p.video_id === item.video_id)
      : []
    const hasPendingPosts = itemScheduledPosts.some((p: ScheduledPost) => p.status === 'pending' || p.status === 'scheduled')
    const allPostsPublished = itemScheduledPosts.length > 0 && itemScheduledPosts.every((p: ScheduledPost) => p.status === 'posted')
    const scheduledDateTime = item?.scheduled_date && item?.scheduled_time
      ? new Date(`${item.scheduled_date}T${item.scheduled_time}`)
      : null
    const isBeforePostTime = scheduledDateTime ? scheduledDateTime > new Date() : false

    // Determine the most descriptive label based on status and script_status
    let label = ''
    let variant: 'default' | 'success' | 'error' | 'warning' | 'info' = 'default'
    let showLoader = false

    if (hasPendingPosts) {
      return (
        <Badge variant="info">
          <Loader className="h-3 w-3 animate-spin" />
          {t('video_planning.publishing')}
        </Badge>
      )
    }

    if (allPostsPublished) {
      return <Badge variant="success">{t('video_planning.posted')}</Badge>
    }

    switch (effectiveStatus) {
      case 'pending':
        label = t('video_planning.waiting_to_start');
        variant = 'warning';
        break;
      case 'researching':
        label = t('video_planning.gathering_research');
        variant = 'info';
        showLoader = true;
        break;
      case 'ready':
        label = t('video_planning.ready_for_script');
        variant = 'info';
        break;
      case 'draft':
        label = t('video_planning.writing_script');
        variant = 'info';
        showLoader = true;
        break;
      case 'approved':
        label = t('video_planning.approved');
        variant = 'success';
        break;
      case 'generating':
        label = t('video_planning.generating_video');
        variant = 'info';
        showLoader = true;
        break;
      case 'completed':
        label = isBeforePostTime ? t('video_planning.waiting_for_post_time') : t('video_planning.video_ready');
        variant = isBeforePostTime ? 'info' : 'success';
        break;
      case 'failed':
        label = t('video_planning.error_occurred');
        variant = 'error';
        break;
      case 'scheduled':
        label = t('video_planning.waiting_for_post_time');
        variant = 'info';
        break;
      case 'posted':
        label = t('video_planning.posted');
        variant = 'success';
        break;
      default:
        label = effectiveStatus;
        variant = 'default';
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
    const ampm = hour >= 12 ? t('video_planning.pm') : t('video_planning.am')
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
              {t('video_planning.title')}
            </p>
            <h1 className="text-3xl font-semibold text-primary">
              {t('video_planning.page_title')}
            </h1>
            <p className="text-sm text-slate-500">
              {t('video_planning.subtitle')}
            </p>
          </div>
          <Button
            onClick={() => setCreateModal(true)}
            leftIcon={<Plus className="h-4 w-4" />}
            className="w-full md:w-auto"
            disabled={showUpgrade}
          >
            {showUpgrade ? t('common.upgrade_required') || 'Subscription Required' : t('video_planning.new_plan')}
          </Button>
        </div>

        {/* Content Variety Metrics */}
        {varietyMetrics && (
          <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                </div>
                <h3 className="text-lg font-semibold text-purple-900">
                  {t('video_planning.content_variety') || 'Content Variety'}
                </h3>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {Math.round(varietyMetrics.overallScore)}%
                  </div>
                  <div className="text-xs text-purple-600">
                    {t('video_planning.overall_score') || 'Overall Score'}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {Math.round(varietyMetrics.topicDiversity)}%
                  </div>
                  <div className="text-xs text-blue-600">
                    {t('video_planning.topic_diversity') || 'Topic Diversity'}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {Math.round(varietyMetrics.scriptDiversity)}%
                  </div>
                  <div className="text-xs text-green-600">
                    {t('video_planning.script_diversity') || 'Script Diversity'}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {Math.round(varietyMetrics.hookVariety)}%
                  </div>
                  <div className="text-xs text-orange-600">
                    {t('video_planning.hook_variety') || 'Hook Variety'}
                  </div>
                </div>
              </div>

              {varietyMetrics.recommendations && varietyMetrics.recommendations.length > 0 && (
                <div className="bg-white/50 rounded-lg p-3">
                  <div className="text-sm font-medium text-purple-900 mb-2">
                    {t('video_planning.variety_recommendations') || 'Recommendations for More Variety:'}
                  </div>
                  <ul className="text-xs text-purple-700 space-y-1">
                    {varietyMetrics.recommendations.slice(0, 3).map((rec: string, index: number) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-purple-500 mt-0.5">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Plan Selector */}
        {plans.length > 0 && (
          <Card className="p-4">
            <div className="flex flex-wrap gap-2">
              {plans.map((plan: VideoPlan) => (
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
                    title={t('video_planning.edit_plan')}
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleteModal(plan.id)}
                    className="rounded-xl p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                    title={t('video_planning.delete_plan')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        )}

        <CreditBanner />

        {/* Plan Items Calendar View */}
        {selectedPlan ? (
          <div className="space-y-6">
            {/* Status Summary and Filters */}
            <Card className="p-4">
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-6">
                  <div className="text-sm">
                    <span className="text-slate-600">{t('video_planning.total')}: </span>
                    <span className="font-semibold">{statusCounts.all}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-slate-600">{t('video_planning.ready')}: </span>
                    <span className="font-semibold text-emerald-600">
                      {statusCounts.ready}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-slate-600">{t('video_planning.completed')}: </span>
                    <span className="font-semibold text-blue-600">
                      {statusCounts.completed}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-slate-600">{t('video_planning.pending')}: </span>
                    <span className="font-semibold text-yellow-600">
                      {statusCounts.pending}
                    </span>
                  </div>
                  {statusCounts.scheduled > 0 && (
                    <div className="text-sm">
                      <span className="text-slate-600">{t('video_planning.scheduled')}: </span>
                      <span className="font-semibold text-purple-600">
                        {statusCounts.scheduled}
                      </span>
                    </div>
                  )}
                  {statusCounts.posted > 0 && (
                    <div className="text-sm">
                      <span className="text-slate-600">{t('video_planning.posted')}: </span>
                      <span className="font-semibold text-emerald-600">
                        {statusCounts.posted}
                      </span>
                    </div>
                  )}
                  {statusCounts.failed > 0 && (
                    <div className="text-sm">
                      <span className="text-slate-600">{t('video_planning.failed')}: </span>
                      <span className="font-semibold text-red-600">
                        {statusCounts.failed}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { value: 'all', label: t('video_planning.all') },
                    { value: 'pending', label: t('video_planning.pending') },
                    { value: 'ready', label: t('video_planning.ready') },
                    { value: 'approved', label: t('video_planning.approved') },
                    { value: 'scheduled', label: t('video_planning.scheduled') },
                    { value: 'posted', label: t('video_planning.posted') },
                    { value: 'failed', label: t('video_planning.failed') },
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
                    {t('video_planning.clear_filter')}
                  </button>
                </div>
              </div>
            </Card>


            {/* Calendar Grid */}
            <Card className="p-6">
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xl font-semibold text-primary text-center sm:text-left">
                  {formatMonthYear(currentMonth)}
                </h2>
                <div className="flex justify-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigateMonth('prev')}
                    className="flex-1 sm:flex-none"
                  >
                    ← {t('video_planning.prev')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentMonth(new Date())}
                    className="flex-1 sm:flex-none"
                  >
                    {t('video_planning.today')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigateMonth('next')}
                    className="flex-1 sm:flex-none"
                  >
                    {t('video_planning.next')} →
                  </Button>
                </div>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-2">
                {/* Day Headers */}
                {[
                  { key: 'sun', label: 'Sun' },
                  { key: 'mon', label: 'Mon' },
                  { key: 'tue', label: 'Tue' },
                  { key: 'wed', label: 'Wed' },
                  { key: 'thu', label: 'Thu' },
                  { key: 'fri', label: 'Fri' },
                  { key: 'sat', label: 'Sat' },
                ].map((day) => (
                  <div
                    key={day.key}
                    className="p-2 text-center text-xs font-semibold text-slate-500"
                  >
                    {t(`video_planning.${day.key}`)}
                  </div>
                ))}

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
                                  status = item.videos?.status || item.status
                                  // Show "Planned" or time if no topic, otherwise show topic
                                  if (item.topic) {
                                    displayTopic = item.topic
                                  } else if (item.scheduled_time) {
                                    displayTopic = t('video_planning.planned_with_time').replace('{time}', formatTime(item.scheduled_time))
                                  } else {
                                    displayTopic = t('video_planning.planned')
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
                                  {t('video_planning.more_items').replace('{count}', (items.length - 4).toString())}
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
                <h3 className="text-sm font-semibold text-slate-700 mb-3">
                  {t('video_planning.status_legend')}
                </h3>
                <div className="flex flex-wrap gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded border border-yellow-200 bg-yellow-50"></div>
                    <span className="text-slate-600">{t('video_planning.pending')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded border border-cyan-200 bg-cyan-50"></div>
                    <span className="text-slate-600">{t('video_planning.gathering_research')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded border border-blue-200 bg-blue-50"></div>
                    <span className="text-slate-600">{t('video_planning.ready')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded border border-teal-200 bg-teal-50"></div>
                    <span className="text-slate-600">{t('video_planning.approved')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded border border-indigo-200 bg-indigo-50"></div>
                    <span className="text-slate-600">{t('video_planning.generating_video')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded border border-emerald-200 bg-emerald-50"></div>
                    <span className="text-slate-600">{t('video_planning.published')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded border border-purple-200 bg-purple-50"></div>
                    <span className="text-slate-600">{t('video_planning.scheduled')}</span>
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
                    {new Date(selectedDate).toLocaleDateString(language === 'ru' ? 'ru-RU' : language === 'uk' ? 'uk-UA' : language === 'es' ? 'es-ES' : language === 'de' ? 'de-DE' : 'en-US', {
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
                                      {scheduledTime ? new Date(scheduledTime).toLocaleTimeString(language === 'ru' ? 'ru-RU' : language === 'uk' ? 'uk-UA' : language === 'es' ? 'es-ES' : language === 'de' ? 'de-DE' : 'en-US', {
                                        hour: 'numeric',
                                        minute: '2-digit',
                                        hour12: true
                                      }) : t('video_planning.no_time_set')}
                                    </span>
                                    <Badge variant={item.status === 'posted' ? 'success' : item.status === 'pending' ? 'warning' : item.status === 'failed' ? 'error' : 'default'}>
                                      {item.status === 'posted' ? t('video_planning.posted') : item.status === 'pending' ? t('video_planning.scheduled') : item.status === 'failed' ? t('video_planning.failed') : item.status}
                                    </Badge>
                                    <Badge variant="info">{item.platform}</Badge>
                                  </div>
                                  <div>
                                    <h3 className="font-semibold text-primary">
                                      {item.videos?.topic || t('video_planning.scheduled_post')}
                                    </h3>
                                    {item.videos && (
                                      <p className="mt-1 text-sm text-slate-600">
                                        {t('video_planning.video_id')}: {item.video_id}
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
                                      {t('video_planning.view_video')}
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
                                        {t('video_planning.edit_video_details')}
                                      </h4>
                                    </div>
                                    <Input
                                      label={t('video_planning.topic_label')}
                                      value={editForm.topic}
                                      onChange={(e) =>
                                        setEditForm({
                                          ...editForm,
                                          topic: e.target.value,
                                        })
                                      }
                                      placeholder={t('video_planning.topic_input_placeholder')}
                                      required
                                    />
                                    <div className="space-y-3">
                                      <div>
                                        <label className="mb-2 block text-xs font-medium text-slate-700">
                                          {t('video_planning.posting_time')}
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
                                          {t('video_planning.platforms')}
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                          {socialAccounts
                                            .filter((acc) => acc.status === 'connected')
                                            .map((acc) => (
                                              <button
                                                key={acc.platform}
                                                type="button"
                                                onClick={() => {
                                                  const newPlatforms =
                                                    editForm.platforms.includes(
                                                      acc.platform,
                                                    )
                                                      ? editForm.platforms.filter(
                                                        (p) => p !== acc.platform,
                                                      )
                                                      : [
                                                        ...editForm.platforms,
                                                        acc.platform,
                                                      ]
                                                  setEditForm((prev) => ({
                                                    ...prev,
                                                    platforms: newPlatforms,
                                                  }))
                                                }}
                                                className={`rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition ${editForm.platforms.includes(acc.platform)
                                                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                                                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                                  }`}
                                              >
                                                {acc.platform}
                                              </button>
                                            ))}
                                        </div>
                                      </div>
                                    </div>
                                    <Textarea
                                      label={t('video_planning.description')}
                                      value={editForm.description}
                                      onChange={(e) =>
                                        setEditForm({
                                          ...editForm,
                                          description: e.target.value,
                                        })
                                      }
                                      placeholder={t('video_planning.description_placeholder')}
                                      rows={2}
                                    />
                                    <Textarea
                                      label={t('video_planning.caption')}
                                      value={editForm.caption}
                                      onChange={(e) =>
                                        setEditForm({
                                          ...editForm,
                                          caption: e.target.value,
                                        })
                                      }
                                      placeholder={t('video_planning.caption_placeholder')}
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
                                            {t('video_planning.social_media_caption')}: {item.caption}
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
                                        {t('video_planning.no_topic_yet')}
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
                                  {item.topic ? t('video_planning.edit_item') : t('video_planning.set_topic')}
                                </Button>
                                {item.status === 'pending' && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleGenerateTopic(item.id)}
                                    leftIcon={<Sparkles className="h-4 w-4" />}
                                    disabled={showUpgrade}
                                  >
                                    {showUpgrade ? (t('common.upgrade_needed') || 'Upgrade') : (item.topic ? t('video_planning.regenerate') : t('video_planning.auto_generate'))}
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
                                      {t('video_planning.review_script')}
                                    </Button>
                                  )}
                                {item.status === 'ready' && !item.script && (
                                  <Button
                                    size="sm"
                                    disabled={showUpgrade}
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
                                          t('video_planning.generate_script_failed'),
                                        )
                                      }
                                    }}
                                    leftIcon={<Sparkles className="h-4 w-4" />}
                                  >
                                    {t('video_planning.generate_script')}
                                  </Button>
                                )}
                                {item.status === 'approved' && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleCreateVideo(item)}
                                    leftIcon={<Video className="h-4 w-4" />}
                                  >
                                    {t('video_planning.create_video')}
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
                                    {t('video_planning.view_video')}
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
            title={t('video_planning.no_plans_yet')}
            description={t('video_planning.no_plans_desc')}
            action={
              <Button
                onClick={() => setCreateModal(true)}
                leftIcon={<Plus className="h-4 w-4" />}
              >
                {t('video_planning.create_plan')}
              </Button>
            }
          />
        )}

        {/* Item Detail Modal */}
        <Modal
          isOpen={isDetailDrawerOpen && !!selectedItem}
          onClose={closeDetailDrawer}
          title={selectedItem?.topic || t('video_planning.video_detail')}
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
                      <p className="text-sm text-slate-500">{t('video_planning.video_id_prefix').replace('{id}', selectedItem.video_id)}</p>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/videos?videoId=${selectedItem.video_id}`)}
                      >
                        {t('video_planning.view_full_video')}
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center p-4">
                      <Clapperboard className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">{t('video_planning.video_preview_placeholder')}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-700">{t('video_planning.script_label')}</p>
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
                      <p className="text-slate-500 italic">{t('video_planning.no_script_yet')}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleGenerateTopic(selectedItem.id)}
                      leftIcon={<Sparkles className="h-4 w-4" />}
                    >
                      {t('video_planning.regenerate')}
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
                      {t('video_planning.regenerate_script')}
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
                    label={t('video_planning.topic')}
                    value={editForm.topic}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, topic: e.target.value }))
                    }
                    className="w-full"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label={t('video_planning.posting_time')}
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
                        {t('video_planning.platforms')}
                      </label>
                      <div className="flex flex-wrap gap-1">
                        {socialAccounts
                          .filter((acc) => acc.status === 'connected')
                          .map((acc) => (
                            <button
                              key={acc.platform}
                              type="button"
                              onClick={() => {
                                const newPlatforms = editForm.platforms.includes(
                                  acc.platform,
                                )
                                  ? editForm.platforms.filter((p: string) => p !== acc.platform)
                                  : [...editForm.platforms, acc.platform]
                                setEditForm((prev: any) => ({
                                  ...prev,
                                  platforms: newPlatforms,
                                }))
                              }}
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize transition ${editForm.platforms.includes(acc.platform)
                                ? 'border-brand-500 bg-brand-50 text-brand-700'
                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                              {acc.platform}
                            </button>
                          ))}
                      </div>
                    </div>
                  </div>
                  <Textarea
                    label={t('video_planning.description')}
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
                    label={t('video_planning.caption')}
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
                        {t('video_planning.create_video')}
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={closeDetailDrawer}
                    >
                      {t('video_planning.cancel')}
                    </Button>
                    <Button
                      size="sm"
                      onClick={async () => {
                        await handleSaveItem()
                        closeDetailDrawer()
                      }}
                      leftIcon={<Save className="h-4 w-4" />}
                    >
                      {t('video_planning.save_changes')}
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
            setPlanName('')
            setStartDate(new Date().toISOString().split('T')[0])
            setEndDate('')
            setTriggerTime('08:00')
            setDefaultPlatforms([])
            setVideosPerDay(3)
            setVideoTimes(['09:00', '12:00', '15:00'])
            setVideoTopics(['', '', ''])
          }}
          title={t('video_planning.create_plan')}
        >
          <div className="space-y-6">
            <div className="text-xs text-slate-500">{t('video_planning.timezone_label')}: {timezone}</div>
          </div>

          <div className="space-y-4">
            <div>
              <Input
                label="Plan Name"
                placeholder="e.g., Daily Trading Content"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label={t('video_planning.start_date')}
                type="date"
                value={startDate}
                onChange={(e: any) => setStartDate(e.target.value)}
                required
              />

              <Input
                label={t('video_planning.end_date')}
                type="date"
                value={endDate}
                onChange={(e: any) => setEndDate(e.target.value)}
                min={startDate}
              />
            </div>

            <div>
              <Select
                label={t('video_planning.videos_per_day')}
                value={String(videosPerDay)}
                onChange={(e) => setVideoSlotCount(Number(e.target.value))}
                options={Array.from({ length: 10 }, (_, index) => {
                  const value = index + 1
                  return { value: String(value), label: `${value}` }
                })}
              />
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                {t('video_planning.videos_topics')}
              </label>
              <div className="space-y-3">
                {videoTimes.map((time: string, index: number) => (
                  <div
                    key={index}
                    className="relative space-y-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
                  >
                    {videoTimes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeVideoSlot(index)}
                        className="absolute right-2 top-2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-red-500"
                      >
                        <X size={14} />
                      </button>
                    )}
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 text-xs font-bold text-slate-400">
                        #{index + 1}
                      </div>
                      <Input
                        type="time"
                        value={time}
                        onChange={(e: any) => updateVideoSlotTime(index, e.target.value)}
                        className="w-32"
                      />
                    </div>
                    <Textarea
                      placeholder={`Topic for video #${index + 1}`}
                      value={videoTopics[index]}
                      onChange={(e: any) => updateVideoSlotTopic(index, e.target.value)}
                      rows={2}
                      required
                    />
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={addVideoSlot}
                className="w-full border-dashed"
                leftIcon={<Plus size={16} />}
              >
                {t('video_planning.add_another_video')}
              </Button>
            </div>

            <Select
              label={t('video_planning.timezone')}
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              options={timezones}
            />

            <div className="space-y-3 border-2 border-brand-300 bg-brand-50 rounded-lg p-4">
              <label className="block text-sm font-medium text-slate-700">
                Trigger Time
              </label>

              <div className="bg-white border border-brand-200 rounded-lg p-3">
                <p className="text-xs text-slate-600">
                  <strong>What happens at this time:</strong> The system will automatically write scripts and generate videos for your scheduled content.
                </p>
              </div>

              <Input
                label={t('video_planning.custom_time')}
                type="time"
                value={triggerTime}
                onChange={(e) => setTriggerTime(e.target.value)}
                min="00:00"
                max="23:59"
              />
            </div>

            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <label className="block text-sm font-medium text-slate-700">
                {t('video_planning.social_media_platforms')}
              </label>
              {connectedAccounts.length === 0 ? (
                <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <p className="font-medium">{t('video_planning.no_social_accounts_title')}</p>
                  <p className="text-xs text-amber-800">{t('video_planning.no_social_accounts_body')}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setCreateModal(false)
                        navigate('/social')
                      }}
                    >
                      {t('video_planning.connect_social_media')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleCreatePlan}
                      loading={creating}
                    >
                      {t('video_planning.create_plan_anyway')}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {connectedAccounts.map((acc) => (
                    <button
                      key={acc.platform}
                      type="button"
                      onClick={() => {
                        if (defaultPlatforms.includes(acc.platform)) {
                          setDefaultPlatforms(
                            defaultPlatforms.filter((p) => p !== acc.platform),
                          )
                        } else {
                          setDefaultPlatforms([...defaultPlatforms, acc.platform])
                        }
                      }}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition ${defaultPlatforms.includes(acc.platform)
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                    >
                      {acc.platform}
                      {defaultPlatforms.includes(acc.platform) && (
                        <span className="ml-1">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end pt-2">
              <Button
                onClick={handleCreatePlan}
                loading={creating}
                disabled={connectedAccounts.length === 0}
              >
                {t('video_planning.create_plan')}
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
            setStartDate(new Date().toISOString().split('T')[0])
            setEndDate('')
            setTriggerTime('08:00')
            setDefaultPlatforms([])
            setVideosPerDay(3)
            setVideoTimes(['09:00', '12:00', '15:00'])
            setVideoTopics(['', '', ''])
          }}
          title={t('video_planning.edit_plan')}
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
                label={t('video_planning.start_date')}
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />

              <Input
                label={t('video_planning.end_date')}
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
              />
            </div>

            <Select
              label={t('video_planning.videos_per_day')}
              value={String(videosPerDay)}
              onChange={(e) => setVideoSlotCount(Number(e.target.value))}
              options={Array.from({ length: 10 }, (_, index) => {
                const value = index + 1
                return { value: String(value), label: `${value}` }
              })}
            />

            <div className="space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                {t('video_planning.videos_topics')}
              </label>
              <div className="space-y-3">
                {videoTimes.map((time: string, index: number) => (
                  <div key={index} className="relative space-y-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                    {videoTimes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeVideoSlot(index)}
                        className="absolute right-2 top-2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-red-500"
                      >
                        <X size={14} />
                      </button>
                    )}
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 text-xs font-bold text-slate-400">
                        #{index + 1}
                      </div>
                      <Input
                        type="time"
                        value={time}
                        onChange={(e: any) => updateVideoSlotTime(index, e.target.value)}
                        className="w-32"
                      />
                    </div>
                    <Textarea
                      placeholder={`Topic for video #${index + 1}`}
                      value={videoTopics[index]}
                      onChange={(e: any) => updateVideoSlotTopic(index, e.target.value)}
                      rows={2}
                      required
                    />
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={addVideoSlot}
                className="w-full border-dashed"
                leftIcon={<Plus size={16} />}
              >
                {t('video_planning.add_another_video')}
              </Button>
            </div>

            <Select
              label={t('video_planning.timezone')}
              value={timezone}
              onChange={(e: any) => setTimezone(e.target.value)}
              options={timezones}
            />


            <div className="space-y-3 border-2 border-green-300 bg-green-50 rounded-lg p-4">
              <label className="block text-sm font-medium text-slate-700">
                Trigger Time
              </label>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-700">
                  <strong>What happens at this time:</strong> The system will automatically write scripts and generate videos for your scheduled content.
                </p>
              </div>

              <Input
                label={t('video_planning.custom_time')}
                type="time"
                value={triggerTime}
                onChange={(e) => setTriggerTime(e.target.value)}
                min="00:00"
                max="23:59"
              />
            </div>


            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                {t('video_planning.social_media_platforms')}
              </label>
              <div className="flex flex-wrap gap-2">
                {socialAccounts
                  .filter((acc) => acc.status === 'connected')
                  .map((acc) => (
                    <button
                      key={acc.platform}
                      type="button"
                      onClick={() => {
                        const newPlatforms = defaultPlatforms.includes(acc.platform)
                          ? defaultPlatforms.filter((p) => p !== acc.platform)
                          : [...defaultPlatforms, acc.platform]
                        setDefaultPlatforms(newPlatforms)
                      }}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${defaultPlatforms.includes(acc.platform)
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                    >
                      {acc.platform.charAt(0).toUpperCase() + acc.platform.slice(1)}
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
                  setStartDate(new Date().toISOString().split('T')[0])
                  setEndDate('')
                  setTriggerTime('08:00')
                  setDefaultPlatforms([])
                  setVideosPerDay(3)
                  setVideoTimes(['09:00', '12:00', '15:00'])
                  setVideoTopics(['', '', ''])
                }}
              >
                {t('video_planning.cancel')}
              </Button>
              <Button
                onClick={handleSavePlan}
                loading={editingPlan}
                leftIcon={<Save className="h-4 w-4" />}
              >
                {t('video_planning.save_changes')}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Delete Plan Modal */}
        <Modal
          isOpen={!!deleteModal}
          onClose={() => setDeleteModal(null)}
          title={t('video_planning.delete_plan')}
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              {t('video_planning.delete_plan_confirm')}
            </p>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="ghost"
                onClick={() => setDeleteModal(null)}
                className="border border-white/60 bg-white/70 text-slate-500 hover:border-slate-200 hover:bg-white"
              >
                {t('video_planning.cancel')}
              </Button>
              <Button
                variant="danger"
                onClick={handleDeletePlan}
                loading={deleting}
              >
                {t('video_planning.delete_plan')}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Script Preview Modal */}
        <Modal
          isOpen={!!scriptPreviewItem}
          onClose={() => setScriptPreviewItem(null)}
          title={t('video_planning.review_script')}
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

                {/* Avatar display removed - using AI video generation */}

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

        {/* Avatar and Look Selection Modals removed - using AI video generation */}
      </div >
    </Layout >
  )
}
