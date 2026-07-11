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

test('impersonation sessions act with attribution', async ({ page }) => {
  await page.goto('/login/callback?token=impersonate-token')

  await expect(
    page.getByText(
      'Acting as Dana Whitfield (Acme Corp) — you are Devon Staff; actions are recorded as RevenuePoint',
    ),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Create a case' })).toBeVisible()

  await page.getByRole('link', { name: 'Quarterly invoice shows duplicate line items' }).click()
  await expect(page.getByRole('heading', { name: /Quarterly invoice/ })).toBeVisible()

  // Comment while acting — lands RevenuePoint-side under the actor's name.
  await page.getByLabel('Add a comment').fill('Filed the workaround for you.')
  await page.getByRole('button', { name: 'Add comment' }).click()
  await expect(page.getByText('Filed the workaround for you.')).toBeVisible()
  // exact: the banner also contains the actor's name as a substring.
  await expect(page.getByText('Devon Staff', { exact: true })).toBeVisible()

  // The create form is reachable while acting, too.
  await page.goto('/cases/new')
  await expect(page.getByRole('heading', { name: 'Create a case' })).toBeVisible()
})
