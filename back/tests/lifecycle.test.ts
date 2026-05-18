import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { createBackendLifecycle } from '../src/lifecycle.js'
import { store } from '../src/store.js'

const originalPort = process.env.PORT

beforeEach(() => {
  store.reset()
  process.env.PORT = '0'
})

afterEach(() => {
  process.env.PORT = originalPort
})

describe('backend lifecycle', () => {
  test('tracks startup and shutdown state', async () => {
    const lifecycle = createBackendLifecycle()

    expect(lifecycle.getStatus()).toMatchObject({
      phase: 'idle',
      port: null,
      has_server: false,
      has_websocket_server: false,
      has_ping_timer: false,
      store_initialized: false,
    })

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await lifecycle.start()

    const running = lifecycle.getStatus()
    expect(running.phase).toBe('running')
    expect(running.port).toBe(0)
    expect(running.has_server).toBe(true)
    expect(running.has_websocket_server).toBe(true)
    expect(running.has_ping_timer).toBe(true)
    expect(running.store_initialized).toBe(true)

    await lifecycle.stop()

    expect(lifecycle.getStatus()).toMatchObject({
      phase: 'stopped',
      port: 0,
      has_server: false,
      has_websocket_server: false,
      has_ping_timer: false,
      store_initialized: true,
    })

    logSpy.mockRestore()
  })
})
