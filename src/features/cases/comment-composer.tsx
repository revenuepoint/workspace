import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Paperclip } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type { CaseDetail, TimelineEntry } from '@/lib/api-types'
import { MAX_FILES, validateFiles } from '@/lib/files'
import { useSessionStore } from '@/stores/session'
import { Button } from '@/components/ui/button'
import { MicroLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'

/**
 * Composer at the bottom of a case: textarea + "Add comment" + file attach.
 * Comments append optimistically — the bubble shows up the moment you send,
 * and rolls back with a toast if the request fails.
 */
export function CommentComposer({ caseId }: { caseId: string }) {
  const queryClient = useQueryClient()
  const contact = useSessionStore((s) => s.contact)
  const [body, setBody] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const detailKey = ['case', caseId] as const

  const commentMutation = useMutation({
    mutationFn: (text: string) => api.addComment(caseId, text),
    onMutate: async (text) => {
      await queryClient.cancelQueries({ queryKey: detailKey })
      const previous = queryClient.getQueryData<CaseDetail>(detailKey)
      // Impersonated sessions render their own bubbles RevenuePoint-side
      // immediately — matching what the server entry will come back as.
      const impersonated = contact?.impersonated === true
      const optimistic: TimelineEntry = {
        id: `optimistic-${Date.now()}`,
        kind: 'comment',
        at: new Date().toISOString(),
        side: impersonated ? 'rp' : 'client',
        author: {
          name: impersonated
            ? (contact.actorName ?? 'RevenuePoint staff')
            : contact
              ? `${contact.firstName} ${contact.lastName}`
              : 'You',
        },
        bodyText: text,
      }
      queryClient.setQueryData<CaseDetail>(detailKey, (old) =>
        old ? { ...old, timeline: [...old.timeline, optimistic] } : old,
      )
      setBody('')
      return { previous, optimisticId: optimistic.id }
    },
    onError: (_error, text, context) => {
      if (context?.previous) queryClient.setQueryData(detailKey, context.previous)
      setBody(text)
      toast.error('Your comment didn’t send. Give it another try.')
    },
    onSuccess: (result, _text, context) => {
      // Swap the optimistic bubble for the server's canonical entry.
      queryClient.setQueryData<CaseDetail>(detailKey, (old) =>
        old
          ? {
              ...old,
              lastActivityAt: result.entry.at,
              timeline: old.timeline.map((entry) =>
                entry.id === context.optimisticId ? result.entry : entry,
              ),
            }
          : old,
      )
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: detailKey })
      void queryClient.invalidateQueries({ queryKey: ['cases'] })
    },
  })

  const uploadMutation = useMutation({
    mutationFn: (files: File[]) => api.uploadCaseFiles(caseId, files),
    onSuccess: (result) => {
      const failed = result.files.filter((f) => !f.ok)
      const sent = result.files.length - failed.length
      if (sent > 0) toast(sent === 1 ? 'File attached.' : `${sent} files attached.`)
      for (const f of failed) {
        toast.error(`${f.name} didn’t upload${f.error ? ` — ${f.error}` : '.'}`)
      }
    },
    onError: () => toast.error('Those files didn’t upload. Give it another try.'),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: detailKey })
      void queryClient.invalidateQueries({ queryKey: ['cases'] })
    },
  })

  function submitComment() {
    const trimmed = body.trim()
    if (!trimmed || commentMutation.isPending) return
    commentMutation.mutate(trimmed)
  }

  function attachFiles(list: FileList | null) {
    if (!list || list.length === 0) return
    const { accepted, rejected } = validateFiles([], Array.from(list))
    for (const r of rejected) {
      toast.error(`${r.name}: ${r.reason}.`)
    }
    if (accepted.length > 0) uploadMutation.mutate(accepted)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        submitComment()
      }}
      className="space-y-2.5"
    >
      <MicroLabel htmlFor="comment-body">Add a comment</MicroLabel>
      <Textarea
        id="comment-body"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault()
            submitComment()
          }
        }}
        rows={4}
        placeholder="Reply to the RevenuePoint team…"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <input
            ref={fileInputRef}
            id="comment-files"
            type="file"
            multiple
            className="sr-only"
            onChange={(event) => attachFiles(event.target.files)}
          />
          <Button
            type="button"
            variant="neutral"
            size="sm"
            disabled={uploadMutation.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip aria-hidden="true" />
            {uploadMutation.isPending ? 'Attaching…' : 'Attach files'}
          </Button>
          <span className="ml-3 hidden font-mono text-[11px] text-mute sm:inline">
            up to {MAX_FILES} files · 10 MB each
          </span>
        </div>
        <Button type="submit" disabled={!body.trim() || commentMutation.isPending}>
          Add comment
        </Button>
      </div>
    </form>
  )
}
