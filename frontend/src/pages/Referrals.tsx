import { useState, useEffect } from 'react'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { useToast } from '../hooks/useToast'
import { Users, Copy, Check, UserPlus, Gift, Share2 } from 'lucide-react'
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
      <div className="mx-auto max-w-4xl space-y-6 px-3 py-4 sm:space-y-8 sm:px-4 sm:py-8">
        {/* Hero Banner */}
        <section className="relative overflow-hidden rounded-[32px] border border-white/30 bg-gradient-to-br from-brand-600 via-brand-500 to-indigo-500 p-6 sm:p-8 text-white shadow-[0_60px_120px_-70px_rgba(79,70,229,0.9)]">
          <div className="absolute -left-16 top-1/2 h-56 w-56 -translate-y-1/2 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -right-16 top-8 h-44 w-44 rounded-full bg-emerald-400/30 blur-3xl" />
          <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">{t('common.partner_program')}</p>
              <h1 className="text-3xl font-semibold md:text-4xl">{t('referrals.title')}</h1>
              <p className="text-sm text-white/80">{t('referrals.subtitle')}</p>
            </div>
            <div className="flex flex-col gap-2 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 px-5 py-4 text-center">
              <p className="text-3xl font-bold">{info?.total_referrals || 0}</p>
              <p className="text-xs text-white/70">{t('referrals.total_referrals')}</p>
            </div>
          </div>
        </section>

        {/* Referral Link Card */}
        <Card className="p-4 sm:p-6">
          <h2 className="mb-3 text-base font-semibold text-primary sm:mb-4 sm:text-lg">{t('referrals.your_referral_link')}</h2>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700 font-mono break-all sm:px-4 sm:py-3 sm:text-sm sm:truncate sm:break-normal">
              {info?.referral_link || '...'}
            </div>
            <Button onClick={copyLink} variant="primary" className="w-full shrink-0 gap-2 sm:w-auto">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? t('referrals.link_copied') : t('referrals.copy_link')}
            </Button>
          </div>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <Card className="p-3 text-center sm:p-6">
            <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-500 sm:mb-3 sm:h-12 sm:w-12 sm:rounded-2xl">
              <UserPlus className="h-4 w-4 sm:h-6 sm:w-6" />
            </div>
            <p className="text-xl font-bold text-primary sm:text-3xl">{info?.total_referrals || 0}</p>
            <p className="mt-0.5 text-[10px] leading-tight text-slate-500 sm:mt-1 sm:text-sm">{t('referrals.total_referrals')}</p>
          </Card>
          <Card className="p-3 text-center sm:p-6">
            <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-500 sm:mb-3 sm:h-12 sm:w-12 sm:rounded-2xl">
              <Gift className="h-4 w-4 sm:h-6 sm:w-6" />
            </div>
            <p className="text-xl font-bold text-primary sm:text-3xl">{info?.total_credits_earned || 0}</p>
            <p className="mt-0.5 text-[10px] leading-tight text-slate-500 sm:mt-1 sm:text-sm">{t('referrals.total_credits_earned')}</p>
          </Card>
          <Card className="p-3 text-center sm:p-6">
            <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-500 sm:mb-3 sm:h-12 sm:w-12 sm:rounded-2xl">
              <Share2 className="h-4 w-4 sm:h-6 sm:w-6" />
            </div>
            <p className="text-xl font-bold text-primary sm:text-3xl">10</p>
            <p className="mt-0.5 text-[10px] leading-tight text-slate-500 sm:mt-1 sm:text-sm">{t('referrals.credits_per_referral')}</p>
          </Card>
        </div>

        {/* How It Works */}
        <Card className="p-4 sm:p-6">
          <h2 className="mb-4 text-base font-semibold text-primary sm:mb-6 sm:text-lg">{t('referrals.how_it_works')}</h2>
          <div className="grid gap-5 sm:grid-cols-3 sm:gap-6">
            <div className="flex items-start gap-4 sm:flex-col sm:items-center sm:text-center">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600 text-base font-bold sm:mb-3 sm:h-12 sm:w-12 sm:text-lg">
                1
              </div>
              <div>
                <h3 className="mb-0.5 text-sm font-semibold text-primary sm:mb-1">{t('referrals.step_1_title')}</h3>
                <p className="text-xs text-slate-500 sm:text-sm">{t('referrals.step_1_desc')}</p>
              </div>
            </div>
            <div className="flex items-start gap-4 sm:flex-col sm:items-center sm:text-center">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 text-base font-bold sm:mb-3 sm:h-12 sm:w-12 sm:text-lg">
                2
              </div>
              <div>
                <h3 className="mb-0.5 text-sm font-semibold text-primary sm:mb-1">{t('referrals.step_2_title')}</h3>
                <p className="text-xs text-slate-500 sm:text-sm">{t('referrals.step_2_desc')}</p>
              </div>
            </div>
            <div className="flex items-start gap-4 sm:flex-col sm:items-center sm:text-center">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 text-base font-bold sm:mb-3 sm:h-12 sm:w-12 sm:text-lg">
                3
              </div>
              <div>
                <h3 className="mb-0.5 text-sm font-semibold text-primary sm:mb-1">{t('referrals.step_3_title')}</h3>
                <p className="text-xs text-slate-500 sm:text-sm">{t('referrals.step_3_desc')}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Referred Users Table / Cards */}
        <Card className="p-4 sm:p-6">
          <h2 className="mb-4 text-base font-semibold text-primary sm:text-lg">{t('referrals.referred_users')}</h2>
          {info?.referrals && info.referrals.length > 0 ? (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto sm:block">
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

              {/* Mobile cards */}
              <div className="space-y-3 sm:hidden">
                {info.referrals.map((ref, idx) => (
                  <div key={idx} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-primary truncate max-w-[60%]">{maskEmail(ref.email)}</span>
                      <span className="text-xs font-semibold text-emerald-600">+{ref.credits_awarded} credits</span>
                    </div>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {new Date(ref.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center sm:py-12">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 sm:mb-4 sm:h-16 sm:w-16">
                <Users className="h-6 w-6 sm:h-8 sm:w-8" />
              </div>
              <p className="text-sm font-medium text-primary">{t('referrals.no_referrals_yet')}</p>
              <p className="mt-1 text-xs text-slate-500 sm:text-sm">{t('referrals.no_referrals_desc')}</p>
            </div>
          )}
        </Card>
      </div>
    </Layout>
  )
}
