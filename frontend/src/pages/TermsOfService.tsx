import { LegalDocument } from '../components/legal/LegalDocument'
import { LegalPageLayout } from '../components/layout/LegalPageLayout'
import { complianceContent } from '../content/complianceContent'
import { useLanguage } from '../contexts/LanguageContext'

export function TermsOfService() {
  const { language, t } = useLanguage()
  const document = complianceContent[language].terms

  return (
    <LegalPageLayout title={t('legal.titles.terms')}>
      <LegalDocument document={document} />
    </LegalPageLayout>
  )
}
