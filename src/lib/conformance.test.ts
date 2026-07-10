import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Mechanical enforcement of the CLAUDE.md hard rules — banned UI words and
 * brand-tokens-only color usage. Greps source, so a violation fails CI with
 * the offending file and match instead of waiting for a design review.
 */

const SRC_DIR = path.resolve(process.cwd(), 'src')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

const sourceFiles = walk(SRC_DIR).filter(
  (file) => /\.(ts|tsx)$/.test(file) && !/\.test\.tsx?$/.test(file),
)
// UI copy lives in components; mocks/fixtures quote realistic client prose.
const uiFiles = sourceFiles.filter((file) => file.endsWith('.tsx'))

function violations(files: string[], patterns: RegExp[]): string[] {
  const found: string[] = []
  for (const file of files) {
    const rel = path.relative(SRC_DIR, file)
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((line, index) => {
      for (const pattern of patterns) {
        const match = line.match(pattern)
        if (match) found.push(`${rel}:${index + 1} → "${match[0]}"`)
      }
    })
  }
  return found
}

describe('brand & copy conformance (CLAUDE.md hard rules)', () => {
  it('keeps banned words out of UI source', () => {
    const banned = [
      /\bSubmit\b/, // labels are verb-first; handleSubmit/onSubmit don't match \b
      /\bLearn more\b/i,
      /\bseamless\w*\b/i,
      /\bleverag(?:e[sd]?|ing)\b/i,
      /(?<![\w-])transform(?![\w-:])/i, // say what actually changes
      /\breal-time\b/i, // say "live"
    ]
    expect(violations(uiFiles, banned)).toEqual([])
  })

  it('uses brand tokens — never the Tailwind default palette', () => {
    const palette = [
      // Any numbered default-palette class (green-500, slate-200, …).
      /\b(?:bg|text|border|ring|outline|fill|stroke|decoration|divide|accent|caret|from|via|to)-(?:green|emerald|lime|teal|red|blue|slate|gray|zinc|neutral|stone|orange|yellow|amber|violet|purple|fuchsia|pink|rose|sky|indigo|cyan)-\d{2,3}\b/,
      // Raw white/black utilities — the surface token is bg-card.
      /\b(?:bg|text|border|ring|fill|stroke)-(?:white|black)\b/,
      // Ad-hoc hex in components — hex belongs in the @theme block only.
      /#[0-9a-fA-F]{6}\b/,
    ]
    expect(violations(uiFiles, palette)).toEqual([])
  })

  it('keeps green out entirely — positive signals are navy', () => {
    const green = [/\b(?:bg|text|border|ring|fill|stroke|from|via|to)-(?:green|emerald|lime)\b/]
    expect(violations([...uiFiles, path.join(SRC_DIR, 'lib/status.ts')], green)).toEqual([])
  })
})
