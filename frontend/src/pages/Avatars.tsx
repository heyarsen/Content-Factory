import { Layout } from '../components/layout/Layout'
import { useLanguage } from '../contexts/LanguageContext'
import { InDevelopmentCard } from '../components/shared/InDevelopmentCard'

export function Avatars() {
    const { t } = useLanguage()
    return (
        <Layout>
            <InDevelopmentCard
                title={`${t('common.avatars')} In Development`}
                description={t('avatars.description')}
            />
        </Layout>
    )
}
