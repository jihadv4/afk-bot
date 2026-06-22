const mineflayer = require('mineflayer')

// ============================================================
//  CONFIG — edit these
// ============================================================
const CONFIG = {
  host: 'n1.ozima.cloud',
  port: 25590,
  username: 'RoPoint',
  reconnectDelay: 5000,      // base delay in ms (doubles each attempt, max 60s)
  antiAfkInterval: 30000,    // ms between anti-afk actions
  logChat: true,
}
// ============================================================

let bot = null
let reconnectTimer = null
let antiAfkTimer = null
let statusTimer = null
let startTime = null
let reconnectCount = 0
let isConnected = false

// ── Patch bad chat packets on any bot instance ───────────────
function patchClient(client) {
  const origEmit = client.emit.bind(client)
  client.emit = function(event, ...args) {
    try {
      return origEmit(event, ...args)
    } catch (e) {
      if (e.message && e.message.includes('unknown chat format code')) return false
      throw e
    }
  }
}

function createBot() {
  if (bot) {
    try { bot.quit() } catch (_) {}
    bot = null
  }

  isConnected = false

  bot = mineflayer.createBot({
    host: CONFIG.host,
    port: CONFIG.port,
    username: CONFIG.username,
    auth: 'offline',
    version: false,
    keepAlive: true,
    checkTimeoutInterval: 30000,
  })

  // Apply chat patch immediately on new bot
  patchClient(bot._client)

  // ── Spawn ──────────────────────────────────────────────────
  bot.once('spawn', () => {
    isConnected = true
    startTime = Date.now()
    reconnectCount === 0
      ? console.log(`\n✅  [${timestamp()}] Joined the server as ${CONFIG.username}`)
      : console.log(`\n✅  [${timestamp()}] Reconnected as ${CONFIG.username} (attempt #${reconnectCount})`)
    console.log(`    Server: ${CONFIG.host}:${CONFIG.port}\n`)

    startAntiAfk()
    startStatusPrinter()
  })

  // ── Chat ───────────────────────────────────────────────────
  bot.on('message', (jsonMsg) => {
    if (!CONFIG.logChat) return
    try {
      console.log(`💬  [${timestamp()}] ${jsonMsg.toString()}`)
    } catch (_) {}
  })

  // ── Health ─────────────────────────────────────────────────
  bot.on('health', () => {
    if (!isConnected) return
    if (bot.health <= 5) {
      console.log(`⚠️   [${timestamp()}] LOW HEALTH: ${Math.round(bot.health)}/20 | Food: ${bot.food}/20`)
    }
  })

  // ── Death + respawn ────────────────────────────────────────
  bot.on('death', () => {
    console.log(`💀  [${timestamp()}] Bot died — attempting respawn...`)
    try {
      bot.respawn()
      console.log(`✅  [${timestamp()}] Respawn sent`)
    } catch (e) {
      console.log(`⚠️   [${timestamp()}] Respawn failed: ${e.message}`)
    }
    setTimeout(() => {
      if (!isConnected) return
      try { bot.respawn() } catch (_) {}
    }, 3000)
  })

  // ── Kicked ────────────────────────────────────────────────
  bot.on('kicked', (reason) => {
    let msg = reason
    try { msg = JSON.parse(reason)?.text || reason } catch (_) {}
    console.log(`🚫  [${timestamp()}] Kicked: ${msg}`)
    handleDisconnect()
  })

  // ── Error ─────────────────────────────────────────────────
  bot.on('error', (err) => {
    if (err.message?.includes('unknown chat format code')) return
    if (err.message?.includes('ECONNREFUSED')) {
      console.log(`❌  [${timestamp()}] Server refused connection`)
    } else {
      console.log(`❌  [${timestamp()}] Error: ${err.message}`)
    }
    handleDisconnect()
  })

  // ── End ───────────────────────────────────────────────────
  bot.on('end', (reason) => {
    if (!isConnected && reason === 'disconnect.quitting') return
    console.log(`🔌  [${timestamp()}] Disconnected: ${reason}`)
    handleDisconnect()
  })
}

// ── Anti-AFK ──────────────────────────────────────────────────
function startAntiAfk() {
  stopAntiAfk()
  let tick = 0
  antiAfkTimer = setInterval(() => {
    if (!bot?.entity || !isConnected) return
    tick++
    try {
      if (tick % 2 === 0) {
        bot.look(
          bot.entity.yaw + (Math.random() * 0.4 - 0.2),
          bot.entity.pitch + (Math.random() * 0.1 - 0.05),
          false
        )
      } else {
        bot.setControlState('sneak', true)
        setTimeout(() => {
          try { bot.setControlState('sneak', false) } catch (_) {}
        }, 500)
      }
      console.log(`🔄  [${timestamp()}] Anti-AFK #${tick}`)
    } catch (e) {
      console.log(`⚠️   [${timestamp()}] Anti-AFK error: ${e.message}`)
    }
  }, CONFIG.antiAfkInterval)
}

function stopAntiAfk() {
  if (antiAfkTimer) { clearInterval(antiAfkTimer); antiAfkTimer = null }
}

// ── Status printer ────────────────────────────────────────────
function startStatusPrinter() {
  if (statusTimer) { clearInterval(statusTimer); statusTimer = null }
  statusTimer = setInterval(() => {
    if (!bot?.entity || !isConnected) return
    const pos = bot.entity.position
    console.log(
      `📊  [${timestamp()}] Uptime: ${formatUptime(Date.now() - startTime)} | ` +
      `HP: ${Math.round(bot.health ?? 0)}/20 | Food: ${bot.food ?? 0}/20 | ` +
      `Pos: (${pos.x.toFixed(0)}, ${pos.y.toFixed(0)}, ${pos.z.toFixed(0)})`
    )
  }, 60000)
}

// ── Disconnect handler ────────────────────────────────────────
function handleDisconnect() {
  if (reconnectTimer) return
  isConnected = false
  stopAntiAfk()
  if (statusTimer) { clearInterval(statusTimer); statusTimer = null }
  scheduleReconnect()
}

// ── Exponential backoff reconnect ─────────────────────────────
function scheduleReconnect() {
  reconnectCount++
  const delay = Math.min(CONFIG.reconnectDelay * Math.pow(1.5, reconnectCount - 1), 60000)
  console.log(`🔁  [${timestamp()}] Reconnecting in ${(delay / 1000).toFixed(0)}s... (attempt #${reconnectCount})`)
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    createBot()
  }, delay)
}

// ── Helpers ───────────────────────────────────────────────────
function timestamp() {
  return new Date().toLocaleTimeString('en-US', { hour12: false })
}

function formatUptime(ms) {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${h}h ${m}m ${sec}s`
}

// ── Graceful shutdown ─────────────────────────────────────────
process.on('SIGINT', () => {
  console.log(`\n👋  [${timestamp()}] Shutting down bot...`)
  stopAntiAfk()
  if (statusTimer) clearInterval(statusTimer)
  if (reconnectTimer) clearTimeout(reconnectTimer)
  try { bot?.quit('Goodbye!') } catch (_) {}
  process.exit(0)
})

process.on('uncaughtException', (err) => {
  if (err.message?.includes('unknown chat format code')) return
  console.log(`💥  [${timestamp()}] Uncaught exception: ${err.message}`)
  handleDisconnect()
})

// ── Start ─────────────────────────────────────────────────────
console.log('🚀  AFK Bot starting...')
console.log(`    Server : ${CONFIG.host}:${CONFIG.port}`)
console.log(`    Username: ${CONFIG.username}\n`)
createBot()
