/**
 * Retry utility for Supabase operations that may timeout
 */
export async function retrySupabaseOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000,
  operationName: string = 'Supabase operation'
): Promise<T> {
  let lastError: any
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error: any) {
      lastError = error
      
      // Check if it's a connection timeout error
      const isTimeoutError = 
        error?.cause?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
        error?.message?.includes('timeout') ||
        error?.message?.includes('fetch failed') ||
        error?.message?.includes('Connect Timeout')
      
      if (isTimeoutError && attempt < maxRetries - 1) {
        const waitTime = delay * Math.pow(2, attempt) // Exponential backoff
        console.log(`[Retry] ${operationName} - connection timeout, retrying in ${waitTime}ms (attempt ${attempt + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
        continue
      }
      
      // For non-timeout errors or last attempt, throw immediately
      throw error
    }
  }
  
  throw lastError || new Error(`Max retries exceeded for ${operationName}`)
}

