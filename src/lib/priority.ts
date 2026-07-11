/**
 * Single source of truth for case Priority → client-facing label. Priority is
 * derived in the org from Impact × Urgency and stored with an internal ordinal
 * prefix ("2. Low", "5. Blocker"). Clients see the word, never the number.
 * Urgency values (Critical/High/Medium/Low/Lowest) are already client-clean and
 * pass through untouched.
 */

const PRIORITY_LABELS: Record<string, string> = {
  '5. blocker': 'Blocker',
  '5. high': 'High', // some orgs label the top band "5. High" instead of Blocker
  '4. high': 'High',
  '3. medium': 'Medium',
  '2. low': 'Low',
  '1. lowest': 'Lowest',
}

/**
 * Client-facing priority label. Strips a leading "N. " ordinal from any
 * unmapped value so a new band still reads cleanly; blank/null → null.
 */
export function priorityLabelFor(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  return PRIORITY_LABELS[trimmed.toLowerCase()] ?? trimmed.replace(/^\d+\.\s*/, '')
}
