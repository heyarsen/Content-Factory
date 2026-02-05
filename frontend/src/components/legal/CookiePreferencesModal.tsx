import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { ConsentCategories } from '../../lib/consent'
import { useLanguage } from '../../contexts/LanguageContext'

interface CookiePreferencesModalProps {
  isOpen: boolean
  categories: ConsentCategories
  onClose: () => void
  onSave: (categories: ConsentCategories) => void
}

export function CookiePreferencesModal({
  isOpen,
  categories,
  onClose,
  onSave,
}: CookiePreferencesModalProps) {
  const { t } = useLanguage()
  const [localCategories, setLocalCategories] = useState<ConsentCategories>(categories)

  useEffect(() => {
    if (isOpen) {
      setLocalCategories(categories)
    }
  }, [categories, isOpen])

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('legal.cookies.manage_title')} size="md">
      <div className="space-y-6">
        <p className="text-sm text-slate-500">{t('legal.cookies.manage_desc')}</p>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={localCategories.necessary}
                readOnly
                className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-500"
              />
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  {t('legal.cookies.necessary_title')}
                </p>
                <p className="text-xs text-slate-500">{t('legal.cookies.necessary_desc')}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={localCategories.analytics}
                onChange={(e) => setLocalCategories({ ...localCategories, analytics: e.target.checked })}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
              />
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  {t('legal.cookies.analytics_title')}
                </p>
                <p className="text-xs text-slate-500">{t('legal.cookies.analytics_desc')}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={localCategories.marketing}
                onChange={(e) => setLocalCategories({ ...localCategories, marketing: e.target.checked })}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
              />
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  {t('legal.cookies.marketing_title')}
                </p>
                <p className="text-xs text-slate-500">{t('legal.cookies.marketing_desc')}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={() => {
              onSave(localCategories)
              onClose()
            }}
          >
            {t('legal.cookies.save_preferences')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
