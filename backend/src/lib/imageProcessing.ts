import sharp from 'sharp'

type PreprocessResult = {
  buffer: Buffer
  mimeType: string
}

const TARGET_HEIGHT = 1024
const TARGET_WIDTH = Math.round(TARGET_HEIGHT * (9 / 16)) // 576
const DEFAULT_MIME = 'image/jpeg'

export async function preprocessAvatarPhoto(
  inputBuffer: Buffer,
  mimeType: string = DEFAULT_MIME
): Promise<PreprocessResult> {
  try {
    const pipeline = sharp(inputBuffer, { failOn: 'none' }).rotate()

    const processed = await pipeline
      .resize(TARGET_WIDTH, TARGET_HEIGHT, {
        fit: 'cover',
        position: 'attention',
      })
      .normalize()
      .modulate({ brightness: 1.05, saturation: 1.05 })
      .sharpen()
      .jpeg({ quality: 92 })
      .toBuffer()

    return {
      buffer: processed,
      mimeType: DEFAULT_MIME,
    }
  } catch (error: any) {
    console.warn('Photo preprocessing failed, using original image:', error?.message || error)
    return {
      buffer: inputBuffer,
      mimeType,
    }
  }
}

