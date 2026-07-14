import { expect, test } from '@playwright/test'

/**
 * Focused journeys beyond the core loop (journey.spec.ts): narrow-screen
 * cards, mark-as-resolved, session expiry, and read-only impersonation.
 * Same setup — production build + MSW browser mocks under the strict CSP.
 */

const SESSION_KEY = 'rp:workspace:session-jwt'

test('narrow screens get tappable cards instead of the table', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/login/callback?token=e2e-mobile')

  await expect(page.getByRole('heading', { name: 'Acme Corp · Cases' })).toBeVisible()
  const card = page.getByRole('link', { name: /Quarterly invoice shows duplicate line items/ })
  await expect(card).toBeVisible()
  await expect(page.getByRole('columnheader')).toHaveCount(0)

  await card.click()
  await expect(
    page.getByRole('heading', { name: 'Quarterly invoice shows duplicate line items' }),
  ).toBeVisible()
  await expect(page.getByLabel('Add a comment')).toBeVisible()
})

test('marking a case resolved posts the structured note', async ({ page }) => {
  await page.goto('/login/callback?token=e2e-resolve')
  // This case belongs to a colleague — switch to "All cases" to reach it.
  await page.getByRole('button', { name: /All cases/ }).click()
  await page.getByRole('link', { name: 'Payment webhook retries failing since Friday' }).click()
  await expect(page.getByRole('heading', { name: /Payment webhook retries/ })).toBeVisible()

  await page.getByRole('button', { name: 'Mark as resolved' }).click()
  await page.getByRole('button', { name: 'Post the note' }).click()

  await expect(page.getByText(/please close this case/)).toBeVisible()
  // The row resets — the team closes the case in Salesforce.
  await expect(page.getByRole('button', { name: 'Mark as resolved' })).toBeVisible()
})

test('an expired session lands on login with an explanation', async ({ page }) => {
  await page.addInitScript(
    ({ key, value }) => window.localStorage.setItem(key, value),
    {
      key: SESSION_KEY,
      value: JSON.stringify({
        jwt: 'expired-session-jwt',
        contact: {
          firstName: 'Dana',
          lastName: 'Whitfield',
          email: 'dana.whitfield@acmecorp.com',
          accountId: 'acct-acme-0001',
          accountName: 'Acme Corp',
        },
      }),
    },
  )

  await page.goto('/cases')

  await expect(page).toHaveURL(/\/login\?expired=1/)
  await expect(
    page.getByText('You were signed out. Sign in again to pick up where you left off.'),
  ).toBeVisible()
})

test('a case draft survives navigating away', async ({ page }) => {
  await page.goto('/login/callback?token=e2e-draft')
  await page.getByRole('link', { name: 'Create a case' }).click()
  await page.getByLabel('Subject').fill('Draft in progress')

  // Breadcrumb away, then come back.
  await page.getByRole('link', { name: 'Cases', exact: true }).click()
  await page.getByRole('link', { name: 'Create a case' }).click()

  await expect(page.getByLabel('Subject')).toHaveValue('Draft in progress')
  await expect(page.getByText(/Picked up where you left off/)).toBeVisible()
})

test('the case list defaults to "My cases" and can show all', async ({ page }) => {
  await page.goto('/login/callback?token=e2e-scope')
  await expect(page.getByRole('heading', { name: 'Acme Corp · Cases' })).toBeVisible()

  // Default: only the signed-in contact's own cases; a colleague's is hidden.
  await expect(page.getByRole('button', { name: /My cases/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Quarterly invoice shows duplicate line items')).toBeVisible()
  await expect(page.getByText('Payment webhook retries failing since Friday')).toBeHidden()

  // All cases reveals everyone's.
  await page.getByRole('button', { name: /All cases/ }).click()
  await expect(page.getByText('Payment webhook retries failing since Friday')).toBeVisible()
})

test('case participants: see, add, and remove colleagues', async ({ page }) => {
  await page.goto('/login/callback?token=e2e-participants')
  await page.getByRole('link', { name: 'Quarterly invoice shows duplicate line items' }).click()
  await expect(page.getByRole('heading', { name: /Quarterly invoice/ })).toBeVisible()

  const panel = page.getByRole('region', { name: 'Participants' })
  await expect(panel.getByText('Dana Whitfield')).toBeVisible()
  await expect(panel.getByText('you')).toBeVisible() // your own chip is locked
  await expect(panel.getByText('Marcus Feld')).toBeVisible()

  // Add a colleague, then remove Marcus.
  await panel.getByLabel('Add a colleague').selectOption('c-priya')
  await expect(panel.getByText('Priya Anand')).toBeVisible()
  await panel.getByRole('button', { name: /Remove Marcus Feld/ }).click()
  await expect(panel.getByText('Marcus Feld')).toBeHidden()
})

test('an email deep-link signs in and lands on the case', async ({ page }) => {
  // Fresh browser, no prior session — the token carries its own destination.
  await page.goto('/login/callback?token=deeplink:/cases/case-0002')

  await expect(page).toHaveURL(/\/cases\/case-0002$/)
  await expect(page.getByRole('heading', { name: /Payment webhook retries/ })).toBeVisible()
})

test('attachment preview opens under the strict CSP', async ({ page }) => {
  // The dev server strips the CSP; this runs against the built dist + real
  // CSP, so it proves blob: iframe/img preview isn't blocked in production.
  const cspViolations: string[] = []
  page.on('console', (msg) => {
    if (/content security policy/i.test(msg.text())) cspViolations.push(msg.text())
  })

  await page.goto('/login/callback?token=e2e-preview')
  await page.getByRole('link', { name: 'Quarterly invoice shows duplicate line items' }).click()
  await expect(page.getByRole('heading', { name: /Quarterly invoice/ })).toBeVisible()

  // The PDF attachment chip opens the preview dialog with a native PDF iframe.
  await page.getByRole('button', { name: /Preview duplicate-lines-annotated\.pdf/ }).first().click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Download' })).toBeVisible()
  await expect(dialog.locator('iframe')).toBeAttached()

  await page.getByRole('button', { name: 'Close preview' }).click()
  await expect(dialog).toBeHidden()

  expect(cspViolations, cspViolations.join('\n')).toHaveLength(0)
})

test('impersonation sessions act with attribution', async ({ page }) => {
  await page.goto('/login/callback?token=impersonate-token')

  // The acting-as banner names who you're acting as; the actor ("Devon Staff")
  // is shown in the header, and every write is attributed to them (asserted below).
  await expect(page.getByText('Acting as Dana Whitfield (Acme Corp)')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Create a case' })).toBeVisible()

  await page.getByRole('link', { name: 'Quarterly invoice shows duplicate line items' }).click()
  await expect(page.getByRole('heading', { name: /Quarterly invoice/ })).toBeVisible()

  // Comment while acting — lands RevenuePoint-side under the actor's name.
  await page.getByLabel('Add a comment').fill('Filed the workaround for you.')
  await page.getByRole('button', { name: 'Add comment' }).click()
  await expect(page.getByText('Filed the workaround for you.')).toBeVisible()
  // "Devon Staff" also shows in the header, so scope to the activity feed to
  // assert the COMMENT itself is attributed to the acting staff member.
  await expect(page.getByLabel('Activity').getByText('Devon Staff', { exact: true })).toBeVisible()

  // The create form is reachable while acting, too.
  await page.goto('/cases/new')
  await expect(page.getByRole('heading', { name: 'Create a case' })).toBeVisible()
})
