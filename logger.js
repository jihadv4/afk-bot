const EventEmitter = require('events')

class Logger extends EventEmitter {
  constructor() {
    super()
    this.enabled = true
    this.logChat = true
    this.colors = Logger.colors
  }

  // ANSI escape codes for styling
  static colors = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    italic: '\x1b[3m',
    underline: '\x1b[4m',

    // Foreground colors
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m',
    brightRed: '\x1b[91m',
    brightGreen: '\x1b[92m',
    brightYellow: '\x1b[93m',
    brightBlue: '\x1b[94m',
    brightMagenta: '\x1b[95m',
    brightCyan: '\x1b[96m',
    brightWhite: '\x1b[97m',

    // Background colors
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m',
    bgMagenta: '\x1b[45m',
    bgCyan: '\x1b[46m',
  }

  timestamp() {
    const d = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    return `${date} ${time}`
  }

  /**
   * Strip raw Minecraft § formatting code symbols
   */
  stripMinecraftCodes(text) {
    if (typeof text !== 'string') return text
    return text.replace(/§[0-9a-fk-or]/gi, '')
  }

  /**
   * Convert Minecraft § color codes into terminal ANSI color escape codes
   */
  minecraftToAnsi(text) {
    if (typeof text !== 'string') return text
    const mcMap = {
      '0': Logger.colors.gray,          // Black / Dark Gray
      '1': Logger.colors.blue,          // Dark Blue
      '2': Logger.colors.green,         // Dark Green
      '3': Logger.colors.cyan,          // Dark Aqua
      '4': Logger.colors.red,           // Dark Red
      '5': Logger.colors.magenta,       // Dark Purple
      '6': Logger.colors.yellow,        // Gold
      '7': Logger.colors.gray,          // Gray
      '8': Logger.colors.dim,           // Dark Gray
      '9': Logger.colors.brightBlue,    // Blue
      'a': Logger.colors.brightGreen,   // Green
      'b': Logger.colors.brightCyan,    // Aqua
      'c': Logger.colors.brightRed,     // Red
      'd': Logger.colors.brightMagenta, // Light Purple
      'e': Logger.colors.brightYellow,  // Yellow
      'f': Logger.colors.white,         // White
      'l': Logger.colors.bold,          // Bold
      'o': Logger.colors.italic,        // Italic
      'r': Logger.colors.reset,         // Reset
    }

    let result = text.replace(/§([0-9a-fk-or])/gi, (_, code) => {
      const lower = code.toLowerCase()
      return mcMap[lower] || ''
    })

    return result + Logger.colors.reset
  }

  emitLog(level, message, cleanMessage, rawDetails = null) {
    const timeStr = `${Logger.colors.gray}[${this.timestamp()}]${Logger.colors.reset}`
    const payload = {
      timestamp: this.timestamp(),
      level,
      message: cleanMessage || message,
      rawDetails,
    }

    // Emit log event for terminal listeners
    this.emit('log', payload)

    return `${timeStr} ${message}`
  }

  system(msg) {
    const badge = `${Logger.colors.brightCyan}${Logger.colors.bold}[SYSTEM]${Logger.colors.reset}`
    const text = `${Logger.colors.brightWhite}${msg}${Logger.colors.reset}`
    const formatted = this.emitLog('system', `${badge} ${text}`, `[SYSTEM] ${msg}`)
    console.log(formatted)
  }

  success(msg) {
    const badge = `${Logger.colors.brightGreen}${Logger.colors.bold}[SUCCESS]${Logger.colors.reset}`
    const text = `${Logger.colors.green}${msg}${Logger.colors.reset}`
    const formatted = this.emitLog('success', `${badge} ${text}`, `[SUCCESS] ${msg}`)
    console.log(formatted)
  }

  chat(msg) {
    if (!this.logChat) return
    const badge = `${Logger.colors.brightMagenta}${Logger.colors.bold}[CHAT]${Logger.colors.reset}`
    const colorizedText = this.minecraftToAnsi(msg)
    const cleanText = this.stripMinecraftCodes(msg)
    const formatted = this.emitLog('chat', `${badge} ${colorizedText}`, `[CHAT] ${cleanText}`)
    console.log(formatted)
  }

  warn(msg) {
    const badge = `${Logger.colors.brightYellow}${Logger.colors.bold}[WARN]${Logger.colors.reset}`
    const text = `${Logger.colors.yellow}${msg}${Logger.colors.reset}`
    const formatted = this.emitLog('warn', `${badge} ${text}`, `[WARN] ${msg}`)
    console.log(formatted)
  }

  error(msg) {
    const badge = `${Logger.colors.brightRed}${Logger.colors.bold}[ERROR]${Logger.colors.reset}`
    const text = `${Logger.colors.red}${msg}${Logger.colors.reset}`
    const formatted = this.emitLog('error', `${badge} ${text}`, `[ERROR] ${msg}`)
    console.log(formatted)
  }

  status(msg) {
    const badge = `${Logger.colors.brightBlue}${Logger.colors.bold}[STATUS]${Logger.colors.reset}`
    const text = `${Logger.colors.cyan}${msg}${Logger.colors.reset}`
    const formatted = this.emitLog('status', `${badge} ${text}`, `[STATUS] ${msg}`)
    console.log(formatted)
  }
}

const loggerInstance = new Logger()
loggerInstance.colors = Logger.colors
module.exports = loggerInstance
