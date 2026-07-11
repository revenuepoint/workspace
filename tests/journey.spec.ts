import { expect, test } from '@playwright/test'

/**
 * The core client journey, end to end against the production build + MSW
 * browser mocks: sign in via magic link → case list → open a case →
 * add a comment → create a new case.
 */
test('login → list → case detail → comment → create case', async ({ page }) => {
  // --- /login: request a magic link -------------------------------------
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Sign in to your workspace' })).toBeVisible()
  await page.getByLabel('Email').fill('dana.whitfield@acmecorp.com')
  await page.getByRole('button', { name: 'Send link' }).click()
  await expect(page.getByText('Check your inbox at')).toBeVisible()
  await expect(page.getByText('The link expires in 15 minutes.')).toBeVisible()

  // --- /login/callback: complete the link -------------------------------
  await page.goto('/login/callback?token=e2e-demo-token')

  // --- /cases: the default landing (defaults to "My cases") --------------
  await expect(page.getByRole('heading', { name: 'Acme Corp · Cases' })).toBeVisible()
  await expect(page.getByRole('button', { name: /My cases/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: /Open \(5\)/ })).toBeVisible()
  await expect(page.getByText('00012341')).toBeVisible()

  // Closed filter swaps the rows (Dana has 3 closed)
  await page.getByRole('button', { name: /Closed \(3\)/ }).click()
  await expect(page.getByText('00012337')).toBeVisible()
  await page.getByRole('button', { name: /Open \(5\)/ }).click()

  // --- case detail ---------------------------------------------------------
  await page.getByRole('link', { name: 'Quarterly invoice shows duplicate line items' }).click()
  await expect(page.getByRole('heading', { name: 'Quarterly invoice shows duplicate line items' })).toBeVisible()
  // Progress path + urgency/priority readout on the detail header.
  await expect(page.getByRole('navigation', { name: 'Case progress' })).toBeVisible()
  await expect(page.getByText(/Urgency/)).toBeVisible()
  await expect(page.getByText(/Priority/)).toBeVisible()
  await expect(page.getByText('Received → In review')).toBeVisible()
  await expect(page.getByText('Re: Quarterly invoice shows duplicate line items [ref:00012341]')).toBeVisible()

  // Expand the clamped email
  await page.getByRole('button', { name: 'Show full email' }).click()
  await expect(page.getByRole('button', { name: 'Show less' })).toBeVisible()

  // --- add a comment ---------------------------------------------------------
  await page.getByLabel('Add a comment').fill('Workaround confirmed — March totals reconcile now.')
  await page.getByRole('button', { name: 'Add comment' }).click()
  await expect(page.getByText('Workaround confirmed — March totals reconcile now.')).toBeVisible()

  // --- create a case -----------------------------------------------------------
  await page.getByRole('link', { name: 'Cases', exact: true }).click()
  await page.getByRole('link', { name: 'Create a case' }).click()
  await expect(page.getByRole('heading', { name: 'Create a case' })).toBeVisible()

  // Impact/urgency ride along on every record type now.
  await expect(page.getByLabel('Impact')).toBeVisible()
  await page.getByRole('radio', { name: /Something.s broken/ }).click()
  await expect(page.getByLabel('Impact')).toBeVisible()

  await page.getByLabel('Subject').fill('Ledger export hangs at 99%')
  await page
    .getByLabel('Description')
    .fill('Since Tuesday the nightly ledger export stalls at 99% and never completes. No error shown.')
  await page.getByLabel('Urgency').selectOption('High')
  await page.getByRole('button', { name: 'Send to RevenuePoint' }).click()

  // Success screen with the new case number, then through to the detail page
  await expect(page.getByText('Case created')).toBeVisible()
  const caseNumber = await page.getByRole('heading', { level: 1 }).textContent()
  expect(caseNumber).toMatch(/#\d{8}/)
  await page.getByRole('link', { name: 'View case' }).click()
  await expect(page.getByRole('heading', { name: 'Ledger export hangs at 99%' })).toBeVisible()
  // "Received" now appears in both the status chip and the progress path's
  // first stage — the chip is the one this assertion cares about.
  await expect(page.getByText('Received', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Case progress' })).toBeVisible()
})
