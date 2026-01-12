import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Sparkles } from 'lucide-react'

export function Avatars() {
    return (
        <Layout>
            <div className="flex h-[60vh] flex-col items-center justify-center">
                <Card className="flex w-full max-w-md flex-col items-center p-8 text-center shadow-xl">
                    <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                        <Sparkles className="h-10 w-10" />
                    </div>
                    <h1 className="mb-3 text-2xl font-bold text-slate-800">Avatars Coming Soon</h1>
                    <p className="text-slate-500">
                        We are currently building the custom AI Avatars feature. Check back soon for updates!
                    </p>
                </Card>
            </div>
        </Layout>
    )
}
