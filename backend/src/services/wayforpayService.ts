import crypto from 'crypto'
import axios from 'axios'

/**
 * WayForPay Payment Gateway Integration Service
 * Documentation: https://wiki.wayforpay.com/uk
 */

export interface WayForPayConfig {
  merchantAccount: string
  merchantSecretKey: string
  merchantDomainName: string
  apiUrl?: string // Default: https://api.wayforpay.com/api
}

export interface WayForPayPurchaseRequest {
  merchantAccount: string
  merchantDomainName: string
  orderReference: string
  orderDate: number // Unix timestamp
  amount: number
  currency: string
  productName: string[]
  productCount: number[]
  productPrice: number[]
  clientAccountId?: string
  clientEmail?: string
  clientFirstName?: string
  clientLastName?: string
  clientPhone?: string
  returnUrl?: string
  serviceUrl?: string // Callback URL for payment status updates
  language?: string
}

export interface WayForPayPurchaseResponse {
  reasonCode: number
  reason: string
  invoiceUrl?: string
  qrCode?: string
  orderReference?: string
}

export interface WayForPayStatusRequest {
  merchantAccount: string
  orderReference: string
  merchantSignature: string
}

export interface WayForPayStatusResponse {
  reasonCode: number
  reason: string
  orderReference: string
  orderStatus: 'Created' | 'InProcessing' | 'WaitingAuthComplete' | 'Approved' | 'Pending' | 'Expired' | 'Refunded' | 'Declined' | 'RefundInProcessing'
  amount: number
  currency: string
  createdDate: number
  transactionStatus: string
  transactionType: string
}

export class WayForPayService {
  private static config: WayForPayConfig | null = null

  /**
   * Initialize WayForPay configuration
   */
  static initialize(config: WayForPayConfig) {
    this.config = {
      ...config,
      apiUrl: config.apiUrl || 'https://api.wayforpay.com/api',
    }
  }

  /**
   * Get configuration (throws if not initialized)
   */
  private static getConfig(): WayForPayConfig {
    if (!this.config) {
      throw new Error('WayForPay service not initialized. Call WayForPayService.initialize() first.')
    }
    return this.config
  }

  /**
   * Generate merchant signature for request
   * Signature is HMAC-MD5 hash of concatenated values
   */
  private static generateSignature(fields: string[]): string {
    const config = this.getConfig()
    const message = fields.join(';')
    return crypto
      .createHmac('md5', config.merchantSecretKey)
      .update(message)
      .digest('hex')
  }

  /**
   * Verify signature from WayForPay response
   */
  static verifySignature(fields: string[], signature: string): boolean {
    const expectedSignature = this.generateSignature(fields)
    return expectedSignature.toLowerCase() === signature.toLowerCase()
  }

  /**
   * Create purchase request (redirect user to payment page)
   */
  static async createPurchase(request: {
    orderReference: string
    amount: number
    currency?: string
    productName: string
    clientAccountId?: string
    clientEmail?: string
    clientFirstName?: string
    clientLastName?: string
    clientPhone?: string
    returnUrl?: string
    serviceUrl?: string
  }): Promise<WayForPayPurchaseResponse> {
    const config = this.getConfig()
    const orderDate = Math.floor(Date.now() / 1000)

    const purchaseRequest: WayForPayPurchaseRequest = {
      merchantAccount: config.merchantAccount,
      merchantDomainName: config.merchantDomainName,
      orderReference: request.orderReference,
      orderDate,
      amount: request.amount,
      currency: request.currency || 'USD',
      productName: [request.productName],
      productCount: [1],
      productPrice: [request.amount],
      clientAccountId: request.clientAccountId,
      clientEmail: request.clientEmail,
      clientFirstName: request.clientFirstName,
      clientLastName: request.clientLastName,
      clientPhone: request.clientPhone,
      returnUrl: request.returnUrl,
      serviceUrl: request.serviceUrl,
      language: 'EN',
    }

    // Generate signature
    const signatureFields = [
      config.merchantAccount,
      config.merchantDomainName,
      purchaseRequest.orderReference,
      orderDate.toString(),
      purchaseRequest.amount.toString(),
      purchaseRequest.currency,
      purchaseRequest.productName[0],
      purchaseRequest.productCount[0].toString(),
      purchaseRequest.productPrice[0].toString(),
    ]
    const merchantSignature = this.generateSignature(signatureFields)

    try {
      const response = await axios.post<WayForPayPurchaseResponse>(
        `${config.apiUrl}/purchase`,
        {
          ...purchaseRequest,
          merchantSignature,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )

      return response.data
    } catch (error: any) {
      console.error('[WayForPay] Purchase request error:', error.response?.data || error.message)
      throw new Error(`WayForPay purchase failed: ${error.response?.data?.reason || error.message}`)
    }
  }

  /**
   * Check payment status
   */
  static async checkStatus(orderReference: string): Promise<WayForPayStatusResponse> {
    const config = this.getConfig()

    const statusRequest: WayForPayStatusRequest = {
      merchantAccount: config.merchantAccount,
      orderReference,
      merchantSignature: '', // Will be set after creation
    }

    // Generate signature
    const signatureFields = [config.merchantAccount, orderReference]
    statusRequest.merchantSignature = this.generateSignature(signatureFields)

    try {
      const response = await axios.post<WayForPayStatusResponse>(
        `${config.apiUrl}/status`,
        statusRequest,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )

      return response.data
    } catch (error: any) {
      console.error('[WayForPay] Status check error:', error.response?.data || error.message)
      throw new Error(`WayForPay status check failed: ${error.response?.data?.reason || error.message}`)
    }
  }

  /**
   * Verify callback signature (for serviceUrl callbacks)
   */
  static verifyCallback(data: any): boolean {
    const config = this.getConfig()
    const signatureFields = [
      data.merchantAccount || config.merchantAccount,
      data.orderReference,
      data.amount,
      data.currency,
      data.authCode,
      data.cardPan,
      data.transactionStatus,
      data.reasonCode,
    ]
    return this.verifySignature(signatureFields, data.merchantSignature)
  }
}

