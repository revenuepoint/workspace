import { useEffect, useRef, useState } from 'react'
import { Download, X } from 'lucide-react'
import { toast } from 'sonner'
import { api, saveCaseFile } from '@/lib/api'
import type { FileMeta } from '@/lib/api-types'
import { previewKindFor, type PreviewKind } from '@/lib/files'
import { formatBytes } from '@/lib/format'

/**
 * Attachment preview in a native <dialog> (focus trap + Escape are built in;
 * no dependency, CSP-safe). Reuses api.downloadCaseFile — same bytes as the
 * download — and renders by extension: images/PDF inline, text as <pre>,
 * spreadsheets and Word via lazily-imported parsers so those libs code-split
 * out of the main bundle. The object URL is held for the element's lifetime
 * and revoked on close.
 */
export function FilePreview({
  caseId,
  file,
  onClose,
}: {
  caseId: string
  file: FileMeta
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const kind = previewKindFor(file.extension)

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    // Native 'close' (Escape / form-method=dialog) unmounts via the parent.
    const onNativeClose = () => onClose()
    dialog?.addEventListener('close', onNativeClose)
    return () => dialog?.removeEventListener('close', onNativeClose)
  }, [onClose])

  async function download() {
    try {
      await saveCaseFile(caseId, file.contentDocumentId, file.title)
    } catch {
      toast.error(`${file.title} didn’t download. Give it another try.`)
    }
  }

  return (
    // Backdrop click (target is the dialog itself, not its content) closes it.
    // Keyboard dismissal is native to showModal() (Escape) plus the close
    // button, so this click handler is a pointer-only enhancement.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={dialogRef}
      aria-label={`Preview of ${file.title}`}
      // Tailwind preflight zeroes the dialog's default margin:auto, so center
      // it explicitly (fixed + translate) rather than rely on UA styles.
      className="fixed left-1/2 top-1/2 max-h-[85vh] w-[min(920px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-rule/70 bg-card p-0 text-ink shadow-lift backdrop:bg-ink/40"
      onClick={(event) => {
        if (event.target === dialogRef.current) dialogRef.current?.close()
      }}
    >
      <div className="flex items-center justify-between gap-4 border-b border-rule/60 px-5 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{file.title}</p>
          <p className="font-mono text-[11px] text-mute">{formatBytes(file.sizeBytes)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={download}
            className="inline-flex items-center gap-1.5 rounded-md border border-rule bg-card px-3 py-1.5 text-sm font-semibold text-inkMid transition-colors duration-[180ms] ease-editorial hover:border-mute hover:bg-paper"
          >
            <Download aria-hidden="true" className="size-4" />
            Download
          </button>
          <button
            type="button"
            aria-label="Close preview"
            onClick={() => dialogRef.current?.close()}
            className="rounded-md p-1.5 text-mute transition-colors duration-[180ms] ease-editorial hover:text-crimson"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
      </div>

      <div className="max-h-[calc(85vh-3.5rem)] overflow-auto bg-paper/40">
        <PreviewBody caseId={caseId} file={file} kind={kind} onDownload={download} />
      </div>
    </dialog>
  )
}

function PreviewBody({
  caseId,
  file,
  kind,
  onDownload,
}: {
  caseId: string
  file: FileMeta
  kind: PreviewKind
  onDownload: () => void
}) {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error' }
    | { status: 'ready'; kind: 'image' | 'pdf'; url: string }
    | { status: 'ready'; kind: 'text'; text: string }
    | { status: 'ready'; kind: 'html'; html: string }
    | { status: 'ready'; kind: 'dom'; blob: Blob }
    | { status: 'unsupported' }
  >(kind === 'none' ? { status: 'unsupported' } : { status: 'loading' })

  useEffect(() => {
    if (kind === 'none') return
    let objectUrl: string | null = null
    let cancelled = false

    async function load() {
      try {
        const blob = await api.downloadCaseFile(caseId, file.contentDocumentId)
        if (cancelled) return
        if (kind === 'image' || kind === 'pdf') {
          objectUrl = URL.createObjectURL(blob)
          setState({ status: 'ready', kind, url: objectUrl })
        } else if (kind === 'text') {
          const text = await blob.text()
          if (!cancelled) setState({ status: 'ready', kind: 'text', text })
        } else if (kind === 'spreadsheet') {
          const [XLSX, { sanitizeHtml }] = await Promise.all([import('xlsx'), import('@/lib/sanitize')])
          const wb = XLSX.read(await blob.arrayBuffer(), { type: 'array' })
          const first = wb.SheetNames[0]
          const sheet = first ? wb.Sheets[first] : undefined
          const rawHtml = sheet ? XLSX.utils.sheet_to_html(sheet) : '<p>Empty spreadsheet.</p>'
          if (!cancelled) setState({ status: 'ready', kind: 'html', html: sanitizeHtml(rawHtml) })
        } else if (kind === 'word') {
          if (!cancelled) setState({ status: 'ready', kind: 'dom', blob })
        }
      } catch {
        if (!cancelled) setState({ status: 'error' })
      }
    }
    void load()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [caseId, file.contentDocumentId, kind])

  if (state.status === 'loading') {
    return <div className="p-10 text-center text-sm text-mute">Loading preview…</div>
  }
  if (state.status === 'error') {
    return (
      <div className="p-10 text-center">
        <p className="text-sm text-inkMid">We couldn’t load a preview.</p>
        <button
          type="button"
          onClick={onDownload}
          className="mt-3 rounded-sm text-sm font-semibold text-crimson underline-offset-4 hover:underline"
        >
          Download instead
        </button>
      </div>
    )
  }
  if (state.status === 'unsupported') {
    return (
      <div className="p-10 text-center">
        <p className="text-sm text-inkMid">
          This file type can’t be previewed here — download it to open it.
        </p>
        <button
          type="button"
          onClick={onDownload}
          className="mt-3 inline-flex items-center gap-1.5 rounded-sm text-sm font-semibold text-crimson underline-offset-4 hover:underline"
        >
          Download {file.title}
        </button>
      </div>
    )
  }

  if (state.kind === 'image') {
    return (
      <div className="flex justify-center p-4">
        <img src={state.url} alt={file.title} className="max-h-[70vh] max-w-full object-contain" />
      </div>
    )
  }
  if (state.kind === 'pdf') {
    return <iframe title={file.title} src={state.url} className="h-[75vh] w-full border-0 bg-card" />
  }
  if (state.kind === 'text') {
    return (
      <pre className="overflow-auto whitespace-pre-wrap break-words p-5 font-mono text-[0.8125rem] leading-relaxed text-inkSoft">
        {state.text}
      </pre>
    )
  }
  if (state.kind === 'html') {
    return (
      <div
        className="preview-sheet overflow-auto bg-card p-4 text-[0.8125rem] text-inkSoft"
        // Sanitized (DOMPurify) spreadsheet table.
        dangerouslySetInnerHTML={{ __html: state.html }}
      />
    )
  }
  if (state.kind === 'dom') return <WordPreview blob={state.blob} />
  return null
}

/** docx-preview renders directly into a container element (not a string). */
function WordPreview({ blob }: { blob: Blob }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function render() {
      try {
        const { renderAsync } = await import('docx-preview')
        if (cancelled || !containerRef.current) return
        await renderAsync(blob, containerRef.current, undefined, {
          className: 'docx',
          inWrapper: true,
          ignoreLastRenderedPageBreak: true,
        })
      } catch {
        if (!cancelled) setFailed(true)
      }
    }
    void render()
    return () => {
      cancelled = true
    }
  }, [blob])

  if (failed) {
    return <div className="p-10 text-center text-sm text-inkMid">We couldn’t render this document.</div>
  }
  return <div ref={containerRef} className="preview-doc bg-card p-4" />
}
