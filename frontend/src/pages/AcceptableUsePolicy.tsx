import { LegalDocument } from '../components/legal/LegalDocument'
import { LegalPageLayout } from '../components/layout/LegalPageLayout'
import { complianceContent } from '../content/complianceContent'
import { useLanguage } from '../contexts/LanguageContext'

export function AcceptableUsePolicy() {
  const { language, t } = useLanguage()
  const document = complianceContent[language].acceptableUse

  return (
    <LegalPageLayout title={t('legal.titles.acceptable_use')}>
      <LegalDocument document={document} />
    </LegalPageLayout>
  )
}
