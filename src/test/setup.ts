import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { cleanup } from '@testing-library/react'
import { server } from '@/mocks/node'
import { resetMockDb } from '@/mocks/handlers'
import { useSessionStore } from '@/stores/session'

// jsdom's File/FormData can't be streamed by Node's native (undici) fetch —
// `request.formData()` inside MSW handlers hangs forever on them. Vitest keeps
// Node's fetch/Response in the jsdom sandbox, so recover the FormData/File
// classes that fetch actually understands by parsing a tiny multipart Response,
// and use those globally. Multipart uploads then round-trip like in a browser.
const nativeClassProbe = await new Response(
  '--b\r\ncontent-disposition: form-data; name="f"; filename="x.txt"\r\ncontent-type: text/plain\r\n\r\nhi\r\n--b--\r\n',
  { headers: { 'content-type': 'multipart/form-data; boundary=b' } },
).formData()
globalThis.FormData = nativeClassProbe.constructor as typeof FormData
globalThis.File = (nativeClassProbe.get('f') as File).constructor as typeof File

// jsdom doesn't implement scrollTo; the create-form success screen calls it.
window.scrollTo = () => {}

// jsdom lacks ResizeObserver (Radix radio-group's hidden form input measures itself).
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = window.ResizeObserver ?? (ResizeObserverStub as unknown as typeof ResizeObserver)

// Tests ALWAYS run against MSW (node interception) — never a live API.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

afterEach(() => {
  cleanup()
  server.resetHandlers()
  resetMockDb()
  window.localStorage.clear()
  useSessionStore.setState({ jwt: null, contact: null, expired: false })
})

afterAll(() => server.close())
