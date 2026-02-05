import { LegalDocument } from '../components/legal/LegalDocument'
import { LegalPageLayout } from '../components/layout/LegalPageLayout'
import { legalContent } from '../content/legalContent'
import { useLanguage } from '../contexts/LanguageContext'

export function PublicOffer() {
  const { language, t } = useLanguage()
  const document = legalContent[language].publicOffer

  return (
    <LegalPageLayout title={t('legal.titles.public_offer')}>
      <LegalDocument document={document} />
    </LegalPageLayout>
  )
}
