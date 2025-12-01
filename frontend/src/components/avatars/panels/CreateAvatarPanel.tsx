import { useState, useRef } from 'react'
import { Upload, Sparkles, X, Plus } from 'lucide-react'
import { Button } from '../../ui/Button'
import { Input } from '../../ui/Input'
import { useToast } from '../../../hooks/useToast'

interface CreateAvatarPanelProps {
  onCreate: (data: { avatarName: string; photoFiles: File[] }) => Promise<void>
  onGenerateAI: () => void
}

const MAX_PHOTOS = 5

export function CreateAvatarPanel({ onCreate, onGenerateAI }: CreateAvatarPanelProps) {
  const [avatarName, setAvatarName] = useState('')
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const createPhotoInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result as string)
        } else {
          reject(new Error('Failed to read file'))
        }
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) {
      return
    }

    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image file`)
        return false
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} is larger than 10MB`)
        return false
      }
      return true
    })

    if (!validFiles.length) {
      return
    }

    const availableSlots = Math.max(0, MAX_PHOTOS - photoFiles.length)
    if (availableSlots === 0) {
      toast.error(`You can upload up to ${MAX_PHOTOS} photos`)
      return
    }

    const filesToAdd = validFiles.slice(0, availableSlots)
    if (filesToAdd.length < validFiles.length) {
      toast.info(`Only the first ${filesToAdd.length} photo(s) were added (max ${MAX_PHOTOS})`)
    }

    try {
      const previews = await Promise.all(filesToAdd.map(fileToDataUrl))
      setPhotoFiles(prev => [...prev, ...filesToAdd])
      setPhotoPreviews(prev => [...prev, ...previews])
    } catch (err: any) {
      toast.error(err.message || 'Failed to process selected photos')
    } finally {
      // Reset the input value to allow re-uploading the same file
      if (createPhotoInputRef.current) {
        createPhotoInputRef.current.value = ''
      }
    }
  }

  const handleRemovePhoto = (index: number) => {
    setPhotoFiles(prev => prev.filter((_, i) => i !== index))
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index))
  }

  const handleSetPrimaryPhoto = (index: number) => {
    if (index === 0) return
    setPhotoFiles(prev => {
      const next = [...prev]
      const [selected] = next.splice(index, 1)
      return [selected, ...next]
    })
    setPhotoPreviews(prev => {
      const next = [...prev]
      const [selected] = next.splice(index, 1)
      return [selected, ...next]
    })
  }

  const handleCreate = async () => {
    if (!avatarName.trim()) {
      toast.error('Please enter an avatar name.')
      return
    }
    if (photoFiles.length === 0) {
      toast.error('Please upload at least one photo.')
      return
    }
    setCreating(true)
    try {
      await onCreate({ avatarName, photoFiles })
      setAvatarName('')
      setPhotoFiles([])
      setPhotoPreviews([])
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Create New Avatar</h3>
        <p className="text-sm text-slate-500">
          Upload photos or generate an AI avatar to get started.
        </p>
      </div>

      {/* Avatar Name */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Avatar Name
        </label>
        <Input
          value={avatarName}
          onChange={(e) => setAvatarName(e.target.value)}
          placeholder="Enter avatar name"
          disabled={creating}
        />
      </div>

      {/* Photo Upload */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Uploaded Photos ({photoFiles.length}/{MAX_PHOTOS})
        </label>
        {photoFiles.length === 0 ? (
          <div className="flex items-center justify-center h-32 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-sm">
            <button
              onClick={() => createPhotoInputRef.current?.click()}
              className="flex flex-col items-center gap-2 hover:text-slate-600 transition-colors"
            >
              <Upload className="h-8 w-8" />
              <span>Click to upload photos</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {photoPreviews.map((preview, index) => (
              <div
                key={index}
                className={`relative aspect-square rounded-lg overflow-hidden group cursor-pointer ${
                  index === 0 ? 'border-2 border-cyan-500' : 'border border-slate-200'
                }`}
                onClick={() => handleSetPrimaryPhoto(index)}
              >
                <img src={preview} alt={`Avatar photo ${index + 1}`} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemovePhoto(index)
                    }}
                    className="p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {index === 0 && (
                  <span className="absolute top-1 left-1 bg-cyan-500 text-white text-xs px-2 py-0.5 rounded-full">Primary</span>
                )}
              </div>
            ))}
            {photoFiles.length < MAX_PHOTOS && (
              <button
                onClick={() => createPhotoInputRef.current?.click()}
                className="aspect-square border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center text-slate-400 hover:border-slate-300 hover:text-slate-500 transition-colors"
              >
                <Plus className="h-6 w-6" />
              </button>
            )}
          </div>
        )}
        <input
          type="file"
          ref={createPhotoInputRef}
          className="hidden"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          disabled={creating}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-slate-200">
        <Button
          onClick={handleCreate}
          disabled={!avatarName.trim() || photoFiles.length === 0 || creating}
          className="flex-1"
        >
          {creating ? 'Creating...' : 'Create Avatar'}
        </Button>
        <Button
          variant="secondary"
          onClick={onGenerateAI}
          disabled={creating}
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Generate AI
        </Button>
      </div>
    </div>
  )
}

