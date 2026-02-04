import { createContext, ReactNode, useCallback, useContext, useState } from 'react'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { useNavigate } from 'react-router-dom'
import { installBillingGateInterceptor, setBillingGateHandler } from '../lib/apiBillingGate'
import { useLanguage } from './LanguageContext'

type BillingGateState = {
  isOpen: boolean
  title: string
  message: string
  needsSubscription: boolean
}

interface BillingGateContextValue {
  openForError: (error: any) => void
  close: () => void
}

const BillingGateContext = createContext<BillingGateContextValue | undefined>(undefined)

export function BillingGateProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const [state, setState] = useState<BillingGateState>({
    isOpen: false,
    title: t('billing_gate.action_required'),
    message: '',
    needsSubscription: false,
  })

  const close = useCallback(() => {
    setState((s) => ({ ...s, isOpen: false }))
  }, [])

  const openForError = useCallback((error: any) => {
    const message =
      error?.response?.data?.error ||
      error?.message ||
      t('billing_gate.need_subscription_credits')

    const msg = typeof message === 'string' ? message : String(message ?? '')
    const needsSubscription = msg.toLowerCase().includes('subscription')

    setState({
      isOpen: true,
      title: needsSubscription ? t('billing_gate.subscription_required') : t('billing_gate.not_enough_credits'),
      message: msg,
      needsSubscription,
    })
  }, [])

  // Install global axios interceptor once and point it at this provider
  // (safe to call multiple times; function guards internally)
  installBillingGateInterceptor()
  setBillingGateHandler(openForError)

  return (
    <BillingGateContext.Provider value={{ openForError, close }}>
      {children}
      <Modal isOpen={state.isOpen} onClose={close} title={state.title} size="md">
        <div className="space-y-4">
          <p className="text-sm text-slate-700">{state.message}</p>
          <p className="text-xs text-slate-500">
            {t('billing_gate.contact_support')}{' '}
            <a className="text-brand-600 hover:underline" href="mailto:support@ai-smm.co">
              support@ai-smm.co
            </a>
            .
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              onClick={() => {
                close()
                navigate('/credits')
              }}
            >
              {state.needsSubscription ? t('billing_gate.buy_subscription') : t('billing_gate.top_up_credits')}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                close()
                navigate('/credits')
              }}
            >
              {t('billing_gate.manage_billing')}
            </Button>
          </div>
        </div>
      </Modal>
    </BillingGateContext.Provider>
  )
}

export function useBillingGate() {
  const ctx = useContext(BillingGateContext)
  if (!ctx) throw new Error('useBillingGate must be used within a BillingGateProvider')
  return ctx
}

