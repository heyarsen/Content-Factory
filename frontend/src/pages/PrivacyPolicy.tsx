import { LegalDocument } from '../components/legal/LegalDocument'
import { LegalPageLayout } from '../components/layout/LegalPageLayout'
import { legalContent } from '../content/legalContent'
import { useLanguage } from '../contexts/LanguageContext'

export function PrivacyPolicy() {
  const { language, t } = useLanguage()
  const document = legalContent[language].privacyPolicy

  return (
    <LegalPageLayout title={t('legal.titles.privacy_policy')}>
      <LegalDocument document={document} />
    </LegalPageLayout>
  )
}
