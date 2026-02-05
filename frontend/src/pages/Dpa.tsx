import { LegalDocument } from '../components/legal/LegalDocument'
import { LegalPageLayout } from '../components/layout/LegalPageLayout'
import { complianceContent } from '../content/complianceContent'
import { useLanguage } from '../contexts/LanguageContext'

export function Dpa() {
  const { language, t } = useLanguage()
  const document = complianceContent[language].dpa

  return (
    <LegalPageLayout title={t('legal.titles.dpa')}>
      <LegalDocument document={document} />
    </LegalPageLayout>
  )
}
