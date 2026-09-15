import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { once } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'

export async function startProductionServer() {
  const reservation = createServer()
  reservation.listen(0, '127.0.0.1')
  await once(reservation, 'listening')
  const port = reservation.address().port
  await new Promise(resolve => reservation.close(resolve))
  const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  let logs = ''
  child.stdout.on('data', chunk => { logs += chunk })
  child.stderr.on('data', chunk => { logs += chunk })
  const origin = `http://127.0.0.1:${port}`
  const close = async () => {
    if (child.exitCode !== null) return
    const exited = once(child, 'exit')
    child.kill()
    await exited
  }
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(`Next exited before startup: ${logs}`)
    try {
      const response = await fetch(origin, { signal: AbortSignal.timeout(1000) })
      if (response.ok) return { origin, close }
    } catch { /* Wait for the local server to listen. */ }
    await delay(250)
  }
  await close()
  throw new Error(`Next startup timed out: ${logs}`)
}
