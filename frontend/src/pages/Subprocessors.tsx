import { LegalDocument } from '../components/legal/LegalDocument'
import { LegalPageLayout } from '../components/layout/LegalPageLayout'
import { complianceContent } from '../content/complianceContent'
import { useLanguage } from '../contexts/LanguageContext'

export function Subprocessors() {
  const { language, t } = useLanguage()
  const document = complianceContent[language].subprocessors

  return (
    <LegalPageLayout title={t('legal.titles.subprocessors')}>
      <LegalDocument document={document} />
    </LegalPageLayout>
  )
}
