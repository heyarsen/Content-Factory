import { useState, useEffect } from 'react'
import api from '../lib/api'

export function useCredits() {
  const [credits, setCredits] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchCredits = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/credits')
      setCredits(response.data.credits ?? 0)
    } catch (error) {
      console.error('Failed to fetch credits:', error)
      setCredits(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCredits()
    
    // Refresh credits every 30 seconds
    const interval = setInterval(fetchCredits, 30000)
    return () => clearInterval(interval)
  }, [])

  return { credits, loading, refreshCredits: fetchCredits }
}

