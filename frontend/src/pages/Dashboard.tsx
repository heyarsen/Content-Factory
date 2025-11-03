import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Skeleton } from '../components/ui/Skeleton'
import { Badge } from '../components/ui/Badge'
import { Video, Plus, Calendar, Users } from 'lucide-react'
import api from '../lib/api'

interface VideoStats {
  total: number
  completed: number
  generating: number
  failed: number
}

interface PostStats {
  pending: number
  posted: number
}

export function Dashboard() {
  const [videoStats, setVideoStats] = useState<VideoStats | null>(null)
  const [postStats, setPostStats] = useState<PostStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      const [videosRes, postsRes] = await Promise.all([
        api.get('/api/videos'),
        api.get('/api/posts'),
      ])

      const videos = videosRes.data.videos || []
      const posts = postsRes.data.posts || []

      setVideoStats({
        total: videos.length,
        completed: videos.filter((v: any) => v.status === 'completed').length,
        generating: videos.filter((v: any) => v.status === 'generating').length,
        failed: videos.filter((v: any) => v.status === 'failed').length,
      })

      setPostStats({
        pending: posts.filter((p: any) => p.status === 'pending').length,
        posted: posts.filter((p: any) => p.status === 'posted').length,
      })
    } catch (error) {
      console.error('Failed to load stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">Dashboard</h1>
          <Link to="/generate">
            <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
              <Plus className="w-4 h-4" />
              Generate Video
            </button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Videos</p>
                <p className="text-2xl font-bold text-primary mt-1">{videoStats?.total || 0}</p>
              </div>
              <Video className="w-8 h-8 text-purple-600" />
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-success mt-1">{videoStats?.completed || 0}</p>
              </div>
              <Badge variant="success">Active</Badge>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Generating</p>
                <p className="text-2xl font-bold text-primary mt-1">{videoStats?.generating || 0}</p>
              </div>
              <Badge variant="info">In Progress</Badge>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Scheduled Posts</p>
                <p className="text-2xl font-bold text-primary mt-1">{postStats?.pending || 0}</p>
              </div>
              <Calendar className="w-8 h-8 text-purple-600" />
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h2 className="text-lg font-bold text-primary mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <Link
                to="/generate"
                className="block p-4 border border-gray-200 rounded-lg hover:border-purple-600 hover:bg-purple-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Plus className="w-5 h-5 text-purple-600" />
                  <div>
                    <p className="font-semibold text-sm">Generate New Video</p>
                    <p className="text-xs text-gray-600">Create AI-powered video content</p>
                  </div>
                </div>
              </Link>
              <Link
                to="/social"
                className="block p-4 border border-gray-200 rounded-lg hover:border-purple-600 hover:bg-purple-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-purple-600" />
                  <div>
                    <p className="font-semibold text-sm">Connect Social Accounts</p>
                    <p className="text-xs text-gray-600">Link your social media profiles</p>
                  </div>
                </div>
              </Link>
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-bold text-primary mb-4">Recent Activity</h2>
            <p className="text-sm text-gray-600">No recent activity</p>
          </Card>
        </div>
      </div>
    </Layout>
  )
}

