import { useRef, useState } from 'react'
import { FileText, Paperclip, X } from 'lucide-react'
import { MAX_FILES, validateFiles, type RejectedFile } from '@/lib/files'
import { formatBytes } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Drag-drop attachment zone with client-side validation: max 5 files,
 * 10 MB each, allowed extensions only. Rejections are announced inline
 * with the reason — nothing fails silently.
 */
export function FileDropZone({
  files,
  onChange,
}: {
  files: File[]
  onChange: (files: File[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [rejections, setRejections] = useState<RejectedFile[]>([])

  function addFiles(incoming: File[]) {
    const { accepted, rejected } = validateFiles(files, incoming)
    setRejections(rejected)
    if (accepted.length > 0) onChange([...files, ...accepted])
  }

  function removeFile(name: string) {
    onChange(files.filter((f) => f.name !== name))
    setRejections([])
  }

  return (
    <div>
      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          addFiles(Array.from(event.dataTransfer.files))
        }}
        className={cn(
          'rounded-lg border border-dashed px-6 py-8 text-center transition-colors duration-[180ms] ease-editorial',
          dragging ? 'border-crimson bg-crimsonTint/40' : 'border-rule bg-cream/60',
        )}
      >
        <Paperclip aria-hidden="true" className="mx-auto size-5 text-mute" />
        <p className="mt-3 text-sm text-inkMid">
          Drag files here, or{' '}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-sm font-semibold text-crimson underline-offset-4 hover:underline"
          >
            browse your computer
          </button>
        </p>
        <p className="mt-1.5 font-mono text-[11px] text-mute">
          up to {MAX_FILES} files · 10 MB each · pdf, images, office docs, text, zip
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          aria-label="Attach files"
          className="sr-only"
          onChange={(event) => {
            addFiles(Array.from(event.target.files ?? []))
            event.target.value = ''
          }}
        />
      </div>

      {rejections.length > 0 ? (
        <ul role="alert" className="mt-2.5 space-y-1">
          {rejections.map((r) => (
            <li key={r.name} className="text-xs font-medium text-rust">
              {r.name}: {r.reason}.
            </li>
          ))}
        </ul>
      ) : null}

      {files.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {files.map((file) => (
            <li
              key={file.name}
              className="inline-flex items-center gap-2 rounded-md border border-rule/80 bg-card px-3 py-1.5 text-sm text-inkSoft"
            >
              <FileText aria-hidden="true" className="size-4 shrink-0 text-mute" />
              <span className="max-w-48 truncate font-medium">{file.name}</span>
              <span className="font-mono text-xs text-mute">{formatBytes(file.size)}</span>
              <button
                type="button"
                onClick={() => removeFile(file.name)}
                aria-label={`Remove ${file.name}`}
                className="rounded-sm p-0.5 text-mute transition-colors duration-[180ms] ease-editorial hover:text-rust"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
