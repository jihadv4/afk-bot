const readline = require('readline')
const logger = require('./logger')
const { colors } = logger

class TerminalUI {
  constructor() {
    this.rl = null
    this.onChatInput = null
    this.onCommand = null
  }

  /**
   * Render visual gauge bar e.g. [████████░░] 16/20
   */
  renderBar(value = 0, max = 20, length = 10, lowThreshold = 5, medThreshold = 12) {
    const safeVal = Math.max(0, Math.min(value, max))
    const filledLength = Math.round((safeVal / max) * length)
    const emptyLength = length - filledLength

    const filledChar = '█'
    const emptyChar = '░'

    let color = colors.brightGreen
    if (safeVal <= lowThreshold) color = colors.brightRed
    else if (safeVal <= medThreshold) color = colors.brightYellow

    const barStr = color + filledChar.repeat(filledLength) + colors.gray + emptyChar.repeat(emptyLength) + colors.reset
    return `[${barStr}] ${Math.round(safeVal)}/${max}`
  }

  /**
   * Print a stylized status report block to console
   */
  printStatusReport(botState) {
    const { uptimeStr, health, food, pos, reconnectCount, isConnected, host, port, username, physicsEnabled } = botState

    const hpBar = this.renderBar(health ?? 0, 20, 10, 5, 10)
    const foodBar = this.renderBar(food ?? 0, 20, 10, 5, 10)

    const statusBadge = isConnected
      ? `${colors.bgGreen}${colors.brightWhite}${colors.bold} ONLINE ${colors.reset}`
      : `${colors.bgRed}${colors.brightWhite}${colors.bold} OFFLINE ${colors.reset}`

    const posX = pos ? pos.x.toFixed(1) : 'N/A'
    const posY = pos ? pos.y.toFixed(1) : 'N/A'
    const posZ = pos ? pos.z.toFixed(1) : 'N/A'

    console.log('')
    console.log(`${colors.cyan}┌─────────────────────────────────────────────────────────────┐${colors.reset}`)
    console.log(`${colors.cyan}│${colors.reset} 📊 ${colors.bold}${colors.brightWhite}MINECRAFT AFK BOT (TERMINAL ONLY)${colors.reset}   Status: ${statusBadge} ${colors.cyan}│${colors.reset}`)
    console.log(`${colors.cyan}├─────────────────────────────────────────────────────────────┤${colors.reset}`)
    console.log(`${colors.cyan}│${colors.reset} 👤 ${colors.bold}User:${colors.reset} ${colors.brightCyan}${username}${colors.reset}  | 🌐 ${colors.bold}Server:${colors.reset} ${colors.brightWhite}${host}:${port}${colors.reset}`)
    console.log(`${colors.cyan}│${colors.reset} ⏱️  ${colors.bold}Uptime:${colors.reset} ${colors.brightYellow}${uptimeStr}${colors.reset}  | 🔁 ${colors.bold}Reconnects:${colors.reset} ${colors.brightWhite}${reconnectCount}${colors.reset}`)
    console.log(`${colors.cyan}│${colors.reset} ❤️  ${colors.bold}Health:${colors.reset} ${hpBar}  | 🍖 ${colors.bold}Food:${colors.reset} ${foodBar}`)
    console.log(`${colors.cyan}│${colors.reset} 📍 ${colors.bold}Pos:${colors.reset} X: ${colors.brightWhite}${posX}${colors.reset}, Y: ${colors.brightWhite}${posY}${colors.reset}, Z: ${colors.brightWhite}${posZ}${colors.reset}  | ⚙️  ${colors.bold}Physics:${colors.reset} ${physicsEnabled ? `${colors.brightGreen}ON${colors.reset}` : `${colors.brightYellow}OFF (Safe)${colors.reset}`}`)
    console.log(`${colors.cyan}└─────────────────────────────────────────────────────────────┘${colors.reset}`)
    console.log('')
  }

  /**
   * Initialize interactive Readline input prompt in terminal
   */
  startInteractiveCLI(handlers = {}) {
    this.onChatInput = handlers.onChatInput
    this.onCommand = handlers.onCommand

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: `${colors.gray}> ${colors.reset}`,
    })

    this.rl.prompt()

    this.rl.on('line', (line) => {
      const input = line.trim()
      if (!input) {
        this.rl.prompt()
        return
      }

      // Check if it matches our internal commands
      const internalCommands = ['/help', '/status', '/reconnect', '/togglechat', '/physics', '/jump', '/sneak', '/quit', '/exit', '/say']
      const firstWord = input.split(' ')[0].toLowerCase()

      if (internalCommands.includes(firstWord)) {
        this.handleCommand(input)
      } else {
        // Send directly to Minecraft server (supports both plain text messages and in-game commands like /login, /spawn, etc.)
        if (this.onChatInput) {
          this.onChatInput(input)
        } else {
          logger.warn('Cannot send input: bot is not connected.')
        }
      }
      this.rl.prompt()
    })
  }

  handleCommand(rawCmd) {
    const parts = rawCmd.slice(1).split(' ')
    const cmd = parts[0].toLowerCase()
    const args = parts.slice(1)

    switch (cmd) {
      case 'help':
        console.log(`\n${colors.brightCyan}${colors.bold}💡 Available Terminal CLI Commands:${colors.reset}`)
        console.log(`  ${colors.yellow}/help${colors.reset}            - Show this help menu`)
        console.log(`  ${colors.yellow}/status${colors.reset}          - Display current bot dashboard status`)
        console.log(`  ${colors.yellow}/reconnect${colors.reset}       - Force bot reconnection`)
        console.log(`  ${colors.yellow}/say <msg>${colors.reset}       - Send a chat message to server`)
        console.log(`  ${colors.yellow}/togglechat${colors.reset}      - Toggle in-game chat visibility in terminal`)
        console.log(`  ${colors.yellow}/physics${colors.reset}        - Toggle Mineflayer physics simulation`)
        console.log(`  ${colors.yellow}/jump${colors.reset}           - Make bot jump once`)
        console.log(`  ${colors.yellow}/sneak${colors.reset}          - Make bot sneak/crouch for 1 second`)
        console.log(`  ${colors.yellow}/quit${colors.reset}            - Stop and exit the bot`)
        console.log(`  ${colors.gray}(Any other message or command like /login will be sent directly to the server)${colors.reset}\n`)
        break

      case 'status':
      case 'reconnect':
      case 'togglechat':
      case 'physics':
      case 'jump':
      case 'sneak':
        if (this.onCommand) this.onCommand(cmd, args)
        break

      case 'say':
        if (args.length > 0 && this.onChatInput) {
          this.onChatInput(args.join(' '))
        } else {
          logger.warn('Usage: /say <message>')
        }
        break

      case 'quit':
      case 'exit':
        if (this.onCommand) this.onCommand('quit', args)
        break

      default:
        if (this.onChatInput) {
          this.onChatInput(rawCmd)
        }
    }
  }
}

module.exports = new TerminalUI()
