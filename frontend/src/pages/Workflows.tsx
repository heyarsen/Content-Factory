import { useEffect, useState } from 'react'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Skeleton } from '../components/ui/Skeleton'
import api from '../lib/api'
import { 
  Sparkles, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Play,
  Clock,
  Search,
  Zap,
  AlertCircle
} from 'lucide-react'
import { useToast } from '../hooks/useToast'

type TabKey = 'content' | 'reels' | 'generate'

interface ContentItem {
  id: string
  topic: string
  category: 'Trading' | 'Lifestyle' | 'Fin. Freedom'
  research: Record<string, any> | null
  done: boolean
  status: string | null
  created_at: string
  updated_at: string
}

interface Reel {
  id: string
  content_item_id: string | null
  topic: string
  category: 'Trading' | 'Lifestyle' | 'Fin. Freedom'
  description: string | null
  why_it_matters: string | null
  useful_tips: string | null
  script: string | null
  status: 'pending' | 'approved' | 'rejected'
  scheduled_time: string | null
  video_url: string | null
  heygen_video_id: string | null
  created_at: string
  updated_at: string
}

function SectionTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl px-4 py-2 text-sm font-medium transition focus:outline-none ${
        active
          ? 'bg-gradient-to-r from-brand-500/10 via-brand-500/5 to-transparent text-brand-600 shadow-[0_12px_40px_-25px_rgba(99,102,241,0.9)]'
          : 'text-slate-500 hover:bg-white hover:text-primary'
      }`}
    >
      {label}
    </button>
  )
}

export function Workflows() {
  const [activeTab, setActiveTab] = useState<TabKey>('content')
  const [loading, setLoading] = useState(false)
  const [contentItems, setContentItems] = useState<ContentItem[]>([])
  const [reels, setReels] = useState<Reel[]>([])
  const [generating, setGenerating] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (activeTab === 'content') {
      loadContentItems()
    } else if (activeTab === 'reels') {
      loadReels()
    }
  }, [activeTab])

  const loadContentItems = async () => {
    setLoading(true)
    try {
      // We'll need to add this endpoint to get all content items
      // For now, we'll use a placeholder
      const response = await api.get('/api/content/items')
      setContentItems(response.data.items || [])
    } catch (error: any) {
      console.error('Failed to load content items:', error)
      // If endpoint doesn't exist yet, show empty state
      setContentItems([])
    } finally {
      setLoading(false)
    }
  }

  const loadReels = async () => {
    setLoading(true)
    try {
      // Get all reels, not just pending
      const response = await api.get('/api/reels')
      setReels(response.data.reels || [])
    } catch (error: any) {
      // Fallback to pending endpoint if all endpoint doesn't exist
      try {
        const response = await api.get('/api/reels/pending')
        setReels(response.data.reels || [])
      } catch (fallbackError: any) {
        console.error('Failed to load reels:', fallbackError)
        toast.error('Failed to load reels')
        setReels([])
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateTopics = async () => {
    setGenerating('topics')
    try {
      const response = await api.post('/api/content/generate-topics')
      toast.success(`Generated ${response.data.topics?.length || 0} topics`)
      await loadContentItems()
    } catch (error: any) {
      console.error('Failed to generate topics:', error)
      toast.error(error.response?.data?.error || 'Failed to generate topics')
    } finally {
      setGenerating(null)
    }
  }

  const handleResearch = async (contentItemId: string, topic: string, category: string) => {
    setGenerating(contentItemId)
    try {
      await api.post('/api/content/research', {
        topic,
        category,
        content_item_id: contentItemId,
      })
      toast.success('Research completed')
      await loadContentItems()
    } catch (error: any) {
      console.error('Failed to research topic:', error)
      toast.error(error.response?.data?.error || 'Failed to research topic')
    } finally {
      setGenerating(null)
    }
  }

  const handleGenerateScript = async (contentItemId: string) => {
    setGenerating(contentItemId)
    try {
      await api.post('/api/content/generate-script', {
        content_item_id: contentItemId,
      })
      toast.success('Script generated and reel created')
      await loadContentItems()
      await loadReels()
      setActiveTab('reels')
    } catch (error: any) {
      console.error('Failed to generate script:', error)
      toast.error(error.response?.data?.error || 'Failed to generate script')
    } finally {
      setGenerating(null)
    }
  }

  const handleApproveReel = async (reelId: string) => {
    try {
      await api.post(`/api/reels/${reelId}/approve`)
      toast.success('Reel approved. Video generation started.')
      await loadReels()
    } catch (error: any) {
      console.error('Failed to approve reel:', error)
      toast.error(error.response?.data?.error || 'Failed to approve reel')
    }
  }

  const handleRejectReel = async (reelId: string) => {
    try {
      await api.post(`/api/reels/${reelId}/reject`)
      toast.success('Reel rejected')
      await loadReels()
    } catch (error: any) {
      console.error('Failed to reject reel:', error)
      toast.error(error.response?.data?.error || 'Failed to reject reel')
    }
  }

  const handleGenerateVideo = async (reelId: string) => {
    setGenerating(reelId)
    try {
      await api.post(`/api/reels/${reelId}/generate-video`)
      toast.success('Video generation started')
      await loadReels()
    } catch (error: any) {
      console.error('Failed to generate video:', error)
      toast.error(error.response?.data?.error || 'Failed to generate video')
    } finally {
      setGenerating(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'success' | 'info' | 'default' | 'warning'> = {
      approved: 'success',
      pending: 'info',
      rejected: 'default',
      done: 'success',
    }
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>
  }

  const renderContentItems = () => {
    if (loading) {
      return (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-3xl" />
          ))}
        </div>
      )
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-primary">Content Items</h2>
            <p className="text-sm text-slate-500">Topics waiting for research and script generation</p>
          </div>
          <Button
            onClick={handleGenerateTopics}
            loading={generating === 'topics'}
            leftIcon={<Sparkles className="h-4 w-4" />}
          >
            Generate Topics
          </Button>
        </div>

        {contentItems.length === 0 ? (
          <Card className="text-center py-12">
            <Search className="mx-auto h-12 w-12 text-slate-300 mb-4" />
            <p className="text-slate-500">No content items yet</p>
            <p className="text-sm text-slate-400 mt-2">Click "Generate Topics" to create new content ideas</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {contentItems.map((item) => (
              <Card key={item.id} className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-primary">{item.topic}</h3>
                      <Badge variant="default">{item.category}</Badge>
                      {item.done && <Badge variant="success">Done</Badge>}
                      {!item.research && <Badge variant="warning">No Research</Badge>}
                    </div>
                    {item.research && (
                      <div className="text-sm text-slate-600 space-y-1">
                        <p><strong>Description:</strong> {item.research.Description?.substring(0, 100)}...</p>
                        <p><strong>Why it matters:</strong> {item.research.WhyItMatters?.substring(0, 100)}...</p>
                      </div>
                    )}
                    <p className="text-xs text-slate-400">Created: {formatDate(item.created_at)}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {!item.research && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleResearch(item.id, item.topic, item.category)}
                        loading={generating === item.id}
                        leftIcon={<Search className="h-4 w-4" />}
                      >
                        Research
                      </Button>
                    )}
                    {item.research && !item.done && (
                      <Button
                        size="sm"
                        onClick={() => handleGenerateScript(item.id)}
                        loading={generating === item.id}
                        leftIcon={<FileText className="h-4 w-4" />}
                      >
                        Generate Script
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    )
  }

  const renderReels = () => {
    if (loading) {
      return (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 rounded-3xl" />
          ))}
        </div>
      )
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-primary">Reels</h2>
            <p className="text-sm text-slate-500">Scripts waiting for approval and video generation</p>
          </div>
          <Button
            variant="ghost"
            onClick={loadReels}
            leftIcon={<RefreshCw className="h-4 w-4" />}
          >
            Refresh
          </Button>
        </div>

        {reels.length === 0 ? (
          <Card className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-slate-300 mb-4" />
            <p className="text-slate-500">No reels pending approval</p>
            <p className="text-sm text-slate-400 mt-2">Generate scripts from content items to create reels</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {reels.map((reel) => (
              <Card key={reel.id} className="p-6">
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-primary">{reel.topic}</h3>
                        <Badge variant="default">{reel.category}</Badge>
                        {getStatusBadge(reel.status)}
                        {reel.scheduled_time && (
                          <div className="flex items-center gap-1 text-xs text-slate-400">
                            <Clock className="h-3 w-3" />
                            Auto-approve: {formatDate(reel.scheduled_time)}
                          </div>
                        )}
                      </div>
                      {reel.script && (
                        <div className="mt-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                          <p className="text-sm text-slate-700 whitespace-pre-wrap">{reel.script}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {reel.description && (
                    <div className="text-sm text-slate-600">
                      <p><strong>Description:</strong> {reel.description}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-2 border-t border-slate-200">
                    {reel.status === 'pending' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleApproveReel(reel.id)}
                          leftIcon={<CheckCircle2 className="h-4 w-4" />}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRejectReel(reel.id)}
                          leftIcon={<XCircle className="h-4 w-4" />}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                    {reel.status === 'approved' && !reel.video_url && (
                      <Button
                        size="sm"
                        onClick={() => handleGenerateVideo(reel.id)}
                        loading={generating === reel.id}
                        leftIcon={<Play className="h-4 w-4" />}
                      >
                        Generate Video
                      </Button>
                    )}
                    {reel.video_url && (
                      <Badge variant="success">
                        <CheckCircle2 className="h-3 w-3" />
                        Video Ready
                      </Badge>
                    )}
                    {reel.video_url && (
                      <a
                        href={reel.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-brand-600 hover:underline"
                      >
                        View Video
                      </a>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    )
  }

  const renderGenerate = () => {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-primary">Workflow Automation</h2>
          <p className="text-sm text-slate-500 mt-2">Automated workflows run in the background</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Zap className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-primary">Auto-Approval</h3>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Reels with pending status are automatically approved after 20 minutes and videos are generated.
            </p>
            <Badge variant="info">Runs every 5 minutes</Badge>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <RefreshCw className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-primary">Script Generation</h3>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Content items with research are automatically processed to generate scripts every 10 minutes.
            </p>
            <Badge variant="info">Runs every 10 minutes</Badge>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                <Search className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-primary">Research</h3>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Content items without research are automatically researched every 15 minutes.
            </p>
            <Badge variant="info">Runs every 15 minutes</Badge>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                <Play className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-primary">Video Generation</h3>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Approved reels without videos are automatically processed for video generation every 5 minutes.
            </p>
            <Badge variant="info">Runs every 5 minutes</Badge>
          </Card>
        </div>

        <Card className="p-6 border-amber-200 bg-amber-50/50">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-amber-900 mb-1">Workflow Status</h4>
              <p className="text-sm text-amber-700">
                All automated workflows are running in the background. You can manually trigger actions above, 
                but the system will also process items automatically according to the schedule.
              </p>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <Layout>
      <div className="space-y-10">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Internal Tools</p>
          <h1 className="text-3xl font-semibold text-primary">Workflow Admin</h1>
          <p className="max-w-3xl text-sm text-slate-500">
            Internal workflow controls for maintenance and debugging.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 rounded-3xl border border-white/60 bg-white/70 p-2 shadow-inner">
          <SectionTab label="Content Items" active={activeTab === 'content'} onClick={() => setActiveTab('content')} />
          <SectionTab label="Reels" active={activeTab === 'reels'} onClick={() => setActiveTab('reels')} />
          <SectionTab label="Automation" active={activeTab === 'generate'} onClick={() => setActiveTab('generate')} />
        </div>

        {activeTab === 'content' && renderContentItems()}
        {activeTab === 'reels' && renderReels()}
        {activeTab === 'generate' && renderGenerate()}
      </div>
    </Layout>
  )
}

