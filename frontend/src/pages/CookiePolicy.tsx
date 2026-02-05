import { LegalDocument } from '../components/legal/LegalDocument'
import { LegalPageLayout } from '../components/layout/LegalPageLayout'
import { complianceContent } from '../content/complianceContent'
import { useLanguage } from '../contexts/LanguageContext'

export function CookiePolicy() {
  const { language, t } = useLanguage()
  const document = complianceContent[language].cookiePolicy

  return (
    <LegalPageLayout title={t('legal.titles.cookie_policy')}>
      <LegalDocument document={document} />
    </LegalPageLayout>
  )
}
