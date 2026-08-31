const mineflayer = require('mineflayer')
const logger = require('./logger')
const terminalUI = require('./terminalUI')

const CONFIG = {
  host: 'node-2.banglaverse.net',
  port: 25756,
  username: 'RoPoint',
  version: '1.21.10',
  reconnectDelay: 5000,
  logChat: true,
  statusIntervalMs: 30000,
  physicsEnabled: false, // Disabled: prevents client-side gravity simulation from sending conflicting fly/falling packets
}

let bot = null
let reconnectTimer = null
let statusTimer = null
let startTime = null
let reconnectCount = 0
let isConnected = false

logger.logChat = CONFIG.logChat

function formatUptime(ms) {
  if (!ms) return '0h 0m 0s'
  const seconds = Math.floor((ms / 1000) % 60)
  const minutes = Math.floor((ms / (1000 * 60)) % 60)
  const hours = Math.floor(ms / (1000 * 60 * 60))
  return `${hours}h ${minutes}m ${seconds}s`
}

function getBotState() {
  const pos = bot?.entity?.position || null
  return {
    isConnected,
    reconnectCount,
    host: CONFIG.host,
    port: CONFIG.port,
    username: CONFIG.username,
    uptimeStr: startTime && isConnected ? formatUptime(Date.now() - startTime) : '0h 0m 0s',
    health: bot?.health ?? 0,
    food: bot?.food ?? 0,
    pos: pos ? { x: pos.x, y: pos.y, z: pos.z } : null,
    logChat: logger.logChat,
    physicsEnabled: bot?.physicsEnabled ?? CONFIG.physicsEnabled,
  }
}

function sendBotChat(msg) {
  if (!bot || !isConnected) {
    logger.warn('Cannot send message: Bot is not connected.')
    return false
  }
  try {
    bot.chat(msg)
    if (!msg.startsWith('/')) {
      logger.chat(`<${CONFIG.username}> ${msg}`)
    } else {
      logger.system(`Sent command: ${msg}`)
    }
    return true
  } catch (err) {
    logger.error(`Failed to send message: ${err.message}`)
    return false
  }
}

const { performance } = require('perf_hooks')

function patchClient(client) {
  if (!client) return

  const origEmit = client.emit.bind(client)
  client.emit = function (event, ...args) {
    try {
      return origEmit(event, ...args)
    } catch (e) {
      if (e.message && e.message.includes('unknown chat format code')) return false
      throw e
    }
  }

  // GrimAC / Anti-Cheat TickTimer & Flying Packet Protection
  // Mineflayer's physics engine catchup loop sends multiple movement packets in a single event loop tick
  // whenever Node.js timer jitter occurs. Vanilla clients never send > 1 movement packet per 50ms tick.
  // GrimAC counts ALL movement packet types (flying, position, position_look, look) toward its
  // TickTimer balance. Throttling ALL movement packets to 1-per-tick prevents balance buildup.
  let lastMovementPacketTime = 0
  const TICK_MS = 50 // Vanilla Minecraft tick rate: 20 TPS = 50ms per tick
  const origWrite = client.write.bind(client)
  client.write = function (name, params) {
    if (name === 'flying' || name === 'position' || name === 'position_look' || name === 'look') {
      const now = performance.now()
      const timeSinceLast = now - lastMovementPacketTime

      // Drop ANY movement packet if less than one full tick (50ms) has passed.
      // This prevents GrimAC TickTimer from accumulating extra packet credits.
      if (timeSinceLast < TICK_MS) {
        return
      }

      lastMovementPacketTime = now
    }
    return origWrite(name, params)
  }
}

function createBot() {
  if (bot) {
    try { bot.quit() } catch (_) {}
    bot = null
  }

  isConnected = false
  logger.system(`Connecting to ${CONFIG.host}:${CONFIG.port} as ${CONFIG.username}...`)

  const botOptions = {
    host: CONFIG.host,
    port: CONFIG.port,
    username: CONFIG.username,
    version: CONFIG.version,
    auth: 'offline',
    keepAlive: true,
    checkTimeoutInterval: 30000,
    physicsEnabled: CONFIG.physicsEnabled,
  }

  bot = mineflayer.createBot(botOptions)

  patchClient(bot._client)

  bot.once('spawn', () => {
    bot.physicsEnabled = CONFIG.physicsEnabled
    isConnected = true
    startTime = Date.now()

    if (reconnectCount === 0) {
      logger.success(`Joined the server as ${CONFIG.username}`)
    } else {
      logger.success(`Reconnected as ${CONFIG.username} (attempt #${reconnectCount})`)
    }

    startStatusPrinter()
    terminalUI.printStatusReport(getBotState())
  })

  // Player chat messages — username is provided directly by mineflayer
  bot.on('chat', (username, message) => {
    if (username === bot.username) return
    logger.chat(`<${username}> ${message}`)
  })

  // System / non-player messages (join/leave, server announcements, etc.)
  bot.on('message', (jsonMsg, position) => {
    // Skip 'chat' position to avoid duplicating player messages handled above
    if (position === 'chat') return
    try {
      const rawText = jsonMsg.toString()
      if (rawText && rawText.trim()) {
        logger.chat(rawText)
      }
    } catch (_) {}
  })

  bot.on('health', () => {
    if (!isConnected) return
    if (bot.health <= 5) {
      logger.warn(`LOW HEALTH: ${Math.round(bot.health)}/20 | Food: ${bot.food}/20`)
    }
  })

  bot.on('death', () => {
    logger.error('Bot died — attempting respawn...')
    try {
      bot.respawn()
      logger.success('Respawn command sent')
    } catch (e) {
      logger.warn(`Respawn failed: ${e.message}`)
    }

    setTimeout(() => {
      if (!isConnected) return
      try { bot.respawn() } catch (_) {}
    }, 3000)
  })

  bot.on('kicked', (reason) => {
    let msg = reason
    if (reason && typeof reason === 'object') {
      msg = reason.text || reason.message || JSON.stringify(reason)
    } else if (typeof reason === 'string') {
      try {
        const parsed = JSON.parse(reason)
        msg = parsed?.text || parsed?.message || reason
      } catch (_) {}
    }

    logger.error(`Kicked from server: ${logger.stripMinecraftCodes(msg)}`)
    handleDisconnect()
  })

  bot.on('error', (err) => {
    if (err.message?.includes('unknown chat format code')) return
    if (err.message?.includes('ECONNREFUSED')) {
      logger.error('Server refused connection')
    } else {
      logger.error(`Connection Error: ${err.message}`)
    }
    handleDisconnect()
  })

  bot.on('end', (reason) => {
    if (!isConnected && reason === 'disconnect.quitting') return
    logger.warn(`Disconnected: ${reason}`)
    handleDisconnect()
  })
}

function startStatusPrinter() {
  if (statusTimer) { clearInterval(statusTimer); statusTimer = null }
  statusTimer = setInterval(() => {
    if (!bot?.entity || !isConnected) return
    const state = getBotState()
    logger.status(
      `Uptime: ${state.uptimeStr} | HP: ${Math.round(state.health)}/20 | Food: ${state.food}/20 | ` +
      `Pos: (${state.pos?.x?.toFixed(0)}, ${state.pos?.y?.toFixed(0)}, ${state.pos?.z?.toFixed(0)})`
    )
  }, CONFIG.statusIntervalMs)
}

function handleDisconnect() {
  if (reconnectTimer) return
  isConnected = false
  if (statusTimer) { clearInterval(statusTimer); statusTimer = null }
  scheduleReconnect()
}

function scheduleReconnect() {
  reconnectCount++
  const delay = Math.min(CONFIG.reconnectDelay * Math.pow(1.5, reconnectCount - 1), 60000)
  logger.warn(`Reconnecting in ${(delay / 1000).toFixed(0)}s... (attempt #${reconnectCount})`)

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    createBot()
  }, delay)
}

function shutdown() {
  logger.system('Shutting down bot gracefully...')
  if (statusTimer) clearInterval(statusTimer)
  if (reconnectTimer) clearTimeout(reconnectTimer)
  try { bot?.quit('Goodbye!') } catch (_) {}
  process.exit(0)
}

process.on('SIGINT', () => {
  shutdown()
})

process.on('uncaughtException', (err) => {
  if (err.message?.includes('unknown chat format code')) return
  logger.error(`Uncaught exception: ${err.message}`)
  handleDisconnect()
})

// Initialize Interactive Terminal CLI
terminalUI.startInteractiveCLI({
  onChatInput: sendBotChat,
  onCommand: (cmd, args) => {
    if (cmd === 'status') {
      terminalUI.printStatusReport(getBotState())
    } else if (cmd === 'reconnect') {
      logger.system('Reconnect requested via CLI')
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
      createBot()
    } else if (cmd === 'togglechat') {
      logger.logChat = !logger.logChat
      logger.system(`Chat logging ${logger.logChat ? 'enabled' : 'disabled'}`)
    } else if (cmd === 'physics') {
      if (bot) {
        bot.physicsEnabled = !bot.physicsEnabled
        logger.system(`Bot physics simulation: ${bot.physicsEnabled ? 'ENABLED' : 'DISABLED'}`)
      } else {
        logger.warn('Bot is not currently initialized.')
      }
    } else if (cmd === 'jump') {
      if (bot && isConnected) {
        bot.setControlState('jump', true)
        setTimeout(() => bot.setControlState('jump', false), 350)
        logger.system('Bot jumped')
      } else {
        logger.warn('Bot is not connected')
      }
    } else if (cmd === 'sneak') {
      if (bot && isConnected) {
        bot.setControlState('sneak', true)
        setTimeout(() => bot.setControlState('sneak', false), 1000)
        logger.system('Bot sneaked')
      } else {
        logger.warn('Bot is not connected')
      }
    } else if (cmd === 'quit') {
      shutdown()
    }
  },
})

// Launch Bot
logger.system('Terminal AFK Bot Ready. Starting mineflayer instance...')
createBot()
