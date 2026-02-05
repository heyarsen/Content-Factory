import { DATA_EXPORT_FIELDS_VERSION, DATA_DELETION_GRACE_PERIOD_DAYS } from '../config/privacy.js'

export type ConsentCategory = {
  necessary: boolean
  analytics: boolean
  marketing: boolean
}

export type PrivacyExportPayload = {
  exportVersion: string
  generatedAt: string
  user: Record<string, any>
  profile: Record<string, any> | null
  preferences: Record<string, any> | null
  socialAccounts: Array<Record<string, any>>
  videos: Array<Record<string, any>>
  scheduledPosts: Array<Record<string, any>>
  videoPlans: Array<Record<string, any>>
  videoPlanItems: Array<Record<string, any>>
  videoPrompts: Array<Record<string, any>>
  contentItems: Array<Record<string, any>>
  reels: Array<Record<string, any>>
  avatars: Array<Record<string, any>>
  supportTickets: Array<Record<string, any>>
  supportMessages: Array<Record<string, any>>
  creditTransactions: Array<Record<string, any>>
  subscriptions: Array<Record<string, any>>
  consentLogs: Array<Record<string, any>>
  deletionRequests: Array<Record<string, any>>
}

export function buildPrivacyExportPayload(params: {
  user: Record<string, any>
  profile: Record<string, any> | null
  preferences: Record<string, any> | null
  socialAccounts: Array<Record<string, any>>
  videos: Array<Record<string, any>>
  scheduledPosts: Array<Record<string, any>>
  videoPlans: Array<Record<string, any>>
  videoPlanItems: Array<Record<string, any>>
  videoPrompts: Array<Record<string, any>>
  contentItems: Array<Record<string, any>>
  reels: Array<Record<string, any>>
  avatars: Array<Record<string, any>>
  supportTickets: Array<Record<string, any>>
  supportMessages: Array<Record<string, any>>
  creditTransactions: Array<Record<string, any>>
  subscriptions: Array<Record<string, any>>
  consentLogs: Array<Record<string, any>>
  deletionRequests: Array<Record<string, any>>
}): PrivacyExportPayload {
  return {
    exportVersion: DATA_EXPORT_FIELDS_VERSION,
    generatedAt: new Date().toISOString(),
    user: params.user,
    profile: params.profile,
    preferences: params.preferences,
    socialAccounts: params.socialAccounts,
    videos: params.videos,
    scheduledPosts: params.scheduledPosts,
    videoPlans: params.videoPlans,
    videoPlanItems: params.videoPlanItems,
    videoPrompts: params.videoPrompts,
    contentItems: params.contentItems,
    reels: params.reels,
    avatars: params.avatars,
    supportTickets: params.supportTickets,
    supportMessages: params.supportMessages,
    creditTransactions: params.creditTransactions,
    subscriptions: params.subscriptions,
    consentLogs: params.consentLogs,
    deletionRequests: params.deletionRequests,
  }
}

export function isDeletionConfirmationValid(confirmValue: string | undefined): boolean {
  return confirmValue === 'DELETE'
}

export function getDeletionSchedule(now: Date = new Date()): {
  requestedAt: string
  scheduledFor: string
  gracePeriodDays: number
} {
  const requestedAt = new Date(now)
  const scheduledFor = new Date(now)
  scheduledFor.setDate(scheduledFor.getDate() + DATA_DELETION_GRACE_PERIOD_DAYS)

  return {
    requestedAt: requestedAt.toISOString(),
    scheduledFor: scheduledFor.toISOString(),
    gracePeriodDays: DATA_DELETION_GRACE_PERIOD_DAYS,
  }
}
