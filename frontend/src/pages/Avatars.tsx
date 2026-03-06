import { useCallback, useEffect, useMemo, useState } from 'react'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useToast } from '../hooks/useToast'
import api from '../lib/api'
import { useLanguage } from '../contexts/LanguageContext'
import { Loader2, Lock, Search, Star, UserPlus } from 'lucide-react'
import { readAvatarCache, writeAvatarCache } from '../lib/avatarCache'

type AvatarRecord = {
  id: string
  heygen_avatar_id?: string | null
  avatar_name?: string | null
  avatar_url?: string | null
  preview_url?: string | null
  thumbnail_url?: string | null
  categories?: string[] | null
  status?: string | null
}

export function Avatars() {
  const { t } = useLanguage()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [publicAvatars, setPublicAvatars] = useState<AvatarRecord[]>([])
  const [myAvatars, setMyAvatars] = useState<AvatarRecord[]>([])

  const loadAvatars = useCallback(async () => {
    const cached = readAvatarCache()
    if (cached) {
      setPublicAvatars(cached.publicAvatars as AvatarRecord[])
      setMyAvatars(cached.myAvatars as AvatarRecord[])
    }

    setLoading(true)
    try {
      const [publicResponse, myResponse] = await Promise.all([
        api.get('/api/avatars?public=true'),
        api.get('/api/avatars'),
      ])
      const nextPublicAvatars = publicResponse.data?.avatars ?? []
      const nextMyAvatars = myResponse.data?.avatars ?? []
      setPublicAvatars(nextPublicAvatars)
      setMyAvatars(nextMyAvatars)
      writeAvatarCache({
        publicAvatars: nextPublicAvatars,
        myAvatars: nextMyAvatars,
      })
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to load avatars')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void loadAvatars()
  }, [loadAvatars])

  const categories = useMemo(() => {
    const values = new Set<string>()
    publicAvatars.forEach((avatar) => {
      avatar.categories?.forEach((category) => {
        if (category?.trim()) values.add(category.trim())
      })
    })
    return ['All', ...Array.from(values).sort((a, b) => a.localeCompare(b))]
  }, [publicAvatars])

  const myAvatarIds = useMemo(
    () => new Set(myAvatars.map((avatar) => avatar.heygen_avatar_id || avatar.id)),
    [myAvatars]
  )

  const filteredPublicAvatars = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return publicAvatars.filter((avatar) => {
      const name = avatar.avatar_name || 'Unnamed avatar'
      const categoryMatch =
        selectedCategory === 'All' || Boolean(avatar.categories?.includes(selectedCategory))
      const searchMatch =
        !normalizedSearch || name.toLowerCase().includes(normalizedSearch)
      return categoryMatch && searchMatch
    })
  }, [publicAvatars, search, selectedCategory])

  const handleAddPublicAvatar = async (avatar: AvatarRecord) => {
    const heygenId = avatar.heygen_avatar_id || avatar.id
    if (!heygenId) {
      toast.error('Missing avatar id')
      return
    }

    setAddingId(heygenId)
    try {
      await api.post('/api/avatars/public', {
        heygen_avatar_id: heygenId,
        avatar_name: avatar.avatar_name,
        avatar_url: avatar.avatar_url || avatar.preview_url || avatar.thumbnail_url,
      })
      toast.success('Avatar added to your workspace')
      await loadAvatars()
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to add avatar')
    } finally {
      setAddingId(null)
    }
  }

  return (
    <Layout>
      <div className="mx-auto w-full max-w-7xl space-y-6">
        {/* Hero Banner */}
        <section className="relative overflow-hidden rounded-[32px] border border-white/30 bg-gradient-to-br from-brand-600 via-brand-500 to-indigo-500 p-6 sm:p-8 text-white shadow-[0_60px_120px_-70px_rgba(79,70,229,0.9)]">
          <div className="absolute -left-16 top-1/2 h-56 w-56 -translate-y-1/2 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -right-16 top-8 h-44 w-44 rounded-full bg-cyan-400/30 blur-3xl" />
          <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">{t('common.avatars')}</p>
              <h1 className="text-3xl font-semibold md:text-4xl">{t('common.avatars')} Studio</h1>
              <p className="text-sm text-white/80">{t('avatars.hero_desc') || 'Choose a digital avatar for your videos. Browse hundreds of realistic AI avatars, add your favourites to your workspace and use them in every video you generate.'}</p>
            </div>
            <Button
              disabled
              aria-disabled="true"
              title="Create New Avatar is coming soon"
              className="w-full cursor-not-allowed border border-white/30 bg-white/10 text-white/60 shadow-none hover:bg-white/10 disabled:pointer-events-none disabled:opacity-70 sm:w-auto"
            >
              <Lock className="mr-2 h-4 w-4" />
              {t('avatars.create_coming_soon') || 'Create New Avatar (coming soon)'}
            </Button>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <Card className="p-4 sm:p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-primary">Public Avatar Library</h2>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <div className="relative w-full sm:w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="pl-9"
                    placeholder="Search avatar"
                  />
                </div>
                <select
                  value={selectedCategory}
                  onChange={(event) => setSelectedCategory(event.target.value)}
                  className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-700"
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {loading ? (
              <div className="flex h-52 items-center justify-center text-slate-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading avatars...
              </div>
            ) : filteredPublicAvatars.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                No public avatars found for this filter.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredPublicAvatars.map((avatar) => {
                  const id = avatar.heygen_avatar_id || avatar.id
                  const imageUrl = avatar.thumbnail_url || avatar.preview_url || avatar.avatar_url
                  const alreadyAdded = myAvatarIds.has(id || '')

                  return (
                    <article key={id || avatar.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <div className="aspect-[4/3] bg-slate-100">
                        {imageUrl ? (
                          <img src={imageUrl} alt={avatar.avatar_name || 'Avatar'} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-slate-400">No preview</div>
                        )}
                      </div>
                      <div className="space-y-3 p-3.5">
                        <div>
                          <h3 className="line-clamp-1 text-sm font-semibold text-primary">{avatar.avatar_name || 'Unnamed avatar'}</h3>
                          <p className="mt-1 line-clamp-1 text-xs text-slate-500">{avatar.categories?.join(' · ') || 'General'}</p>
                        </div>
                        <Button
                          onClick={() => void handleAddPublicAvatar(avatar)}
                          disabled={alreadyAdded || addingId === id}
                          variant={alreadyAdded ? 'secondary' : 'primary'}
                          className="w-full"
                        >
                          {addingId === id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : alreadyAdded ? (
                            <Star className="mr-2 h-4 w-4" />
                          ) : (
                            <UserPlus className="mr-2 h-4 w-4" />
                          )}
                          {alreadyAdded ? 'Added to workspace' : 'Add to my avatars'}
                        </Button>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </Card>

          <Card className="p-4 sm:p-5">
            <h2 className="text-lg font-semibold text-primary">My Avatars</h2>
            <p className="mt-1 text-xs text-slate-500">Ready-to-use avatars in your account.</p>
            <div className="mt-4 space-y-2">
              {myAvatars.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  You don&apos;t have avatars yet. Add one from the public list.
                </p>
              ) : (
                myAvatars.slice(0, 12).map((avatar) => (
                  <div key={avatar.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-2.5">
                    <div className="h-11 w-11 overflow-hidden rounded-lg bg-slate-100">
                      {(avatar.thumbnail_url || avatar.preview_url || avatar.avatar_url) ? (
                        <img
                          src={avatar.thumbnail_url || avatar.preview_url || avatar.avatar_url || ''}
                          alt={avatar.avatar_name || 'Avatar'}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-primary">{avatar.avatar_name || 'Unnamed avatar'}</p>
                      <p className="truncate text-xs text-slate-500">{avatar.status || 'active'}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  )
}
