import { BarChart3, TrendingUp, Users } from 'lucide-react'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'

export function Analysts() {
  return (
    <Layout>
      <div className="space-y-8">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Insights</p>
          <h1 className="text-3xl font-semibold text-primary">Analysts</h1>
          <p className="text-sm text-slate-500">Performance insights without the dashboard layout.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="flex items-center gap-3 p-5">
            <BarChart3 className="h-5 w-5 text-brand-600" />
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Total Views</p>
              <p className="text-xl font-semibold text-primary">—</p>
            </div>
          </Card>
          <Card className="flex items-center gap-3 p-5">
            <TrendingUp className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Engagement Rate</p>
              <p className="text-xl font-semibold text-primary">—</p>
            </div>
          </Card>
          <Card className="flex items-center gap-3 p-5">
            <Users className="h-5 w-5 text-indigo-600" />
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Audience Growth</p>
              <p className="text-xl font-semibold text-primary">—</p>
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  )
}
