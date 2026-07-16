import type { CaseDetail, CaseParticipant, Contact, FileMeta, TimelineEntry } from '@/lib/api-types'

/**
 * Seed data for MSW — one realistic client account ("Acme Corp") with
 * 8 open + 4 closed cases across all record types. Timestamps are relative
 * to now so "last activity" reads naturally in dev. Two of the open cases are
 * sensitive: case-0011 (Dana participates → visible to her) and case-0012
 * (Marcus only → the handlers hide it from Dana entirely, like the real API).
 */

export const MOCK_SESSION_JWT = 'mock.workspace.jwt.v1'
/** Distinct JWT for impersonated sessions so handlers can attribute writes. */
export const MOCK_IMPERSONATED_JWT = 'mock.workspace.jwt.imp.v1'

export const seedContact: Contact = {
  firstName: 'Dana',
  lastName: 'Whitfield',
  email: 'dana.whitfield@acmecorp.com',
  accountId: 'acct-acme-0001',
  accountName: 'Acme Corp',
}

const COLLEAGUE = 'Marcus Feld'

/** Eligible contacts at Acme Corp — the participant picker's source. */
export const seedAccountContacts: CaseParticipant[] = [
  { contactId: 'c-dana', name: 'Dana Whitfield', email: 'dana.whitfield@acmecorp.com' },
  { contactId: 'c-marcus', name: 'Marcus Feld', email: 'marcus.feld@acmecorp.com' },
  { contactId: 'c-priya', name: 'Priya Anand', email: 'priya.anand@acmecorp.com' },
  { contactId: 'c-lena', name: 'Lena Ortiz', email: 'lena.ortiz@acmecorp.com' },
]

const danaParticipant: CaseParticipant = seedAccountContacts[0]!
const marcusParticipant: CaseParticipant = seedAccountContacts[1]!

function ago(days: number, hours = 0): string {
  return new Date(Date.now() - (days * 24 + hours) * 60 * 60 * 1000).toISOString()
}

function fileMeta(partial: Omit<FileMeta, 'contentDocumentId'> & { contentDocumentId: string }): FileMeta {
  return partial
}

// --- Case 1: the rich-timeline case -----------------------------------------

const case1Files: FileMeta[] = [
  fileMeta({
    contentDocumentId: 'doc-0001',
    title: 'invoice-march-export.csv',
    extension: 'csv',
    sizeBytes: 18_204,
    uploadedAt: ago(3),
    uploadedBy: 'client',
  }),
  fileMeta({
    contentDocumentId: 'doc-0002',
    title: 'duplicate-lines-annotated.pdf',
    extension: 'pdf',
    sizeBytes: 412_338,
    uploadedAt: ago(2, 20),
    uploadedBy: 'rp',
  }),
]

const case1Timeline: TimelineEntry[] = [
  {
    id: 'tl-0001',
    kind: 'created',
    at: ago(6),
    side: 'system',
    author: { name: 'Dana Whitfield' },
  },
  {
    id: 'tl-0002',
    kind: 'comment',
    at: ago(5, 20),
    side: 'rp',
    author: { name: 'Priya Raman' },
    bodyText:
      'Thanks Dana — we can reproduce this on our side. The March run double-counts any line item where a credit memo was applied mid-cycle. We’re tracing where the join goes wrong and will post updates here.',
  },
  {
    id: 'tl-0003',
    kind: 'comment',
    at: ago(5, 16),
    side: 'client',
    author: { name: 'Dana Whitfield' },
    bodyText:
      'Appreciate the quick look. One flag: our finance close starts Monday. If there’s a workaround for the March invoice specifically, that buys us time.\n\nHappy to hop on a call if it helps.',
  },
  {
    id: 'tl-0004',
    kind: 'status',
    at: ago(5),
    side: 'system',
    status: { fromLabel: 'Received', toLabel: 'In review' },
  },
  {
    id: 'tl-0005',
    kind: 'email',
    at: ago(4, 2),
    side: 'rp',
    author: { name: 'Priya Raman' },
    emailSubject: 'Re: Quarterly invoice shows duplicate line items [ref:00012341]',
    bodyHtml:
      '<p>Hi Dana,</p>' +
      '<p>Quick update before the weekend. We isolated the duplication to the invoice aggregation step: when a credit memo lands mid-cycle, the export joins it back against the original line and emits both rows.</p>' +
      '<p>For your Monday close, here’s the workaround:</p>' +
      '<ul>' +
      '<li>Re-run the March export with <strong>“Include adjustments”</strong> switched off.</li>' +
      '<li>Apply the credit memos from the adjustments tab instead — totals then reconcile to the ledger.</li>' +
      '<li>Keep the original export for the audit trail; we’ve annotated the affected lines in the attached PDF.</li>' +
      '</ul>' +
      '<p>The proper fix goes into review early next week. We’ll post here the moment it ships.</p>' +
      '<p>Best,<br>Priya Raman<br>RevenuePoint Client Success</p>',
  },
  {
    id: 'tl-0006',
    kind: 'file',
    at: ago(3),
    side: 'client',
    author: { name: 'Dana Whitfield' },
    file: case1Files[0],
  },
]

// --- The full seed -----------------------------------------------------------

export function seedCases(): CaseDetail[] {
  return [
    // ---------------- Open (6) ----------------
    {
      id: 'case-0001',
      caseNumber: '00012341',
      subject: 'Quarterly invoice shows duplicate line items',
      status: 'In Review',
      statusLabel: 'In review',
      statusGroup: 'open',
      waitingOnYou: false,
      recordType: 'support',
      recordTypeLabel: 'Support request',
      createdAt: ago(6),
      lastActivityAt: ago(3),
      lastModifiedAt: ago(3),
      submittedBy: { name: 'Dana Whitfield' },
      owner: { name: 'Priya Raman', isQueue: false },
      urgency: 'High',
      priority: '4. High',
      description:
        'The Q1 invoice export (run March 31) shows several line items **twice** — same SKU, same amount, same timestamp.\n\n' +
        'It only seems to affect customers where we issued a credit memo during the quarter. What we see:\n\n' +
        '- Duplicated rows inflate the invoice total\n' +
        '- Only Q1 (Jan–Mar) exports are affected\n' +
        '- Re-running the export reproduces it every time\n\n' +
        'This blocks our reconciliation — the totals no longer tie out to the ledger. Happy to share a sample export on request.',
      timeline: structuredClone(case1Timeline),
      files: structuredClone(case1Files),
      participants: [danaParticipant, marcusParticipant],
    },
    {
      id: 'case-0002',
      caseNumber: '00012342',
      subject: 'Payment webhook retries failing since Friday',
      status: 'In Progress',
      statusLabel: 'In progress',
      statusGroup: 'open',
      waitingOnYou: false,
      recordType: 'problem',
      recordTypeLabel: 'Problem report',
      createdAt: ago(4),
      lastActivityAt: ago(1, 3),
      lastModifiedAt: ago(1, 3),
      submittedBy: { name: COLLEAGUE },
      owner: { name: 'Tomás Ibarra', isQueue: false },
      urgency: 'Critical',
      priority: '5. Blocker',
      description:
        'Since Friday around 14:00 UTC our payment webhooks return 502 on retry. First delivery succeeds maybe half the time; retries never do. Our reconciliation job depends on these, so we’re currently patching records by hand every morning.',
      timeline: [
        {
          id: 'tl-0101',
          kind: 'created',
          at: ago(4),
          side: 'system',
          author: { name: COLLEAGUE },
        },
        {
          id: 'tl-0102',
          kind: 'status',
          at: ago(3, 12),
          side: 'system',
          status: { fromLabel: 'Received', toLabel: 'In progress' },
        },
        {
          id: 'tl-0103',
          kind: 'comment',
          at: ago(1, 3),
          side: 'rp',
          author: { name: 'Tomás Ibarra' },
          bodyText:
            'Root cause found: the retry queue was pinned to a worker pool we drained during Friday’s maintenance. Fix is in review — retries should start flowing again once it deploys. We’ll replay the failed deliveries from the dead-letter queue after that.',
        },
      ],
      files: [],
    },
    {
      id: 'case-0003',
      caseNumber: '00012343',
      subject: 'Add a cost-center field to the expense export',
      status: 'Selected for Development',
      statusLabel: 'In progress',
      statusGroup: 'open',
      waitingOnYou: false,
      recordType: 'change',
      recordTypeLabel: 'Change request',
      createdAt: ago(12),
      lastActivityAt: ago(2, 8),
      lastModifiedAt: ago(2, 8),
      submittedBy: { name: 'Dana Whitfield' },
      owner: { name: 'Priya Raman', isQueue: false },
      description:
        'Our controllers allocate every expense line to a cost center, but the export only carries department. Adding the cost-center code (we can send the mapping) would remove a manual matching step that takes about half a day each month.',
      timeline: [
        {
          id: 'tl-0201',
          kind: 'created',
          at: ago(12),
          side: 'system',
          author: { name: 'Dana Whitfield' },
        },
        {
          id: 'tl-0202',
          kind: 'status',
          at: ago(2, 8),
          side: 'system',
          status: { fromLabel: 'In review', toLabel: 'In progress' },
        },
      ],
      files: [],
    },
    {
      id: 'case-0004',
      caseNumber: '00012344',
      subject: 'Read-only access for our external auditors',
      status: 'Waiting for Customer',
      statusLabel: 'Waiting on you',
      statusGroup: 'open',
      waitingOnYou: true,
      recordType: 'support',
      recordTypeLabel: 'Support request',
      createdAt: ago(3),
      lastActivityAt: ago(1, 6),
      lastModifiedAt: ago(1, 6),
      submittedBy: { name: 'Dana Whitfield' },
      owner: { name: 'Priya Raman', isQueue: false },
      description:
        'Harwood & Bell start our annual audit on the 15th. They need read-only access to invoices and payout reports — no exports, no settings. What’s the cleanest way to set that up?',
      timeline: [
        {
          id: 'tl-0301',
          kind: 'created',
          at: ago(3),
          side: 'system',
          author: { name: 'Dana Whitfield' },
        },
        {
          id: 'tl-0302',
          kind: 'comment',
          at: ago(1, 8),
          side: 'rp',
          author: { name: 'Priya Raman' },
          bodyText:
            'We can set up an “Auditor (read-only)” permission set scoped to invoices and payout reports. Two things from you: the auditors’ email addresses, and whether access should auto-expire when the audit wraps (we’d suggest yes — pick a date and we’ll set it).',
        },
        {
          id: 'tl-0303',
          kind: 'status',
          at: ago(1, 6),
          side: 'system',
          status: { fromLabel: 'In review', toLabel: 'Waiting on you' },
        },
      ],
      files: [],
    },
    {
      id: 'case-0005',
      caseNumber: '00012345',
      subject: 'Dashboard totals off by a day for UTC+ users',
      status: 'In UAT',
      statusLabel: 'In testing',
      statusGroup: 'open',
      waitingOnYou: false,
      recordType: 'problem',
      recordTypeLabel: 'Problem report',
      createdAt: ago(18),
      lastActivityAt: ago(0, 22),
      lastModifiedAt: ago(0, 22),
      submittedBy: { name: COLLEAGUE },
      owner: { name: 'Tomás Ibarra', isQueue: false },
      urgency: 'Medium',
      priority: '3. Medium',
      description:
        'Team members in Frankfurt and Singapore see daily revenue totals shifted by one day relative to the ledger. Looks like the dashboard buckets by UTC while the ledger uses the account timezone. US-based users see correct numbers.',
      timeline: [
        {
          id: 'tl-0401',
          kind: 'created',
          at: ago(18),
          side: 'system',
          author: { name: COLLEAGUE },
        },
        {
          id: 'tl-0402',
          kind: 'status',
          at: ago(2),
          side: 'system',
          status: { fromLabel: 'In progress', toLabel: 'In testing' },
        },
        {
          id: 'tl-0403',
          kind: 'comment',
          at: ago(0, 22),
          side: 'rp',
          author: { name: 'Tomás Ibarra' },
          bodyText:
            'The timezone fix is on the UAT environment now. If anyone on your Frankfurt team has 15 minutes to sanity-check Monday’s totals against the ledger, that would confirm it before we schedule the deploy.',
        },
      ],
      files: [],
      // Marcus submitted this; Dana is a CC'd participant → it appears in her
      // "My cases" even though she didn't submit it.
      participants: [marcusParticipant, danaParticipant],
    },
    {
      // Sensitive + Dana participates: she sees it (chip + banner), colleagues
      // outside the circle don't. Submitted by Marcus to prove the participant
      // path — not just the submitter path.
      id: 'case-0011',
      caseNumber: '00012347',
      subject: 'Payroll export includes former-employee salary lines',
      status: 'In Review',
      statusLabel: 'In review',
      statusGroup: 'open',
      waitingOnYou: false,
      recordType: 'support',
      recordTypeLabel: 'Support request',
      createdAt: ago(2),
      lastActivityAt: ago(0, 9),
      lastModifiedAt: ago(0, 9),
      submittedBy: { name: COLLEAGUE },
      owner: { name: 'Priya Raman', isQueue: false },
      sensitive: true,
      description:
        'The payroll export Marcus pulled Monday still carries salary lines for two people who left last quarter. HR asked us to keep this off the shared queue — Dana is added since she owns the reconciliation.',
      timeline: [
        {
          id: 'tl-1001',
          kind: 'created',
          at: ago(2),
          side: 'system',
          author: { name: COLLEAGUE },
        },
      ],
      files: [],
      participants: [marcusParticipant, danaParticipant],
    },
    {
      // Sensitive + Marcus only: the handlers hide this from Dana completely
      // (absent from lists/counts, 404 on direct navigation) — the fixture
      // that proves hiding, mirroring the API's server-side filter.
      id: 'case-0012',
      caseNumber: '00012348',
      subject: 'Access review for the finance director transition',
      status: 'New',
      statusLabel: 'Received',
      statusGroup: 'open',
      waitingOnYou: false,
      recordType: 'support',
      recordTypeLabel: 'Support request',
      createdAt: ago(1),
      lastActivityAt: ago(1),
      lastModifiedAt: ago(1),
      submittedBy: { name: COLLEAGUE },
      owner: { name: 'Client Success', isQueue: true },
      sensitive: true,
      description: 'Personnel change — details restricted to the submitter.',
      timeline: [],
      files: [],
      participants: [marcusParticipant],
    },
    {
      // Spec: one case with an intentionally empty timeline.
      id: 'case-0006',
      caseNumber: '00012346',
      subject: 'Runbook for the month-end close process',
      status: 'New',
      statusLabel: 'Received',
      statusGroup: 'open',
      waitingOnYou: false,
      recordType: 'other',
      recordTypeLabel: 'Documentation',
      createdAt: ago(0, 5),
      lastActivityAt: ago(0, 5),
      lastModifiedAt: ago(0, 5),
      submittedBy: { name: 'Dana Whitfield' },
      owner: { name: 'Client Success', isQueue: true },
      description:
        'Could you put together a short runbook for the month-end close steps on your side — export timing, cutoff rules, and who to ping if a step stalls? We’re onboarding two new analysts and want a canonical reference.',
      timeline: [],
      files: [],
    },

    // ---------------- Closed (4) ----------------
    {
      id: 'case-0007',
      caseNumber: '00012337',
      subject: 'Reset MFA for the finance team lead',
      status: 'Closed',
      statusLabel: 'Closed',
      statusGroup: 'closed',
      waitingOnYou: false,
      recordType: 'support',
      recordTypeLabel: 'Support request',
      createdAt: ago(31),
      lastActivityAt: ago(30, 18),
      lastModifiedAt: ago(30, 18),
      submittedBy: { name: 'Dana Whitfield' },
      owner: { name: 'Priya Raman', isQueue: false },
      description:
        'Our finance team lead replaced her phone and lost the authenticator seed. Can you reset MFA so she can re-enroll? Happy to verify identity however you need.',
      timeline: [
        {
          id: 'tl-0601',
          kind: 'created',
          at: ago(31),
          side: 'system',
          author: { name: 'Dana Whitfield' },
        },
        {
          id: 'tl-0602',
          kind: 'comment',
          at: ago(30, 20),
          side: 'rp',
          author: { name: 'Priya Raman' },
          bodyText:
            'Done — MFA reset after a verification call. She re-enrolled successfully at 16:20 ET. Closing this out; reopen if anything looks off.',
        },
        {
          id: 'tl-0603',
          kind: 'status',
          at: ago(30, 18),
          side: 'system',
          status: { fromLabel: 'In progress', toLabel: 'Closed' },
        },
      ],
      files: [],
    },
    {
      id: 'case-0008',
      caseNumber: '00012338',
      subject: 'Nightly sync stalls on large attachments',
      status: 'Closed',
      statusLabel: 'Closed',
      statusGroup: 'closed',
      waitingOnYou: false,
      recordType: 'problem',
      recordTypeLabel: 'Problem report',
      createdAt: ago(45),
      lastActivityAt: ago(38),
      lastModifiedAt: ago(38),
      submittedBy: { name: COLLEAGUE },
      owner: { name: 'Tomás Ibarra', isQueue: false },
      description:
        'The nightly document sync hangs whenever a source record carries an attachment over ~50 MB. The job never fails — it just sits until the morning restart, so everything behind it in the queue slips a day.',
      timeline: [
        {
          id: 'tl-0701',
          kind: 'created',
          at: ago(45),
          side: 'system',
          author: { name: COLLEAGUE },
        },
        {
          id: 'tl-0702',
          kind: 'status',
          at: ago(38),
          side: 'system',
          status: { fromLabel: 'Deployed', toLabel: 'Closed' },
        },
      ],
      files: [],
    },
    {
      id: 'case-0009',
      caseNumber: '00012339',
      subject: 'Rename “Vendor” to “Supplier” across the portal',
      status: 'Deployed',
      statusLabel: 'Deployed',
      statusGroup: 'closed',
      waitingOnYou: false,
      recordType: 'change',
      recordTypeLabel: 'Change request',
      createdAt: ago(52),
      lastActivityAt: ago(40),
      lastModifiedAt: ago(40),
      submittedBy: { name: 'Dana Whitfield' },
      owner: { name: 'Priya Raman', isQueue: false },
      description:
        'Procurement standardized on “Supplier” company-wide last quarter. Could the portal labels, exports, and email templates follow? It trips up new hires who search for the wrong term.',
      timeline: [
        {
          id: 'tl-0801',
          kind: 'created',
          at: ago(52),
          side: 'system',
          author: { name: 'Dana Whitfield' },
        },
        {
          id: 'tl-0802',
          kind: 'status',
          at: ago(40),
          side: 'system',
          status: { fromLabel: 'In testing', toLabel: 'Deployed' },
        },
      ],
      files: [],
    },
    {
      id: 'case-0010',
      caseNumber: '00012340',
      subject: 'Export permissions for the new controller',
      status: 'Closed',
      statusLabel: 'Closed',
      statusGroup: 'closed',
      waitingOnYou: false,
      recordType: 'support',
      recordTypeLabel: 'Support request',
      createdAt: ago(24),
      lastActivityAt: ago(23, 10),
      lastModifiedAt: ago(23, 10),
      submittedBy: { name: 'Dana Whitfield' },
      owner: { name: 'Client Success', isQueue: true },
      description:
        'Our new controller (started Monday) needs the same export permissions as the previous one — ledger exports and payout reports. Her account is already provisioned.',
      timeline: [
        {
          id: 'tl-0901',
          kind: 'created',
          at: ago(24),
          side: 'system',
          author: { name: 'Dana Whitfield' },
        },
        {
          id: 'tl-0902',
          kind: 'status',
          at: ago(23, 10),
          side: 'system',
          status: { fromLabel: 'Received', toLabel: 'Closed' },
        },
      ],
      files: [],
    },
  ]
}
