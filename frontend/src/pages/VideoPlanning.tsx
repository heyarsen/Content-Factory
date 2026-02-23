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
import { Skeleton } from '../components/ui/Skeleton'
import {
  Plus,
  Sparkles,
  MoreVertical,
  Search,
  Grid2X2,
  List,
  Play,
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
  Upload,
} from 'lucide-react'
import api from '../lib/api'
import { normalizeTimezone, timezones } from '../lib/timezones'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { useCreditsContext } from '../contexts/CreditContext'
import { CreditBanner } from '../components/ui/CreditBanner'
import { UploadAndPlanModal } from '../components/videos/UploadAndPlanModal'
import { GenerateVideoModal } from '../components/videos/GenerateVideoModal'
import { useNotifications } from '../contexts/NotificationContext'

const STATUS_FILTER_KEY = 'video_planning_status_filter'
const LEGACY_STATUS_FILTER_KEY = 'videoPlanning.statusFilter'
const CALENDAR_VIEW_KEY = 'video_planning_calendar_view'
type CalendarView = 'week' | 'month'

const getLocalDateYMD = (date = new Date()) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

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
  caption?: string | null
  videos?: {
    topic: string
    video_url: string | null
  } | null
}

type ScheduledPostGroup = {
  _isScheduledPostGroup: true
  id: string
  video_id: string
  scheduled_date: string
  scheduled_time: string | null
  posted_at: string | null
  status: 'pending' | 'posted' | 'failed' | 'scheduled'
  caption: string | null
  videos?: {
    topic: string
    video_url: string | null
  } | null
  platforms: Array<{
    platform: ScheduledPost['platform']
    status: ScheduledPost['status']
    error_message: string | null
  }>
}

type ContentStudioTab = 'calendar' | 'library' | 'automations'
type StudioVideoType = 'AI' | 'Uploaded' | 'Auto'
type StudioVideoStatus = 'Ready' | 'Posted' | 'Failed'

const UUID_LIKE_PATTERN = /^[a-f0-9]{32,}$/i

const getReadableVideoTitle = (title: string | null | undefined, type: StudioVideoType = 'AI') => {
  const safeTitle = (title || '').trim()
  if (!safeTitle || UUID_LIKE_PATTERN.test(safeTitle)) {
    if (type === 'Uploaded') return 'Untitled uploaded video'
    if (type === 'Auto') return 'Untitled automation video'
    return 'Untitled AI video'
  }
  return safeTitle
}

type StudioVideo = {
  id: string
  title: string
  type: StudioVideoType
  status: StudioVideoStatus
  date: string
  time: string
  caption: string
  platforms: Array<'yt' | 'ig'>
  videoUrl: string | null
  _isVisibleInLibrary?: boolean
}

export function VideoPlanning() {
  const isDev = import.meta.env.DEV
  const { t, language } = useLanguage()
  const { addNotification } = useNotifications()
  const { user } = useAuth()
  const { credits, unlimited, loading: creditsLoading } = useCreditsContext()
  const hasSubscription = !!(user?.hasActiveSubscription || user?.role === 'admin')
  const safeCanCreate = hasSubscription || (credits !== null && credits > 0) || unlimited
  const showUpgrade = !creditsLoading && !safeCanCreate

  const normalizeStatusValue = (status?: string | null) => {
    if (!status) return status
    return status.toLowerCase()
  }
  const navigate = useNavigate()
  const [plans, setPlans] = useState<VideoPlan[]>([])
  const [selectedPlan, setSelectedPlan] = useState<VideoPlan | null>(null)
  const [planItems, setPlanItems] = useState<VideoPlanItem[]>([])
  const [calendarPlanItems, setCalendarPlanItems] = useState<VideoPlanItem[]>([])
  const [loading, setLoading] = useState(true)
  const [varietyMetrics, setVarietyMetrics] = useState<any>(null)
  const [createModal, setCreateModal] = useState(false)
  const [generateVideoModalOpen, setGenerateVideoModalOpen] = useState(false)
  const [uploadPlanModal, setUploadPlanModal] = useState(false)
  const [headerActionsOpen, setHeaderActionsOpen] = useState(false)
  const headerActionsRef = useRef<HTMLDivElement | null>(null)
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
  const [calendarView, setCalendarView] = useState<CalendarView>(() => {
    if (typeof window === 'undefined') return 'week'
    const stored = window.localStorage.getItem(CALENDAR_VIEW_KEY)
    return stored === 'month' ? 'month' : 'week'
  })
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    if (typeof window === 'undefined') return 'all'
    const storedStatusFilter = localStorage.getItem(STATUS_FILTER_KEY)
    if (storedStatusFilter) return storedStatusFilter

    const legacyStatusFilter = localStorage.getItem(LEGACY_STATUS_FILTER_KEY)
    if (legacyStatusFilter) {
      localStorage.setItem(STATUS_FILTER_KEY, legacyStatusFilter)
      localStorage.removeItem(LEGACY_STATUS_FILTER_KEY)
      return legacyStatusFilter
    }

    return 'all'
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
  const [startDate, setStartDate] = useState(getLocalDateYMD)
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
  const [contentStudioTab, setContentStudioTab] = useState<ContentStudioTab>('library')
  const [librarySearch, setLibrarySearch] = useState('')
  const [libraryTypeFilter, setLibraryTypeFilter] = useState<'all' | StudioVideoType>('all')
  const [libraryStatusFilter, setLibraryStatusFilter] = useState<'all' | StudioVideoStatus>('all')
  const [studioVideos, setStudioVideos] = useState<StudioVideo[]>([])
  const [selectedStudioVideo, setSelectedStudioVideo] = useState<StudioVideo | null>(null)
  const [editPlanModal, setEditPlanModal] = useState<VideoPlan | null>(null)
  const [editingPlan, setEditingPlan] = useState(false)
  const [selectedItem, setSelectedItem] = useState<VideoPlanItem | null>(null)

  useEffect(() => {
    if (!headerActionsOpen) return

    const handleOutsideClick = (event: MouseEvent) => {
      if (headerActionsRef.current && !headerActionsRef.current.contains(event.target as Node)) {
        setHeaderActionsOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setHeaderActionsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [headerActionsOpen])
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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(CALENDAR_VIEW_KEY, calendarView)
    }
  }, [calendarView])

  // Avatar-related functions removed - using AI video generation


  const [creating, setCreating] = useState(false)

  const handleUploadPlanSuccess = async () => {
    addNotification({
      type: 'success',
      title: t('video_planning.upload_plan.success_title'),
      message: t('video_planning.upload_plan.success_message'),
    })

    await Promise.all([loadScheduledPosts(), loadStudioVideos(), selectedPlan ? loadPlanItems(selectedPlan.id) : Promise.resolve()])
  }
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

  const loadStudioVideos = async () => {
    try {
      const response = await api.get('/api/videos')
      const videos = response.data.videos || []
      setStudioVideos(videos)
    } catch (error) {
      console.error('Failed to load studio videos:', error)
    }
  }

  useEffect(() => {
    loadPlans()
    loadUserPreferences()
    loadSocialAccounts()
    loadStudioVideos()
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
    loadStudioVideos()
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
      loadStudioVideos()
    }, 30000) // Poll every 30 seconds (reduced from 10 seconds)

    return () => clearInterval(interval)
  }, [])

  // Smart polling for plan items - only poll frequently when items are in progress
  const pollingIntervalRef = useRef<any | null>(null)
  const currentPollMsRef = useRef<number | null>(null)
  const lastPollTimeRef = useRef<number>(0)

  useEffect(() => {
    if (!selectedPlan) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
      currentPollMsRef.current = null
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
    currentPollMsRef.current = null

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
        const currentInterval = currentPollMsRef.current
        if (!currentInterval || newInterval !== currentInterval) {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
          }
          pollingIntervalRef.current = setInterval(poll, newInterval)
          currentPollMsRef.current = newInterval
        }
      }, 1000)
    }

    // Start polling with initial interval
    const initialInterval = getPollInterval()
    pollingIntervalRef.current = setInterval(poll, initialInterval)
    currentPollMsRef.current = initialInterval

    // Initial load
    poll()

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
      currentPollMsRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlan?.id])

  // Update polling interval when planItems change (but don't recreate the effect)
  useEffect(() => {
    if (!selectedPlan) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
      currentPollMsRef.current = null
      return
    }

    if (!pollingIntervalRef.current) return

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
      if (pollingIntervalRef.current && currentPollMsRef.current !== newInterval) {
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
        currentPollMsRef.current = newInterval
      }
    }, 2000)

    return () => {
      clearTimeout(timeoutId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planItems, selectedPlan?.id])

  const loadPlans = async () => {
    try {
      const response = await api.get('/api/plans')
      const loadedPlans = response.data.plans || []
      setPlans(loadedPlans)
      await loadAllPlanItems(loadedPlans)

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
      if (isDev) {
        console.log(`[VideoPlanning] Loading plan items for plan ${planId}...`)
      }
      const response = await api.get(`/api/plans/${planId}`)
      const items = response.data.items || []
      if (isDev) {
        console.log(`[VideoPlanning] Plan items API metadata:`, {
          planId,
          itemsCount: items.length,
          hasItems: items.length > 0,
        })
      }
      const normalizedItems = normalizePlanItems(items)
      setPlanItems(normalizedItems)
      setCalendarPlanItems((prevItems) => {
        const remainingItems = prevItems.filter((item) => item.plan_id !== planId)
        return [...remainingItems, ...normalizedItems]
      })
      if (isDev) {
        console.log(`[VideoPlanning] ✓ Loaded ${items.length} plan items for plan ${planId}`)
      }
      if (items.length === 0) {
        console.warn(`[VideoPlanning] ⚠️ No plan items found for plan ${planId}. Plan might not have items created yet.`)
      }
    } catch (error: any) {
      console.error('Failed to load plan items:', error)
      console.error('Plan items request failed:', {
        message: error.message,
        status: error.response?.status,
        planId,
      })
    }
  }

  const normalizePlanItems = (items: VideoPlanItem[]): VideoPlanItem[] => {
    return items.map((item: VideoPlanItem) => {
        const normalizedItemStatus = normalizeStatusValue(item.status) as VideoPlanItem['status']
        const normalizedScriptStatus = normalizeStatusValue(item.script_status) as VideoPlanItem['script_status']
        const normalizedVideoStatus = normalizeStatusValue(item.videos?.status)
        const hasVideoFailure = ['failed', 'error'].includes(normalizedVideoStatus || '')
        const hasItemFailure = Boolean(item.error_message)
        const status = ((hasVideoFailure || hasItemFailure)
          ? 'failed'
          : (item.video_id && normalizedVideoStatus
            ? normalizedVideoStatus
            : normalizedItemStatus)) as VideoPlanItem['status']

        return {
          ...item,
          status,
          script_status: normalizedScriptStatus,
          videos: item.videos
            ? {
              ...item.videos,
              status: normalizedVideoStatus,
            }
            : item.videos,
        }
      })
  }

  const loadAllPlanItems = async (plansToLoad: VideoPlan[]) => {
    if (!plansToLoad.length) {
      setCalendarPlanItems([])
      return
    }

    try {
      const planResponses = await Promise.all(plansToLoad.map((plan) => api.get(`/api/plans/${plan.id}`)))
      const allItems = planResponses.flatMap((response) => response.data.items || [])
      const normalizedItems = normalizePlanItems(allItems)
      setCalendarPlanItems(normalizedItems)
    } catch (error) {
      console.error('Failed to load all plan items for calendar:', error)
    }
  }

  const loadScheduledPosts = async () => {
    try {
      // Don't pass status parameter to get all scheduled posts
      const response = await api.get('/api/posts')
      const posts = response.data.posts || []
      const normalizedPosts = posts.map((post: ScheduledPost) => ({
        ...post,
        status: normalizeStatusValue(post.status) as ScheduledPost['status'],
      }))
      setScheduledPosts(normalizedPosts)
      if (isDev) {
        console.log(`[VideoPlanning] Loaded ${posts.length} scheduled posts`)
      }
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

      if (isDev) {
        console.log(`[VideoPlanning] Plan creation metadata:`, {
          planId: response.data.plan?.id,
          itemsCount: response.data.itemsCount ?? response.data.items?.length ?? 0,
          hasItems: response.data.hasItems ?? (!!response.data.items && response.data.items.length > 0),
          warning: response.data.warning,
        })
      }

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
        if (isDev) {
          console.log(`[VideoPlanning] ✓ Plan created with ${itemsCount} items`)
        }
      } else {
        console.warn(`[VideoPlanning] ⚠️ Plan created but no items in response (itemsCount: ${itemsCount}, hasItems: ${hasItems})`)
        if (response.data.warning) {
          console.warn(`[VideoPlanning] Server warning: ${response.data.warning}`)
        }
        // Wait a bit then try to load items (might be async creation or items were created but not returned)
        setTimeout(async () => {
          if (isDev) {
            console.log(`[VideoPlanning] Attempting to load items for plan ${response.data.plan.id}...`)
          }
          await loadPlanItems(response.data.plan.id)
        }, 1000)
      }
      setCreateModal(false)
      setPlanName('')
      setStartDate(getLocalDateYMD())
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
      setStartDate(getLocalDateYMD())
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



  const getDefaultSelectedPlatforms = (item?: VideoPlanItem) => {
    if (item?.platforms?.length) return item.platforms
    if (selectedPlan?.default_platforms?.length) return selectedPlan.default_platforms

    return socialAccounts
      .filter((acc: SocialAccount) => acc.status === 'connected')
      .map((acc: SocialAccount) => acc.platform)
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
      platforms: getDefaultSelectedPlatforms(item),
    })
  }





  const handleSaveItem = async () => {
    const targetItem = editingItem || selectedItem
    if (!targetItem) return

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
      await loadPlanItems(targetItem.plan_id)
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
    if (statusFilter === 'all') return calendarPlanItems
    if (statusFilter === 'active') {
      const activeStatuses = [
        'pending',
        'researching',
        'ready',
        'draft',
        'approved',
        'scheduled',
      ]
      return calendarPlanItems.filter((item: VideoPlanItem) => activeStatuses.includes(item.status))
    }
    if (statusFilter === 'completed') {
      return calendarPlanItems.filter(
        (item: VideoPlanItem) => item.status === 'completed' || item.status === 'posted',
      )
    }
    if (statusFilter === 'failed') {
      return calendarPlanItems.filter((item: VideoPlanItem) => item.status === 'failed')
    }
    return calendarPlanItems.filter((item: VideoPlanItem) => item.status === statusFilter)
  }, [calendarPlanItems, statusFilter])

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
      if (isDev) {
        console.warn(`[VideoPlanning] Failed to parse date: ${dateStr}`)
      }
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
          if (isDev) {
            console.warn(`[VideoPlanning] Item ${item.id} has invalid scheduled_date`)
          }
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
      if (isDev) {
        console.log(`[VideoPlanning] Grouped ${filteredItems.length} items into ${dateKeys.length} dates`, {
          firstDate: dateKeys[0],
          lastDate: dateKeys[dateKeys.length - 1],
        })
      }
    }

    return grouped
  }, [filteredItems])

  // Debug warning if items exist but none are grouped
  useEffect(() => {
    if (isDev && planItems.length > 0 && Object.keys(planItemsByDate).length === 0) {
      console.warn(`[VideoPlanning] WARNING: ${planItems.length} items but none grouped!`)
    }
  }, [isDev, planItems, planItemsByDate])

  // Group scheduled posts by date (using filtered posts)
  const postsByDate = useMemo(() => {
    return filteredPosts.reduce(
      (acc, post: ScheduledPost) => {
        const anchorDate = post.scheduled_time || post.posted_at
        if (!anchorDate) return acc
        const date = new Date(anchorDate)
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
  type CalendarItem = VideoPlanItem | ScheduledPostGroup
  const itemsByDate = useMemo(() => {
    const combined: Record<string, CalendarItem[]> = {}

    const postedVideoIdsByDate = new Map<string, Set<string>>()
    Object.entries(postsByDate).forEach(([date, posts]) => {
      posts.forEach((post) => {
        if (!post.video_id) return
        if (!postedVideoIdsByDate.has(date)) {
          postedVideoIdsByDate.set(date, new Set())
        }
        postedVideoIdsByDate.get(date)?.add(post.video_id)
      })
    })

    // Add plan items
    Object.keys(planItemsByDate).forEach(date => {
      const scheduledPostVideoIds = postedVideoIdsByDate.get(date)
      combined[date] = (planItemsByDate[date] || []).filter((item) => {
        if (!item.video_id) return true
        return !scheduledPostVideoIds?.has(item.video_id)
      })
    })

    // Add scheduled posts
    Object.keys(postsByDate).forEach(date => {
      if (!combined[date]) {
        combined[date] = []
      }
      const groupedByVideo = postsByDate[date].reduce((acc, post: ScheduledPost) => {
        if (!acc[post.video_id]) {
          acc[post.video_id] = []
        }
        acc[post.video_id].push(post)
        return acc
      }, {} as Record<string, ScheduledPost[]>)

      Object.values(groupedByVideo).forEach((posts) => {
        const firstPost = posts[0]
        const postedTimes = posts
          .map((post) => post.posted_at)
          .filter((value): value is string => Boolean(value))

        const failedCount = posts.filter((post) => post.status === 'failed').length
        const postedCount = posts.filter((post) => post.status === 'posted').length
        const pendingCount = posts.filter((post) => post.status === 'pending' || post.status === 'scheduled').length

        const groupedStatus: ScheduledPostGroup['status'] = pendingCount > 0
          ? 'scheduled'
          : postedCount > 0 && failedCount === 0
            ? 'posted'
            : failedCount > 0 && postedCount === 0
              ? 'failed'
              : 'scheduled'

        combined[date].push({
          _isScheduledPostGroup: true,
          id: `post-group-${firstPost.video_id}-${date}`,
          video_id: firstPost.video_id,
          scheduled_date: date,
          scheduled_time: firstPost.scheduled_time,
          posted_at: postedTimes.length > 0 ? postedTimes.sort()[postedTimes.length - 1] || null : firstPost.posted_at,
          status: groupedStatus,
          caption: firstPost.caption || null,
          videos: firstPost.videos,
          platforms: posts.map((post) => ({
            platform: post.platform,
            status: post.status,
            error_message: post.error_message,
          })),
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




  const getStartOfWeek = (date: Date) => {
    const start = new Date(date)
    start.setHours(0, 0, 0, 0)
    start.setDate(start.getDate() - start.getDay())
    return start
  }

  const weekDays = useMemo(() => {
    const start = getStartOfWeek(currentMonth)
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(start)
      day.setDate(start.getDate() + index)
      return day
    })
  }, [currentMonth])

  const formatWeekRange = (days: Date[]) => {
    if (!days.length) return ''
    const start = days[0]
    const end = days[days.length - 1]
    const locale = language === 'ru' ? 'ru-RU' : language === 'uk' ? 'uk-UA' : language === 'es' ? 'es-ES' : language === 'de' ? 'de-DE' : 'en-US'
    const startMonth = start.toLocaleDateString(locale, { month: 'short' })
    const endMonth = end.toLocaleDateString(locale, { month: 'short' })
    const year = end.getFullYear()
    return `${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}, ${year}`
  }

  const navigateCalendar = (direction: 'prev' | 'next') => {
    setCurrentMonth((prev: Date) => {
      const newDate = new Date(prev)
      if (calendarView === 'week') {
        newDate.setDate(prev.getDate() + (direction === 'prev' ? -7 : 7))
      } else {
        newDate.setMonth(prev.getMonth() + (direction === 'prev' ? -1 : 1))
      }
      return newDate
    })
  }

  const movePlanItemToDate = async (itemId: string, dateKey: string) => {
    try {
      await api.put(`/api/plans/items/${itemId}`, { scheduled_date: dateKey })
      if (selectedPlan) {
        await loadPlanItems(selectedPlan.id)
      } else {
        await loadAllPlanItems(plans)
      }
      addNotification({
        type: 'success',
        title: 'Schedule updated',
        message: `Moved item to ${new Date(dateKey).toLocaleDateString()}`,
      })
    } catch (error) {
      console.error('Failed to move plan item:', error)
      addNotification({
        type: 'error',
        title: 'Could not move item',
        message: 'Please try again.',
      })
    }
  }

  const getItemsForDate = (date: Date | null) => {
    if (!date) return []
    const dateKey = getDateKey(date)
    return itemsByDate[dateKey] || []
  }

  // Helper to check if an item is a scheduled post
  const isScheduledPost = (item: CalendarItem): item is ScheduledPostGroup => {
    return '_isScheduledPostGroup' in item && item._isScheduledPostGroup === true
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
      platforms: getDefaultSelectedPlatforms(item),
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
      all: calendarPlanItems.length + scheduledPosts.length,
      pending: calendarPlanItems.filter((i: VideoPlanItem) => i.status === 'pending').length + scheduledCount,
      ready: calendarPlanItems.filter((i: VideoPlanItem) => i.status === 'ready').length,
      completed: calendarPlanItems.filter((i: VideoPlanItem) => i.status === 'completed').length,
      scheduled: calendarPlanItems.filter((i: VideoPlanItem) => i.status === 'scheduled').length + scheduledCount,
      posted: calendarPlanItems.filter((i: VideoPlanItem) => i.status === 'posted').length + postedCount,
      failed: calendarPlanItems.filter((i: VideoPlanItem) => i.status === 'failed').length + scheduledPosts.filter((p: ScheduledPost) => p.status === 'failed').length,
    }
  }

  const statusCounts = getStatusCounts()

  const automationVideoItems = useMemo(() => {
    return [...calendarPlanItems]
      .filter((item) => item.video_id || item.videos?.video_url)
      .sort((a, b) => {
        const aDate = new Date(`${a.scheduled_date}T${a.scheduled_time || '00:00:00'}`).getTime()
        const bDate = new Date(`${b.scheduled_date}T${b.scheduled_time || '00:00:00'}`).getTime()
        return bDate - aDate
      })
  }, [calendarPlanItems])

  const sourceBadgeClasses: Record<StudioVideoType, string> = {
    AI: 'bg-purple-100 text-purple-700',
    Uploaded: 'bg-blue-100 text-blue-700',
    Auto: 'bg-emerald-100 text-emerald-700',
  }

  const statusDotClasses: Record<StudioVideoStatus, string> = {
    Ready: 'bg-purple-500',
    Posted: 'bg-emerald-500',
    Failed: 'bg-rose-500',
  }

  const filteredStudioVideos = useMemo(() => {
    const query = librarySearch.trim().toLowerCase()
    const locale = language === 'ru' ? 'ru-RU' : language === 'uk' ? 'uk-UA' : language === 'es' ? 'es-ES' : language === 'de' ? 'de-DE' : 'en-US'
    const automationVideoIds = new Set(
      calendarPlanItems
        .map((item) => item.video_id)
        .filter((id): id is string => Boolean(id))
    )

    const postedVideoIds = new Set(
      scheduledPosts
        .filter((post) => post.status === 'posted')
        .map((post) => post.video_id)
    )

    const toStudioStatus = (status?: string | null, isPosted?: boolean): StudioVideoStatus | null => {
      if (isPosted) return 'Posted'
      const normalized = normalizeStatusValue(status)
      if (normalized === 'failed' || normalized === 'error') return 'Failed'
      if (normalized === 'completed') return 'Ready'
      return null
    }

    const hasPlayableVideoUrl = (url?: string | null) => {
      if (!url) return false
      const trimmed = url.trim()
      if (!trimmed) return false
      return trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')
    }

    const isUploadedVideo = (video: any, isAutomationVideo: boolean) => {
      if (isAutomationVideo) return false
      const topic = (video.topic || '').toLowerCase()
      const url = (video.video_url || '').toLowerCase()
      return topic.includes('upload') || url.includes('upload') || (!video.script && video.status === 'completed')
    }

    return [...(studioVideos || [])]
      .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      .map((video: any): StudioVideo => {
        const isAutomationVideo = automationVideoIds.has(video.id)
        const type: StudioVideoType = isAutomationVideo
          ? 'Auto'
          : (isUploadedVideo(video, isAutomationVideo) ? 'Uploaded' : 'AI')

        const createdAt = video.created_at ? new Date(video.created_at) : new Date()
        const videoPosts = scheduledPosts.filter((post) => post.video_id === video.id)
        const hasPostedPost = postedVideoIds.has(video.id)
        const status = toStudioStatus(video.status, hasPostedPost)
        const platforms: Array<'yt' | 'ig'> = Array.from(new Set(
          videoPosts
            .map((post) => post.platform)
            .filter((platform) => platform === 'youtube' || platform === 'instagram')
            .map((platform) => platform === 'youtube' ? 'yt' : 'ig')
        )) as Array<'yt' | 'ig'>

        return {
          id: video.id,
          title: getReadableVideoTitle(video.topic, type),
          type,
          status: status || 'Ready',
          date: createdAt.toLocaleDateString(locale, { month: 'short', day: 'numeric' }),
          time: createdAt.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' }),
          caption: video.script || 'No caption yet.',
          platforms,
          videoUrl: video.video_url || null,
          _isVisibleInLibrary: Boolean(status) && hasPlayableVideoUrl(video.video_url),
        }
      })
      .filter((video) => {
        if (!video._isVisibleInLibrary) return false
        const matchesSearch =
          !query ||
          video.title.toLowerCase().includes(query) ||
          video.type.toLowerCase().includes(query)
        const matchesType = libraryTypeFilter === 'all' || video.type === libraryTypeFilter
        const matchesStatus = libraryStatusFilter === 'all' || video.status === libraryStatusFilter
        return matchesSearch && matchesType && matchesStatus
      })
  }, [
    librarySearch,
    libraryTypeFilter,
    libraryStatusFilter,
    language,
    studioVideos,
    calendarPlanItems,
    scheduledPosts,
  ])

  const automationSummary = useMemo(() => {
    const total = automationVideoItems.length
    const ready = automationVideoItems.filter((item) => {
      const normalizedVideoStatus = normalizeStatusValue(item.videos?.status)
      const normalizedItemStatus = normalizeStatusValue(item.status)
      return normalizedVideoStatus === 'completed' || normalizedItemStatus === 'completed'
    }).length
    const inProgress = automationVideoItems.filter((item) => {
      const normalizedVideoStatus = normalizeStatusValue(item.videos?.status)
      const normalizedItemStatus = normalizeStatusValue(item.status)
      return (
        normalizedVideoStatus === 'generating' ||
        normalizedItemStatus === 'generating' ||
        normalizedItemStatus === 'researching' ||
        normalizedItemStatus === 'draft'
      )
    }).length

    return {
      total,
      ready,
      inProgress,
    }
  }, [automationVideoItems])

  const getStatusBadge = (status: string, scriptStatus?: string | null, item?: VideoPlanItem) => {
    // Clear, user-friendly status labels that explain what's happening in the workflow
    const normalizedItemStatus = normalizeStatusValue(status) || ''
    const normalizedVideoStatus = normalizeStatusValue(item?.videos?.status) || ''
    const hasVideoFailure = ['failed', 'error'].includes(normalizedVideoStatus)
    const hasItemFailure = Boolean(item?.error_message)
    const effectiveStatus = (hasVideoFailure || hasItemFailure)
      ? 'failed'
      : (normalizedVideoStatus || normalizedItemStatus)

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
        label = t('video_planning.generating_video');
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
              Content Studio
            </p>
            <h1 className="text-3xl font-semibold text-primary">
              Content Calendar
            </h1>
            <p className="text-sm text-slate-500">
              Calendar view of all posted, planned, and upcoming videos.
            </p>
          </div>
          <div className="flex w-full items-center gap-2 sm:justify-end md:w-auto">
            <Button
              onClick={() => setUploadPlanModal(true)}
              leftIcon={<Upload className="h-4 w-4" />}
              variant="secondary"
              className="w-full sm:w-auto min-h-[44px] px-5"
              disabled={showUpgrade}
            >
              {showUpgrade ? t('common.upgrade_required') || 'Subscription Required' : 'Upload video'}
            </Button>
            <Button
              onClick={() => setGenerateVideoModalOpen(true)}
              leftIcon={<Plus className="h-4 w-4" />}
              className="w-full sm:w-auto min-h-[44px] px-5 shadow-md shadow-brand-500/20"
              disabled={showUpgrade}
            >
              {showUpgrade ? t('common.upgrade_required') || 'Subscription Required' : 'Generate AI video'}
            </Button>

            <div className="relative" ref={headerActionsRef}>
              <button
                type="button"
                onClick={() => setHeaderActionsOpen((open) => !open)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-brand-300 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                aria-label="More actions"
                aria-expanded={headerActionsOpen}
                aria-haspopup="menu"
              >
                <MoreVertical className="h-4 w-4" />
              </button>

              {headerActionsOpen && (
                <div
                  role="menu"
                  aria-label="Content Studio actions"
                  className="absolute right-0 z-20 mt-2 min-w-[220px] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setCreateModal(true)
                      setHeaderActionsOpen(false)
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                  >
                    <Sparkles className="h-4 w-4 text-brand-500" />
                    Create automation workflow
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <Card className="border border-slate-200 bg-white p-5 shadow-sm sm:rounded-3xl sm:p-6">
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Content Studio</p>
              <h2 className="text-2xl font-semibold text-slate-950">Everything video in one place</h2>
              <p className="max-w-2xl text-sm text-slate-600">
                Calendar, video library, and automations in a single flow. Preview is the hero action on each video.
              </p>
            </div>

            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              {[
                { id: 'calendar', label: 'Calendar', icon: '📅' },
                { id: 'library', label: 'Video Library', icon: '🎞' },
                { id: 'automations', label: 'Automations', icon: '⚡' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setContentStudioTab(tab.id as ContentStudioTab)}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${contentStudioTab === tab.id
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                    }`}
                >
                  <span className="mr-1.5" aria-hidden="true">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {contentStudioTab === 'calendar' && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Calendar remains your planning anchor. Use the calendar section below to manage publishing windows and drag videos between dates.
              </div>
            )}

            {contentStudioTab === 'library' && (
              <div className="space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                  <div className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 lg:max-w-sm">
                    <Search className="h-4 w-4 text-slate-400" />
                    <input
                      value={librarySearch}
                      onChange={(event) => setLibrarySearch(event.target.value)}
                      placeholder="Search videos…"
                      className="w-full border-none bg-transparent text-sm text-slate-700 outline-none"
                    />
                  </div>
                  <select
                    value={libraryTypeFilter}
                    onChange={(event) => setLibraryTypeFilter(event.target.value as 'all' | StudioVideoType)}
                    className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-600"
                  >
                    <option value="all">All types</option>
                    <option value="AI">AI Generated</option>
                    <option value="Uploaded">Uploaded</option>
                    <option value="Auto">Automation</option>
                  </select>
                  <select
                    value={libraryStatusFilter}
                    onChange={(event) => setLibraryStatusFilter(event.target.value as 'all' | StudioVideoStatus)}
                    className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-600"
                  >
                    <option value="all">All statuses</option>
                    <option value="Ready">Ready</option>
                    <option value="Posted">Posted</option>
                    <option value="Failed">Failed</option>
                  </select>
                  <div className="ml-auto hidden items-center overflow-hidden rounded-xl border border-slate-200 lg:flex">
                    <button type="button" className="bg-brand-50 px-3 py-2 text-brand-600"><Grid2X2 className="h-4 w-4" /></button>
                    <button type="button" className="px-3 py-2 text-slate-400"><List className="h-4 w-4" /></button>
                  </div>
                </div>

                {filteredStudioVideos.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                    No videos found. Try adjusting your search or filters.
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {filteredStudioVideos.map((video) => (
                      <article
                        key={video.id}
                        className="group overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
                      >
                        <div className="relative aspect-[9/11] bg-gradient-to-br from-slate-800 via-brand-600 to-slate-200">
                          {video.videoUrl && (
                            <video
                              src={video.videoUrl}
                              controls
                              preload="metadata"
                              className="h-full w-full object-cover"
                            />
                          )}
                          <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${sourceBadgeClasses[video.type]}`}>
                            {video.type === 'AI' ? 'AI Generated' : video.type === 'Uploaded' ? 'Uploaded' : 'Automation'}
                          </span>
                          <span className={`absolute right-3 top-3 h-2.5 w-2.5 rounded-full ring-2 ring-white ${statusDotClasses[video.status]}`} />
                          {!video.videoUrl && (
                            <span className="absolute inset-0 grid place-items-center">
                              <span className="grid h-12 w-12 place-items-center rounded-full bg-white/90 text-slate-700">
                                <Play className="h-5 w-5 fill-current" />
                              </span>
                            </span>
                          )}
                        </div>
                        <div className="space-y-3 p-4">
                          <div>
                            <p className="truncate text-sm font-semibold text-slate-900">{video.title}</p>
                            <p className="text-xs text-slate-500">{video.date} · {video.time}</p>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <span className="inline-flex items-center justify-center rounded-lg border border-brand-200 bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700">▶ Live preview</span>
                            <span className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600">✎ Edit</span>
                            <button
                              type="button"
                              onClick={() => setSelectedStudioVideo(video)}
                              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
                            >
                              🚀 Details
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}

            {contentStudioTab === 'automations' && (
              <div className="space-y-4">
                <Button
                  onClick={() => setCreateModal(true)}
                  leftIcon={<Sparkles className="h-4 w-4" />}
                  className="w-full sm:w-auto"
                  disabled={showUpgrade}
                >
                  {showUpgrade ? t('common.upgrade_required') || 'Subscription Required' : 'Create automation workflow'}
                </Button>
                <div className="grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Automation videos</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">{automationSummary.total}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Ready</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">{automationSummary.ready}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">In progress</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">{automationSummary.inProgress}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        <Modal isOpen={Boolean(selectedStudioVideo)} onClose={() => setSelectedStudioVideo(null)} title={selectedStudioVideo?.title || 'Video preview'}>
          {selectedStudioVideo && (
            <div className="space-y-5">
              {selectedStudioVideo.videoUrl ? (
                <video
                  src={selectedStudioVideo.videoUrl}
                  controls
                  className="aspect-[9/16] w-full max-w-[260px] rounded-2xl bg-black object-cover"
                />
              ) : (
                <div className="aspect-[9/16] w-full max-w-[260px] rounded-2xl bg-gradient-to-br from-slate-800 via-brand-600 to-slate-200" />
              )}
              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                <span className={`rounded-full px-2.5 py-1 ${sourceBadgeClasses[selectedStudioVideo.type]}`}>
                  {selectedStudioVideo.type === 'AI' ? 'AI Generated' : selectedStudioVideo.type === 'Uploaded' ? 'Uploaded' : 'Automation'}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{selectedStudioVideo.status}</span>
                {selectedStudioVideo.platforms.length === 0 && (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">No platforms</span>
                )}
                {selectedStudioVideo.platforms.map((platform) => (
                  <span key={platform} className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                    {platform === 'yt' ? 'YouTube' : 'Instagram'}
                  </span>
                ))}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Caption</p>
                <p className="mt-1 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{selectedStudioVideo.caption}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Scheduled for</p>
                <p className="mt-1 text-sm text-slate-700">{selectedStudioVideo.date}, 2026 · {selectedStudioVideo.time}</p>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {selectedStudioVideo.videoUrl && (
                  <Button
                    variant="secondary"
                    onClick={() => window.open(selectedStudioVideo.videoUrl || '', '_blank', 'noopener,noreferrer')}
                  >
                    Download
                  </Button>
                )}
                <Button variant="secondary">Edit</Button>
                <Button>Schedule & Post</Button>
              </div>
            </div>
          )}
        </Modal>

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
        {(
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
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xl font-semibold text-primary text-center sm:text-left">
                  {calendarView === 'week' ? formatWeekRange(weekDays) : formatMonthYear(currentMonth)}
                </h2>
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant={calendarView === 'week' ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => setCalendarView('week')}
                  >
                    Weekly view
                  </Button>
                  <Button
                    variant={calendarView === 'month' ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => setCalendarView('month')}
                  >
                    Monthly view
                  </Button>
                </div>
              </div>

              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-500">Overall calendar for your full content plan: uploads, AI videos, scheduled, and posted.</p>
                <div className="flex justify-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => navigateCalendar('prev')} className="flex-1 sm:flex-none">← {t('video_planning.prev')}</Button>
                  <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(new Date())} className="flex-1 sm:flex-none">{t('video_planning.today')}</Button>
                  <Button variant="ghost" size="sm" onClick={() => navigateCalendar('next')} className="flex-1 sm:flex-none">{t('video_planning.next')} →</Button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-2">
                {[{ key: 'sun' }, { key: 'mon' }, { key: 'tue' }, { key: 'wed' }, { key: 'thu' }, { key: 'fri' }, { key: 'sat' }].map((day) => (
                  <div key={day.key} className="p-2 text-center text-xs font-semibold text-slate-500">{t(`video_planning.${day.key}`)}</div>
                ))}

                {(calendarView === 'week' ? weekDays : getDaysInMonth(currentMonth)).map((date, index) => {
                  const dateKey = getDateKey(date)
                  const items = getItemsForDate(date)
                  const isToday = date && dateKey === getDateKey(new Date())
                  const isSelected = date && dateKey === selectedDate

                  return (
                    <button
                      key={index}
                      onClick={() => {
                        if (!date) return
                        setSelectedDate(dateKey)
                        setIsDetailDrawerOpen(true)
                      }}
                      onDragOver={(event) => {
                        if (!date || !draggingItemId) return
                        event.preventDefault()
                      }}
                      onDrop={async (event) => {
                        event.preventDefault()
                        if (!date || !draggingItemId) return
                        await movePlanItemToDate(draggingItemId, dateKey)
                        setDraggingItemId(null)
                      }}
                      className={`min-h-[140px] rounded-lg border p-2 text-left transition relative ${!date
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
                          <div className="mb-1 flex items-center justify-between">
                            <div className={`text-sm font-semibold ${isToday ? 'text-brand-600' : 'text-slate-700'}`}>{date.getDate()}</div>
                            {items.length > 0 && <span className="text-xs font-medium text-slate-600">{items.length}</span>}
                          </div>
                          {items.length > 0 && (
                            <div className="mt-1 space-y-1 max-h-[104px] overflow-y-auto">
                              {items.slice(0, 5).map((item) => {
                                const isPost = isScheduledPost(item)
                                const status = normalizeStatusValue((isPost ? item.status : item.videos?.status || item.status)) || 'pending'
                                const displayTopic = isPost
                                  ? getReadableVideoTitle(item.videos?.topic, 'Auto')
                                  : getReadableVideoTitle(
                                    item.topic || (item.scheduled_time ? t('video_planning.planned_with_time').replace('{time}', formatTime(item.scheduled_time)) : t('video_planning.planned')),
                                    item.video_id ? 'Auto' : 'AI',
                                  )
                                const displayTime = isPost
                                  ? (item.scheduled_time || item.posted_at ? new Date(item.scheduled_time || item.posted_at || '').toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '')
                                  : (item.scheduled_time ? formatTime(item.scheduled_time) : '')

                                return (
                                  <div
                                    key={item.id}
                                    draggable={!isPost}
                                    onDragStart={() => !isPost && setDraggingItemId(item.id)}
                                    className={`truncate rounded px-1.5 py-1 text-xs border ${status === 'completed' || status === 'posted'
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
                                                    : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                                    title={`${displayTime ? displayTime + ' - ' : ''}${displayTopic} (${status})`}
                                  >
                                    <div className="flex items-center gap-1">
                                      {displayTime && <span className="text-[10px] font-medium opacity-75">{displayTime}</span>}
                                      <span className="flex-1 truncate font-medium">{displayTopic}</span>
                                    </div>
                                  </div>
                                )
                              })}
                              {items.length > 5 && <div className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">{t('video_planning.more_items').replace('{count}', (items.length - 5).toString())}</div>}
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
                          const displayTime = item.posted_at || item.scheduled_time
                          const caption = item.caption?.trim() || item.videos?.topic?.trim() || 'No caption name'
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
                                      {displayTime ? new Date(displayTime).toLocaleTimeString(language === 'ru' ? 'ru-RU' : language === 'uk' ? 'uk-UA' : language === 'es' ? 'es-ES' : language === 'de' ? 'de-DE' : 'en-US', {
                                        hour: 'numeric',
                                        minute: '2-digit',
                                        hour12: true
                                      }) : t('video_planning.no_time_set')}
                                    </span>
                                    <Badge variant={item.status === 'posted' ? 'success' : item.status === 'pending' || item.status === 'scheduled' ? 'warning' : item.status === 'failed' ? 'error' : 'default'}>
                                      {item.status === 'posted'
                                        ? t('video_planning.posted')
                                        : item.status === 'pending' || item.status === 'scheduled'
                                          ? t('video_planning.scheduled')
                                          : item.status === 'failed'
                                            ? t('video_planning.failed')
                                            : item.status}
                                    </Badge>
                                    <div className="flex flex-wrap gap-2">
                                      {item.platforms.map((platformPost) => {
                                        const isSuccessful = platformPost.status === 'posted'
                                        const isFailed = platformPost.status === 'failed'
                                        const style = isSuccessful
                                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                          : isFailed
                                            ? 'border-red-200 bg-red-50 text-red-700'
                                            : 'border-amber-200 bg-amber-50 text-amber-700'

                                        return (
                                          <span
                                            key={`${item.id}-${platformPost.platform}`}
                                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${style}`}
                                            title={platformPost.error_message || undefined}
                                          >
                                            {platformPost.platform}
                                          </span>
                                        )
                                      })}
                                    </div>
                                  </div>
                                  <div>
                                    <h3 className="font-semibold text-primary">
                                      {item.videos?.topic || t('video_planning.scheduled_post')}
                                    </h3>
                                    <p className="mt-1 text-sm text-slate-600">
                                      Caption: {caption}
                                    </p>
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

        )}

        <UploadAndPlanModal
          isOpen={uploadPlanModal}
          onClose={() => setUploadPlanModal(false)}
          onSuccess={handleUploadPlanSuccess}
        />

        <GenerateVideoModal
          isOpen={generateVideoModalOpen}
          onClose={() => setGenerateVideoModalOpen(false)}
          onSuccess={async () => {
            await Promise.all([
              loadScheduledPosts(),
              selectedPlan ? loadPlanItems(selectedPlan.id) : Promise.resolve(),
            ])
          }}
        />

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
            setStartDate(getLocalDateYMD())
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
                {t('video_planning.trigger_time')}
              </label>

              <div className="bg-white border border-brand-200 rounded-lg p-3">
                <p className="text-xs text-slate-600">
                  <strong>{t('video_planning.trigger_time_help_title')}</strong>{' '}
                  {t('video_planning.trigger_time_help_body')}
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
            setStartDate(getLocalDateYMD())
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
                {t('video_planning.trigger_time')}
              </label>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-700">
                  <strong>{t('video_planning.trigger_time_help_title')}</strong>{' '}
                  {t('video_planning.trigger_time_help_body')}
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
                  setStartDate(getLocalDateYMD())
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
            const itemsForDate = calendarPlanItems.filter(item => item.scheduled_date === itemDate)
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
                            // Update the item in both selected plan and calendar arrays
                            setPlanItems(prevItems =>
                              prevItems.map(item =>
                                item.id === selectedItem.id ? response.data.item : item
                              )
                            )
                            setCalendarPlanItems(prevItems =>
                              prevItems.map(item =>
                                item.id === selectedItem.id ? response.data.item : item
                              )
                            )
                            // Update selectedItem
                            setSelectedItem(response.data.item)
                            if (isDev) {
                              console.log('[VideoPlanning] Status refreshed:', response.data.message)
                            }
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
