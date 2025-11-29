import { useState, useRef } from 'react'
import { Upload, X } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { useToast } from '../../hooks/useToast'

interface AvatarCreateModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (data: { avatarName: string; photoFiles: File[] }) => Promise<void>
  creating: boolean
}

const MAX_PHOTOS = 5

export function AvatarCreateModal({ isOpen, onClose, onCreate, creating }: AvatarCreateModalProps) {
  const [avatarName, setAvatarName] = useState('')
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const createPhotoInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result)
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
      toast.error('Please enter an avatar name')
      return
    }
    if (photoFiles.length === 0) {
      toast.error('Please select at least one photo')
      return
    }

    await onCreate({ avatarName, photoFiles })
    
    // Reset form on success
    setAvatarName('')
    setPhotoFiles([])
    setPhotoPreviews([])
    if (createPhotoInputRef.current) {
      createPhotoInputRef.current.value = ''
    }
  }

  const handleClose = () => {
    if (!creating) {
      setAvatarName('')
      setPhotoFiles([])
      setPhotoPreviews([])
      if (createPhotoInputRef.current) {
        createPhotoInputRef.current.value = ''
      }
      onClose()
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create Avatar from Photo" size="md">
      <div className="space-y-6">
        <div>
          <p className="text-sm text-slate-600 mb-4">
            Upload a front-facing photo to create a personalized avatar for your videos.
          </p>
        </div>

        <Input
          label="Avatar Name"
          value={avatarName}
          onChange={(e) => setAvatarName(e.target.value)}
          placeholder="Enter avatar name (e.g., Professional Business Person)"
          disabled={creating}
          required
        />

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Photos * (upload 1–5 best shots)
          </label>
          <p className="text-xs text-slate-500 mb-3">
            Front-facing, good lighting, no heavy filters. Add multiple angles to improve training success.
          </p>
          {photoPreviews.length > 0 ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {photoPreviews.map((preview, index) => (
                  <div key={`${preview}-${index}`} className="relative rounded-lg border-2 border-slate-200 overflow-hidden">
                    <img
                      src={preview}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-48 object-cover"
                    />
                    <div className="absolute top-2 left-2">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          index === 0 ? 'bg-brand-500 text-white' : 'bg-white/90 text-slate-700'
                        }`}
                      >
                        {index === 0 ? 'Primary' : 'Secondary'}
                      </span>
                    </div>
                    <div className="absolute top-2 right-2 flex gap-1">
                      {index !== 0 && (
                        <button
                          onClick={() => handleSetPrimaryPhoto(index)}
                          className="rounded-full bg-white/90 text-slate-700 hover:bg-brand-50 px-2 py-1 text-xs font-medium"
                        >
                          Make Primary
                        </button>
                      )}
                      <button
                        onClick={() => handleRemovePhoto(index)}
                        className="rounded-full bg-red-500 text-white hover:bg-red-600 p-1"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => createPhotoInputRef.current?.click()}
                disabled={creating}
              >
                Add More Photos
              </Button>
            </div>
          ) : (
            <div
              onClick={() => createPhotoInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center cursor-pointer hover:border-brand-500 transition-colors"
            >
              <Upload className="h-12 w-12 mx-auto text-slate-400 mb-3" />
              <p className="text-sm text-slate-600 mb-1">Click to upload your best photo</p>
              <p className="text-xs text-slate-500">
                PNG/JPG up to 10MB each. You can add more after the first upload.
              </p>
            </div>
          )}
          <input
            ref={createPhotoInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            disabled={creating}
          />
          <p className="mt-2 text-xs text-slate-500">
            We upload your photo to HeyGen exactly as provided—no automatic cropping or enhancement is applied.
          </p>
        </div>

        <div className="flex gap-3 justify-end pt-4 border-t border-slate-200">
          <Button variant="ghost" onClick={handleClose} disabled={creating} type="button">
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={creating || !avatarName.trim() || photoFiles.length === 0}
            loading={creating}
            type="button"
          >
            {creating ? 'Creating...' : 'Create Avatar'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

