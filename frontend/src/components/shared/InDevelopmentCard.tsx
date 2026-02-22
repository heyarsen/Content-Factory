import { Sparkles } from 'lucide-react'
import { Card } from '../ui/Card'

interface InDevelopmentCardProps {
  title: string
  description: string
}

export function InDevelopmentCard({ title, description }: InDevelopmentCardProps) {
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center">
      <Card className="flex w-full max-w-md flex-col items-center p-8 text-center shadow-xl">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <Sparkles className="h-10 w-10" />
        </div>
        <h1 className="mb-3 text-2xl font-bold text-slate-800">{title}</h1>
        <p className="text-slate-500">{description}</p>
      </Card>
    </div>
  )
}
