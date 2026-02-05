import { LegalDocument } from '../components/legal/LegalDocument'
import { LegalPageLayout } from '../components/layout/LegalPageLayout'
import { complianceContent } from '../content/complianceContent'
import { useLanguage } from '../contexts/LanguageContext'

export function PrivacyPolicy() {
  const { language, t } = useLanguage()
  const document = complianceContent[language].privacyPolicy

  return (
    <LegalPageLayout title={t('legal.titles.privacy_policy')}>
      <LegalDocument document={document} />
    </LegalPageLayout>
  )
}
