import { useState, useRef } from 'react'
import { Upload, X } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { useToast } from '../../hooks/useToast'

interface Avatar {
  id: string
  avatar_name: string
  heygen_avatar_id: string
}

interface AddLooksModalProps {
  isOpen: boolean
  onClose: () => void
  avatar: Avatar | null
  onAdd: (files: File[]) => Promise<void>
  adding: boolean
}

export function AddLooksModal({ isOpen, onClose, avatar, onAdd, adding }: AddLooksModalProps) {
  const [lookImageFiles, setLookImageFiles] = useState<File[]>([])
  const [lookImagePreviews, setLookImagePreviews] = useState<string[]>([])
  const addLooksInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleLookFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

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

    setLookImageFiles(prev => [...prev, ...validFiles])

    // Create previews
    validFiles.forEach(file => {
      const reader = new FileReader()
      reader.onloadend = () => {
        if (reader.result) {
          setLookImagePreviews(prev => [...prev, reader.result as string])
        }
      }
      reader.readAsDataURL(file)
    })
  }

  const handleAdd = async () => {
    if (lookImageFiles.length === 0) {
      toast.error('Please select at least one image')
      return
    }

    await onAdd(lookImageFiles)

    // Reset on success
    setLookImageFiles([])
    setLookImagePreviews([])
  }

  const handleClose = () => {
    if (!adding) {
      setLookImageFiles([])
      setLookImagePreviews([])
      onClose()
    }
  }

  return (
    <Modal
      isOpen={isOpen && !!avatar}
      onClose={handleClose}
      title="Add Looks to Avatar"
      size="md"
    >
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Upload Photos *</label>
          {lookImagePreviews.length > 0 ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {lookImagePreviews.map((preview, index) => (
                  <div key={index} className="relative">
                    <div
                      className="rounded-lg border-2 border-slate-200 overflow-hidden"
                      style={{ aspectRatio: '9 / 16' }}
                    >
                      <img src={preview} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                    </div>
                    <button
                      onClick={() => {
                        setLookImageFiles(lookImageFiles.filter((_, i) => i !== index))
                        setLookImagePreviews(lookImagePreviews.filter((_, i) => i !== index))
                      }}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => addLooksInputRef.current?.click()}
                disabled={adding}
              >
                Add More Photos
              </Button>
            </div>
          ) : (
            <div
              onClick={() => addLooksInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center cursor-pointer hover:border-brand-500 transition-colors"
            >
              <Upload className="h-12 w-12 mx-auto text-slate-400 mb-3" />
              <p className="text-sm text-slate-600 mb-1">Click to upload photos</p>
              <p className="text-xs text-slate-500">PNG, JPG up to 10MB. You can upload multiple photos.</p>
            </div>
          )}
          <input
            ref={addLooksInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleLookFileSelect}
            className="hidden"
            disabled={adding}
          />
        </div>

        <div className="flex gap-3 justify-end pt-4 border-t border-slate-200">
          <Button variant="ghost" onClick={handleClose} disabled={adding}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={adding || lookImageFiles.length === 0} loading={adding}>
            {adding ? 'Adding Looks...' : 'Add Looks'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

