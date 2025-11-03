import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { Select } from '../components/ui/Select'
import api from '../lib/api'
import { Video } from 'lucide-react'

export function GenerateVideo() {
  const navigate = useNavigate()
  const [topic, setTopic] = useState('')
  const [script, setScript] = useState('')
  const [style, setStyle] = useState<'casual' | 'professional' | 'energetic' | 'educational'>('professional')
  const [duration, setDuration] = useState(60)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await api.post('/api/videos/generate', {
        topic,
        script: script || undefined,
        style,
        duration,
      })
      navigate('/videos')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to generate video')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-primary">Generate Video</h1>
          <p className="text-sm text-gray-600 mt-2">Create AI-powered video content</p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                {error}
              </div>
            )}

            <Input
              label="Video Topic"
              placeholder="e.g., Product launch announcement"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              required
            />

            <Textarea
              label="Script (Optional)"
              placeholder="Enter a detailed script if you have one..."
              rows={6}
              value={script}
              onChange={(e) => setScript(e.target.value)}
            />

            <Select
              label="Style"
              options={[
                { value: 'casual', label: 'Casual' },
                { value: 'professional', label: 'Professional' },
                { value: 'energetic', label: 'Energetic' },
                { value: 'educational', label: 'Educational' },
              ]}
              value={style}
              onChange={(e) => setStyle(e.target.value as any)}
            />

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Duration: {duration} seconds
              </label>
              <input
                type="range"
                min="15"
                max="180"
                step="15"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>15s</span>
                <span>180s</span>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate('/videos')}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" loading={loading}>
                <Video className="w-4 h-4 mr-2" />
                Generate Video
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </Layout>
  )
}

