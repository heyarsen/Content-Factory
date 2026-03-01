import { useState, useEffect } from 'react'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { useToast } from '../hooks/useToast'
import { Users, Copy, Check, Link, UserPlus, Gift, Share2 } from 'lucide-react'
import api from '../lib/api'
import { useLanguage } from '../contexts/LanguageContext'

interface ReferralInfo {
  referral_code: string
  referral_link: string
  total_referrals: number
  total_credits_earned: number
  referrals: Array<{
    email: string
    created_at: string
    credits_awarded: number
  }>
}

export function Referrals() {
  const { t } = useLanguage()
  const { addToast } = useToast()
  const [info, setInfo] = useState<ReferralInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchReferralInfo()
  }, [])

  const fetchReferralInfo = async () => {
    try {
      setLoading(true)
      const { data } = await api.get('/api/referrals/info')
      setInfo(data)
    } catch (err) {
      addToast('Failed to load referral info', 'error')
    } finally {
      setLoading(false)
    }
  }

  const copyLink = async () => {
    if (!info?.referral_link) return
    try {
      await navigator.clipboard.writeText(info.referral_link)
      setCopied(true)
      addToast(t('referrals.link_copied'), 'success')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      addToast('Failed to copy', 'error')
    }
  }

  const maskEmail = (email: string) => {
    const [name, domain] = email.split('@')
    if (!domain) return email
    const masked = name.length > 2 ? name[0] + '***' + name[name.length - 1] : '***'
    return `${masked}@${domain}`
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-indigo-500 text-white shadow-md">
              <Users className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-semibold text-primary">{t('referrals.title')}</h1>
          </div>
          <p className="text-sm text-slate-500">{t('referrals.subtitle')}</p>
        </div>

        {/* Referral Link Card */}
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-primary">{t('referrals.your_referral_link')}</h2>
          <div className="flex items-center gap-3">
            <div className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 font-mono truncate">
              {info?.referral_link || '...'}
            </div>
            <Button onClick={copyLink} variant="primary" className="shrink-0 gap-2">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? t('referrals.link_copied') : t('referrals.copy_link')}
            </Button>
          </div>
        </Card>

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="p-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-500">
              <UserPlus className="h-6 w-6" />
            </div>
            <p className="text-3xl font-bold text-primary">{info?.total_referrals || 0}</p>
            <p className="mt-1 text-sm text-slate-500">{t('referrals.total_referrals')}</p>
          </Card>
          <Card className="p-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
              <Gift className="h-6 w-6" />
            </div>
            <p className="text-3xl font-bold text-primary">{info?.total_credits_earned || 0}</p>
            <p className="mt-1 text-sm text-slate-500">{t('referrals.total_credits_earned')}</p>
          </Card>
          <Card className="p-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-500">
              <Share2 className="h-6 w-6" />
            </div>
            <p className="text-3xl font-bold text-primary">10</p>
            <p className="mt-1 text-sm text-slate-500">{t('referrals.credits_per_referral')}</p>
          </Card>
        </div>

        {/* How It Works */}
        <Card className="p-6">
          <h2 className="mb-6 text-lg font-semibold text-primary">{t('referrals.how_it_works')}</h2>
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="flex flex-col items-center text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-600 text-lg font-bold">
                1
              </div>
              <h3 className="mb-1 font-semibold text-primary">{t('referrals.step_1_title')}</h3>
              <p className="text-sm text-slate-500">{t('referrals.step_1_desc')}</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 text-lg font-bold">
                2
              </div>
              <h3 className="mb-1 font-semibold text-primary">{t('referrals.step_2_title')}</h3>
              <p className="text-sm text-slate-500">{t('referrals.step_2_desc')}</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 text-lg font-bold">
                3
              </div>
              <h3 className="mb-1 font-semibold text-primary">{t('referrals.step_3_title')}</h3>
              <p className="text-sm text-slate-500">{t('referrals.step_3_desc')}</p>
            </div>
          </div>
        </Card>

        {/* Referred Users Table */}
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-primary">{t('referrals.referred_users')}</h2>
          {info?.referrals && info.referrals.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="pb-3 text-left font-medium text-slate-500">{t('referrals.email_column')}</th>
                    <th className="pb-3 text-left font-medium text-slate-500">{t('referrals.date_column')}</th>
                    <th className="pb-3 text-right font-medium text-slate-500">{t('referrals.credits_column')}</th>
                  </tr>
                </thead>
                <tbody>
                  {info.referrals.map((ref, idx) => (
                    <tr key={idx} className="border-b border-slate-50 last:border-0">
                      <td className="py-3 text-primary">{maskEmail(ref.email)}</td>
                      <td className="py-3 text-slate-500">
                        {new Date(ref.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 text-right font-medium text-emerald-600">
                        +{ref.credits_awarded}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <Users className="h-8 w-8" />
              </div>
              <p className="font-medium text-primary">{t('referrals.no_referrals_yet')}</p>
              <p className="mt-1 text-sm text-slate-500">{t('referrals.no_referrals_desc')}</p>
            </div>
          )}
        </Card>
      </div>
    </Layout>
  )
}
