import api from './api'
import type { AxiosError } from 'axios'

let billingGateHandler: ((error: any) => void) | null = null

export function setBillingGateHandler(handler: (error: any) => void) {
  billingGateHandler = handler
}

let installed = false

export function installBillingGateInterceptor() {
  if (installed) return
  installed = true

  api.interceptors.response.use(
    (response) => response,
    (error: AxiosError<any>) => {
      const status = (error as any)?.response?.status
      if (status === 402 && billingGateHandler) {
        billingGateHandler(error)
      }
      return Promise.reject(error)
    }
  )
}


