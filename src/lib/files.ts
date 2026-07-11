/**
 * Client-side attachment rules — enforced before anything leaves the browser.
 * The server enforces the same limits; this exists so people get instant,
 * specific feedback instead of a failed upload.
 */

export const MAX_FILES = 5
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

export const ALLOWED_EXTENSIONS = [
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'txt',
  'log',
  'csv',
  'json',
  'xml',
  'zip',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
] as const

export function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase()
}

/** How (if at all) an attachment can be previewed inline before download. */
export type PreviewKind = 'image' | 'pdf' | 'text' | 'spreadsheet' | 'word' | 'none'

const PREVIEW_KINDS: Record<string, PreviewKind> = {
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  pdf: 'pdf',
  txt: 'text',
  log: 'text',
  json: 'text',
  xml: 'text',
  csv: 'spreadsheet',
  xls: 'spreadsheet',
  xlsx: 'spreadsheet',
  docx: 'word',
}

/**
 * Preview capability by extension. Anything unmapped (zip, legacy .doc, ppt,
 * eml/msg — including server-only types the client upload list omits) is
 * 'none' → download-only. Callers must default to download, never assume.
 */
export function previewKindFor(extension: string): PreviewKind {
  return PREVIEW_KINDS[extension.trim().toLowerCase()] ?? 'none'
}

export interface RejectedFile {
  name: string
  reason: string
}

export interface FileValidationResult {
  accepted: File[]
  rejected: RejectedFile[]
}

/**
 * Validate `incoming` against the rules, given `existing` files already
 * attached. Duplicate names (same as an existing attachment) are rejected
 * so re-drops don't silently double up.
 */
export function validateFiles(existing: File[], incoming: File[]): FileValidationResult {
  const accepted: File[] = []
  const rejected: RejectedFile[] = []
  let count = existing.length

  for (const file of incoming) {
    const ext = fileExtension(file.name)
    if (!ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])) {
      rejected.push({
        name: file.name,
        reason: ext ? `.${ext} files aren't supported` : 'files without an extension aren’t supported',
      })
      continue
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      rejected.push({ name: file.name, reason: 'over the 10 MB limit' })
      continue
    }
    if (existing.some((f) => f.name === file.name) || accepted.some((f) => f.name === file.name)) {
      rejected.push({ name: file.name, reason: 'already attached' })
      continue
    }
    if (count >= MAX_FILES) {
      rejected.push({ name: file.name, reason: `only ${MAX_FILES} files per case` })
      continue
    }
    accepted.push(file)
    count += 1
  }

  return { accepted, rejected }
}
