import axios from 'axios'
import {
  type CreateSoraTaskRequest,
  type CreateSoraTaskResponse,
  type SoraAspectRatio,
  type SoraTaskDetail,
} from './soraUtils.js'

const KIE_API_URL = process.env.KIE_API_URL || 'https://api.kie.ai'
const KIE_SUBMIT_PATH = process.env.KIE_SORA_SUBMIT_PATH || '/api/generate/submit'
const KIE_STATUS_PATHS = (process.env.KIE_SORA_STATUS_PATHS || '/api/task/status,/api/generate/status')
  .split(',')
  .map(path => path.trim())
  .filter(Boolean)

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: any

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      lastError = error
      const status = error.response?.status

      if (status === 429 || (status >= 500 && status < 600)) {
        if (attempt < maxRetries - 1) {
          const delay = initialDelay * Math.pow(2, attempt)
          const retryAfter = error.response?.headers?.['retry-after']
          const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : delay

          console.log(
            `[Kie Sora] Rate limit or server error (${status}), retrying in ${waitTime}ms (attempt ${attempt + 1}/${maxRetries})`
          )
          await new Promise(resolve => setTimeout(resolve, waitTime))
          continue
        }
      }

      throw error
    }
  }

  throw lastError || new Error('Max retries exceeded')
}

function getKieApiKey(): string {
  const key = process.env.KIE_API_KEY
  if (!key) {
    throw new Error('Missing KIE_API_KEY environment variable')
  }
  return key
}

function buildAuthHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }
}

function normalizeCreateResponse(payload: any): CreateSoraTaskResponse {
  if (payload?.data?.task_id) {
    return {
      code: payload.code ?? 200,
      data: {
        task_id: payload.data.task_id,
        status: payload.data.status || 'not_started',
        created_time: payload.data.created_time || new Date().toISOString(),
      },
      message: payload.message,
    }
  }

  if (payload?.task_id) {
    return {
      code: payload.code ?? 200,
      data: {
        task_id: payload.task_id,
        status: payload.status || 'not_started',
        created_time: payload.created_time || new Date().toISOString(),
      },
      message: payload.message,
    }
  }

  return payload as CreateSoraTaskResponse
}

function normalizeTaskDetail(payload: any): SoraTaskDetail {
  if (payload?.data?.task_id) {
    return payload as SoraTaskDetail
  }

  if (payload?.task_id) {
    return {
      code: payload.code ?? 200,
      data: {
        task_id: payload.task_id,
        status: payload.status || 'not_started',
        created_time: payload.created_time,
        output: payload.output,
        result: payload.result,
        video_url: payload.video_url,
        video_urls: payload.video_urls,
        error: payload.error,
      },
      error: payload.error,
      message: payload.message,
    }
  }

  return payload as SoraTaskDetail
}

export async function createSoraTask(
  prompt: string,
  aspectRatio: SoraAspectRatio = '9:16',
  options: {
    duration?: 10 | 15
    callbackUrl?: string
    imageUrls?: string[]
    style?: CreateSoraTaskRequest['input']['style']
    storyboard?: boolean
    model?: CreateSoraTaskRequest['model']
  } = {}
): Promise<CreateSoraTaskResponse> {
  const apiKey = getKieApiKey()

  const createPayload = (model: CreateSoraTaskRequest['model']): CreateSoraTaskRequest => ({
    model,
    callback_url: options.callbackUrl,
    input: {
      prompt,
      duration: options.duration || 10,
      aspect_ratio: aspectRatio,
      ...(options.imageUrls && options.imageUrls.length > 0 ? { image_urls: options.imageUrls } : {}),
      ...(options.style ? { style: options.style } : {}),
      ...(typeof options.storyboard === 'boolean' ? { storyboard: options.storyboard } : {}),
    },
  })

  const attemptCreate = async (model: CreateSoraTaskRequest['model']): Promise<CreateSoraTaskResponse> => {
    const payload = createPayload(model)

    console.log('[Kie Sora] Creating task with payload:', {
      prompt: prompt.substring(0, 100) + '...',
      aspect_ratio: aspectRatio,
      duration: payload.input.duration,
      model: payload.model,
    })

    const response = await retryWithBackoff(
      async () => {
        return await axios.post<CreateSoraTaskResponse>(`${KIE_API_URL}${KIE_SUBMIT_PATH}`, payload, {
          headers: buildAuthHeaders(apiKey),
          timeout: 30000,
        })
      },
      3,
      1000
    )

    const normalized = normalizeCreateResponse(response.data)

    if (normalized.code !== 200) {
      throw new Error(`Kie API error: ${normalized.message || 'Unexpected response'}`)
    }

    console.log('[Kie Sora] Task created successfully:', normalized.data.task_id)
    return normalized
  }

  let lastError: any

  if (options.model && options.model !== 'sora-2') {
    console.warn(
      `[Kie Sora] Overriding requested model "${options.model}" to follow Sora retry policy.`
    )
  }

  const modelAttempts: CreateSoraTaskRequest['model'][] = [
    'sora-2',
    'sora-2',
    'sora-2-stable',
    'sora-2-stable',
  ]

  for (let attemptIndex = 0; attemptIndex < modelAttempts.length; attemptIndex++) {
    const model = modelAttempts[attemptIndex]
    const attemptNumber = attemptIndex + 1
    const attemptLabel = `${attemptNumber}/${modelAttempts.length}`

    try {
      return await attemptCreate(model)
    } catch (error: any) {
      lastError = error
      console.error(
        `[Kie Sora] Failed to create task with ${model} (attempt ${attemptLabel}):`,
        error
      )
    }
  }

  console.error('[Kie Sora] Failed to create task:', lastError)

  let errorMessage = 'Failed to create Sora 2 video generation task'

  if (lastError?.response) {
    const status = lastError.response.status
    const data = lastError.response.data

    if (status === 401) {
      errorMessage = 'Kie API authentication failed. Please check your KIE_API_KEY environment variable.'
    } else if (status === 402) {
      errorMessage = 'Insufficient credits in your Kie account.'
    } else if (status === 422) {
      errorMessage = `Invalid request parameters: ${data?.error?.message || data?.message || 'Validation error'}`
    } else if (status === 429) {
      errorMessage = 'Kie API rate limit exceeded. Please try again later.'
    } else if (status >= 500) {
      errorMessage = 'Kie API server error. Please try again later.'
    } else if (data?.error?.message || data?.message) {
      errorMessage = `Kie API error: ${data.error?.message || data.message}`
    }
  } else if (lastError?.code === 'ECONNABORTED') {
    errorMessage = 'Request timeout while connecting to Kie API.'
  } else if (lastError?.message) {
    errorMessage = lastError.message
  }

  const enhancedError = new Error(errorMessage)
  ;(enhancedError as any).status = lastError?.response?.status || 500
  throw enhancedError
}

export async function getTaskDetails(taskId: string): Promise<SoraTaskDetail> {
  const apiKey = getKieApiKey()

  const maxAttempts = 3
  const baseDelayMs = 1000
  const statusEndpoints: Array<{
    method: 'get' | 'post'
    path: string
    buildConfig: () => { params?: Record<string, string>; data?: Record<string, string> }
  }> = KIE_STATUS_PATHS.flatMap(path => [
    {
      method: 'get',
      path,
      buildConfig: () => ({ params: { task_id: taskId } }),
    },
    {
      method: 'post',
      path,
      buildConfig: () => ({ data: { task_id: taskId } }),
    },
  ])

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      let response: { data: SoraTaskDetail } | null = null
      let lastNotFoundError: any = null

      for (const endpoint of statusEndpoints) {
        try {
          const config = endpoint.buildConfig()
          if (endpoint.method === 'get') {
            response = await axios.get<SoraTaskDetail>(`${KIE_API_URL}${endpoint.path}`, {
              ...config,
              headers: buildAuthHeaders(apiKey),
              timeout: 15000,
            })
          } else {
            response = await axios.post<SoraTaskDetail>(
              `${KIE_API_URL}${endpoint.path}`,
              config.data,
              {
                headers: buildAuthHeaders(apiKey),
                timeout: 15000,
              }
            )
          }

          const normalized = normalizeTaskDetail(response.data)

          if (normalized.code !== 200) {
            throw new Error(`Kie API error: ${normalized.message || 'Unexpected response'}`)
          }

          return normalized
        } catch (innerError: any) {
          const innerStatus = innerError.response?.status
          if (innerStatus === 404 || innerStatus === 405) {
            lastNotFoundError = innerError
            continue
          }
          throw innerError
        }
      }

      if (lastNotFoundError) {
        const notFoundError = new Error('Kie API error: Task not found on any status endpoint')
        ;(notFoundError as any).status = 404
        throw notFoundError
      }

      throw new Error('Kie API error: Failed to resolve task status endpoint')
    } catch (error: any) {
      const status = error.response?.status ?? error.status

      if (status === 404 && attempt < maxAttempts) {
        const delayMs = baseDelayMs * attempt
        console.warn(
          `[Kie Sora] Task ${taskId} not found yet (attempt ${attempt}/${maxAttempts}). Retrying in ${delayMs}ms...`
        )
        await new Promise(resolve => setTimeout(resolve, delayMs))
        continue
      }

      if ((status === 429 || (status >= 500 && status < 600)) && attempt < maxAttempts) {
        const delayMs = baseDelayMs * Math.pow(2, attempt - 1)
        console.warn(
          `[Kie Sora] Transient status (${status}) fetching task ${taskId} (attempt ${attempt}/${maxAttempts}). Retrying in ${delayMs}ms...`
        )
        await new Promise(resolve => setTimeout(resolve, delayMs))
        continue
      }

      console.error('[Kie Sora] Failed to get task details:', error)

      let errorMessage = 'Failed to retrieve task status'

      if (status === 404) {
        errorMessage = `Task not found: ${taskId}`
      } else if (error.response) {
        const data = error.response.data

        if (status === 401) {
          errorMessage = 'Kie API authentication failed.'
        } else if (data?.error?.message || data?.message) {
          errorMessage = `Kie API error: ${data.error?.message || data.message}`
        }
      } else if (error.message) {
        errorMessage = error.message
      }

      const enhancedError = new Error(errorMessage)
      ;(enhancedError as any).status = status || 500
      throw enhancedError
    }
  }

  throw new Error(`Failed to retrieve task status for ${taskId}`)
}

export async function pollTaskUntilComplete(
  taskId: string,
  options: {
    maxAttempts?: number
    pollInterval?: number
    onProgress?: (progress: number, status: string) => void
  } = {}
): Promise<SoraTaskDetail> {
  const maxAttempts = options.maxAttempts || 120
  const pollInterval = options.pollInterval || 10000

  let attempts = 0

  while (attempts < maxAttempts) {
    attempts++

    let taskDetail: SoraTaskDetail | null = null
    try {
      taskDetail = await getTaskDetails(taskId)
    } catch (error: any) {
      if (error?.status === 404) {
        console.warn(
          `[Kie Sora] Task ${taskId} not found yet (attempt ${attempts}/${maxAttempts}). Retrying after ${pollInterval}ms...`
        )
        await new Promise(resolve => setTimeout(resolve, pollInterval))
        continue
      }
      throw error
    }

    const state = taskDetail.data.status

    console.log(`[Kie Sora] Task ${taskId} status: ${state} (attempt ${attempts}/${maxAttempts})`)

    if (options.onProgress) {
      const progress = Math.min(95, Math.round((attempts / maxAttempts) * 100))
      options.onProgress(progress, state)
    }

    if (state === 'finished') {
      console.log(`[Kie Sora] Task ${taskId} completed successfully`)
      return taskDetail
    }

    if (state === 'failed') {
      const errorMsg = taskDetail.data.error?.message || 'Video generation failed'
      console.error(`[Kie Sora] Task ${taskId} failed:`, errorMsg)
      throw new Error(`Sora video generation failed: ${errorMsg}`)
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval))
  }

  throw new Error(`Task ${taskId} timed out after ${maxAttempts} attempts`)
}
