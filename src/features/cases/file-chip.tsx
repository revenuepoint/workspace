import { useState } from 'react'
import { Download, Eye, Paperclip } from 'lucide-react'
import { toast } from 'sonner'
import { saveCaseFile } from '@/lib/api'
import type { FileMeta } from '@/lib/api-types'
import { previewKindFor } from '@/lib/files'
import { formatBytes } from '@/lib/format'
import { FilePreview } from './file-preview'

/**
 * Attachment chip — name, size. Previewable types (images, PDF, text,
 * spreadsheets, Word) open an inline preview on click; everything else
 * downloads directly. Shared by the case Files panel and timeline entries.
 */
export function FileChip({ caseId, file }: { caseId: string; file: FileMeta }) {
  const [downloading, setDownloading] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const canPreview = previewKindFor(file.extension) !== 'none'

  async function activate() {
    if (canPreview) {
      setPreviewing(true)
      return
    }
    setDownloading(true)
    try {
      await saveCaseFile(caseId, file.contentDocumentId, file.title)
    } catch {
      toast.error(`${file.title} didn’t download. Give it another try.`)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={activate}
        disabled={downloading}
        title={canPreview ? `Preview ${file.title}` : `Download ${file.title}`}
        className="group inline-flex items-center gap-2 rounded-md border border-rule/80 bg-card px-3 py-2 text-sm text-inkSoft transition-all duration-[180ms] ease-editorial hover:-translate-y-[2px] hover:border-mute hover:shadow-lift disabled:opacity-60"
      >
        <Paperclip aria-hidden="true" className="size-4 shrink-0 text-mute" />
        <span className="max-w-56 truncate font-medium">{file.title}</span>
        <span className="font-mono text-xs text-mute">{formatBytes(file.sizeBytes)}</span>
        {canPreview ? (
          <Eye
            aria-hidden="true"
            className="size-4 shrink-0 text-muteSoft transition-colors duration-[180ms] ease-editorial group-hover:text-crimson"
          />
        ) : (
          <Download
            aria-hidden="true"
            className="size-4 shrink-0 text-muteSoft transition-colors duration-[180ms] ease-editorial group-hover:text-crimson"
          />
        )}
        <span className="sr-only">
          {canPreview ? `Preview ${file.title}` : `Download ${file.title}`}
        </span>
      </button>
      {previewing ? (
        <FilePreview caseId={caseId} file={file} onClose={() => setPreviewing(false)} />
      ) : null}
    </>
  )
}
