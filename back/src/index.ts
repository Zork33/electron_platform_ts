import { createBackendLifecycle } from './lifecycle.js'

async function main() {
  const lifecycle = createBackendLifecycle()
  await lifecycle.start()
  process.on('SIGINT', () => {
    void lifecycle.stop().then(() => process.exit(0))
  })
}

void main()
