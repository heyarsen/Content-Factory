import { useState } from 'react'
import { Upload, Sparkles } from 'lucide-react'
import { Button } from '../../ui/Button'
import { Input } from '../../ui/Input'
import { useToast } from '../../../hooks/useToast'

interface CreateAvatarPanelProps {
  onCreate: (data: { avatarName: string; photoFiles: File[] }) => Promise<void>
  onGenerateAI: () => void
}

export function CreateAvatarPanel({ onCreate, onGenerateAI }: CreateAvatarPanelProps) {
  const [avatarName, setAvatarName] = useState('')
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [creating, setCreating] = useState(false)
  const { toast } = useToast()

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
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
    }).slice(0, 5 - photoFiles.length)
    
    setPhotoFiles(prev => [...prev, ...validFiles])
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

    setCreating(true)
    try {
      await onCreate({ avatarName: avatarName.trim(), photoFiles })
      setAvatarName('')
      setPhotoFiles([])
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
          Photos (1-5 photos)
        </label>
        <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
          <Upload className="h-8 w-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm text-slate-600 mb-2">
            {photoFiles.length === 0 
              ? 'Click to upload photos'
              : `${photoFiles.length} photo(s) selected`
            }
          </p>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileSelect}
            disabled={creating || photoFiles.length >= 5}
            className="hidden"
            id="photo-upload"
          />
          <label
            htmlFor="photo-upload"
            className="inline-block px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer text-sm font-medium transition-colors"
          >
            Select Photos
          </label>
        </div>
        {photoFiles.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {photoFiles.map((file, index) => (
              <div key={index} className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded">
                {file.name}
              </div>
            ))}
          </div>
        )}
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

