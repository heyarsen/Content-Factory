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
  transactionType: string
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
  apiVersion?: number
}

export interface WayForPayPurchaseResponse {
  reasonCode: number
  reason: string
  invoiceUrl?: string
  qrCode?: string
  orderReference?: string
}

export interface WayForPayHostedPaymentForm {
  paymentUrl: string
  fields: Record<string, string>
}

export interface WayForPayStatusRequest {
  transactionType: string
  merchantAccount: string
  orderReference: string
  merchantSignature: string
  apiVersion?: number
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
      transactionType: 'PURCHASE',
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
      apiVersion: 1,
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
      // WayForPay expects the request body to include apiVersion at the top level
      const requestBody: any = {
        transactionType: purchaseRequest.transactionType,
        merchantAccount: purchaseRequest.merchantAccount,
        merchantDomainName: purchaseRequest.merchantDomainName,
        orderReference: purchaseRequest.orderReference,
        orderDate: purchaseRequest.orderDate,
        amount: purchaseRequest.amount,
        currency: purchaseRequest.currency,
        productName: purchaseRequest.productName,
        productCount: purchaseRequest.productCount,
        productPrice: purchaseRequest.productPrice,
        merchantSignature,
        apiVersion: 1,
      }
      
      // Add optional fields if they exist
      if (purchaseRequest.clientAccountId) requestBody.clientAccountId = purchaseRequest.clientAccountId
      if (purchaseRequest.clientEmail) requestBody.clientEmail = purchaseRequest.clientEmail
      if (purchaseRequest.clientFirstName) requestBody.clientFirstName = purchaseRequest.clientFirstName
      if (purchaseRequest.clientLastName) requestBody.clientLastName = purchaseRequest.clientLastName
      if (purchaseRequest.clientPhone) requestBody.clientPhone = purchaseRequest.clientPhone
      if (purchaseRequest.returnUrl) requestBody.returnUrl = purchaseRequest.returnUrl
      if (purchaseRequest.serviceUrl) requestBody.serviceUrl = purchaseRequest.serviceUrl
      if (purchaseRequest.language) requestBody.language = purchaseRequest.language

      console.log('[WayForPay] Purchase request:', {
        merchantAccount: config.merchantAccount,
        orderReference: request.orderReference,
        amount: request.amount,
        hasApiVersion: !!requestBody.apiVersion,
      })

      // WayForPay API endpoint format: /api/purchase (or /api/v1/purchase for versioned API)
      const apiEndpoint = `${config.apiUrl}/purchase`
      
      const response = await axios.post<WayForPayPurchaseResponse>(
        apiEndpoint,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        }
      )

      console.log('[WayForPay] Purchase response:', {
        reasonCode: response.data.reasonCode,
        reason: response.data.reason,
        hasInvoiceUrl: !!response.data.invoiceUrl,
      })

      return response.data
    } catch (error: any) {
      console.error('[WayForPay] Purchase request error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      })
      throw new Error(`WayForPay purchase failed: ${error.response?.data?.reason || error.message}`)
    }
  }

  /**
   * Create hosted payment form payload (WayForPay checkout redirect flow).
   * Frontend should POST these fields to paymentUrl.
   */
  static createHostedPaymentForm(request: {
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
    language?: string
  }): WayForPayHostedPaymentForm {
    const config = this.getConfig()
    const orderDate = Math.floor(Date.now() / 1000)

    // Signature fields for hosted checkout flow
    const signatureFields = [
      config.merchantAccount,
      config.merchantDomainName,
      request.orderReference,
      orderDate.toString(),
      request.amount.toString(),
      request.currency || 'USD',
      request.productName,
      '1',
      request.amount.toString(),
    ]

    const merchantSignature = this.generateSignature(signatureFields)

    // WayForPay hosted payment page expects form fields (POST)
    const fields: Record<string, string> = {
      merchantAccount: config.merchantAccount,
      merchantAuthType: 'SimpleSignature',
      merchantDomainName: config.merchantDomainName,
      orderReference: request.orderReference,
      orderDate: String(orderDate),
      amount: String(request.amount),
      currency: request.currency || 'USD',
      merchantSignature,
      language: request.language || 'EN',
      // arrays in form fields
      'productName[]': request.productName,
      'productCount[]': '1',
      'productPrice[]': String(request.amount),
    }

    if (request.clientAccountId) fields.clientAccountId = request.clientAccountId
    if (request.clientEmail) fields.clientEmail = request.clientEmail
    if (request.clientFirstName) fields.clientFirstName = request.clientFirstName
    if (request.clientLastName) fields.clientLastName = request.clientLastName
    if (request.clientPhone) fields.clientPhone = request.clientPhone
    if (request.returnUrl) fields.returnUrl = request.returnUrl
    if (request.serviceUrl) fields.serviceUrl = request.serviceUrl

    console.log('[WayForPay] Hosted payment form created:', {
      orderReference: request.orderReference,
      amount: request.amount,
      currency: request.currency || 'USD',
      hasReturnUrl: !!request.returnUrl,
      hasServiceUrl: !!request.serviceUrl,
    })

    return {
      paymentUrl: 'https://secure.wayforpay.com/pay',
      fields,
    }
  }

  /**
   * Check payment status
   */
  static async checkStatus(orderReference: string): Promise<WayForPayStatusResponse> {
    const config = this.getConfig()

    const statusRequest: WayForPayStatusRequest = {
      transactionType: 'CHECK_STATUS',
      merchantAccount: config.merchantAccount,
      orderReference,
      merchantSignature: '', // Will be set after creation
      apiVersion: 1,
    }

    // Generate signature
    const signatureFields = [config.merchantAccount, orderReference]
    statusRequest.merchantSignature = this.generateSignature(signatureFields)

    try {
      const response = await axios.post<any>(
        `${config.apiUrl}/status`,
        statusRequest,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )

      const data = response.data as any

      // Log raw response for debugging (WayForPay responses can vary)
      console.log('[WayForPay] Status response:', {
        orderReference,
        reasonCode: data?.reasonCode,
        reason: data?.reason,
        orderStatus: data?.orderStatus,
        transactionStatus: data?.transactionStatus,
        keys: data && typeof data === 'object' ? Object.keys(data) : [],
      })

      return data as WayForPayStatusResponse
    } catch (error: any) {
      console.error('[WayForPay] Status check error:', error.response?.data || error.message)
      throw new Error(`WayForPay status check failed: ${error.response?.data?.reason || error.message}`)
    }
  }

  /**
   * Verify callback signature (for serviceUrl callbacks)
   */
  static verifyCallback(data: any): boolean {
    // If no merchantSignature, skip verification (allow processing)
    if (!data || !data.merchantSignature) {
      console.warn('[WayForPay] No signature in callback data, skipping verification')
      return true // Allow processing even without signature
    }

    const config = this.getConfig()
    
    // Filter out undefined/null values and build signature fields
    const signatureFields: string[] = []
    
    // Standard WayForPay callback signature fields in order
    const fieldNames = [
      'merchantAccount',
      'orderReference', 
      'amount',
      'currency',
      'authCode',
      'cardPan',
      'transactionStatus',
      'reasonCode',
    ]

    for (const field of fieldNames) {
      const value = data[field] || ''
      signatureFields.push(String(value))
    }

    return this.verifySignature(signatureFields, data.merchantSignature)
  }
}

