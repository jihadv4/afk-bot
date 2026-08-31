# 🤖 Minecraft AFK Bot

A terminal-based Minecraft AFK bot built with [mineflayer](https://github.com/PrismarineJS/mineflayer). Keeps your player online on a server with an interactive CLI, auto-reconnect, colorized chat logs, and built-in GrimAC anti-cheat bypass.

![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?logo=node.js)
![Minecraft](https://img.shields.io/badge/Minecraft-1.21-brightgreen?logo=mojangstudios)
![License](https://img.shields.io/badge/License-ISC-blue)

---

## ✨ Features

- **AFK Presence** — Stays connected and keeps your player online
- **Interactive Terminal CLI** — Send chat messages, run commands, and control the bot from your terminal
- **Colorized Chat** — Minecraft `§` color codes rendered as ANSI terminal colors
- **Auto Reconnect** — Exponential backoff reconnection on disconnect/kick
- **Live Status Dashboard** — Health, food, position, uptime at a glance
- **GrimAC Bypass** — Movement packet throttling to prevent TickTimer violations
- **Death Auto-Respawn** — Automatically respawns on death
- **Low Health Alerts** — Warns when HP drops below 5

---

## 📋 Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- npm (comes with Node.js)

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/jihadv4/afk-bot.git
cd afk-bot
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure the bot

Open `bot.js` and edit the `CONFIG` object at the top:

```js
const CONFIG = {
  host: 'your.server.address',    // Server IP or hostname
  port: 25565,                     // Server port
  username: 'YourUsername',        // Bot's username (offline mode)
  version: '1.21.10',             // Minecraft version
  reconnectDelay: 5000,           // Base reconnect delay (ms)
  logChat: true,                  // Show chat messages in terminal
  statusIntervalMs: 30000,        // Status report interval (ms)
  physicsEnabled: false,          // Keep false to avoid anti-cheat flags
}
```

### 4. Start the bot

```bash
npm start
```

---

## 💻 Terminal CLI Commands

Once the bot is running, type commands directly in the terminal:

| Command | Description |
|---|---|
| `/help` | Show all available commands |
| `/status` | Display the bot status dashboard |
| `/reconnect` | Force disconnect and reconnect |
| `/say <message>` | Send a chat message to the server |
| `/togglechat` | Toggle chat message visibility in terminal |
| `/physics` | Toggle mineflayer physics simulation |
| `/jump` | Make the bot jump once |
| `/sneak` | Make the bot sneak for 1 second |
| `/quit` | Gracefully shut down the bot |

> **Tip:** Any text that doesn't start with a CLI command (like `/help`) is sent directly to the server. This means you can type regular chat messages or in-game commands like `/login`, `/spawn`, `/tpa`, etc.

---

## 🏗️ Project Structure

```
afkbot/
├── bot.js          # Main bot logic, config, event handlers, anti-cheat patch
├── logger.js       # Colorized logger with Minecraft § code support
├── terminalUI.js   # Interactive terminal CLI and status dashboard
├── package.json    # Dependencies and scripts
└── README.md       # This file
```

### Module Overview

| File | Purpose |
|---|---|
| **`bot.js`** | Creates the mineflayer bot, handles spawn/death/kick/disconnect events, patches the client for anti-cheat compatibility, and wires up the terminal CLI |
| **`logger.js`** | Provides timestamped, color-coded log levels (`SYSTEM`, `SUCCESS`, `CHAT`, `WARN`, `ERROR`, `STATUS`) and converts Minecraft `§` formatting codes to ANSI |
| **`terminalUI.js`** | Manages readline-based interactive input, routes CLI commands, and renders the visual status dashboard with health/food gauge bars |

---

## 🛡️ Anti-Cheat (GrimAC) Bypass

The bot includes a client-level packet throttle that prevents **GrimAC TickTimer** violations:

- **Problem:** Mineflayer's physics loop can burst multiple movement packets in a single Node.js event-loop tick when timer jitter occurs. GrimAC counts all movement packet types (`flying`, `position`, `position_look`, `look`) and flags players who exceed the expected 20 TPS rate.

- **Solution:** All outgoing movement packets are rate-limited to **1 per 50ms** (matching vanilla Minecraft's tick rate). Physics simulation is disabled by default to prevent client-side gravity from generating conflicting packets.

---

## ⚙️ Configuration Reference

| Option | Type | Default | Description |
|---|---|---|---|
| `host` | `string` | — | Server hostname or IP |
| `port` | `number` | `25565` | Server port |
| `username` | `string` | — | Bot username (offline/cracked) |
| `version` | `string` | `'1.21.10'` | Minecraft version string |
| `reconnectDelay` | `number` | `5000` | Base delay before reconnect (ms) |
| `logChat` | `boolean` | `true` | Print chat messages to terminal |
| `statusIntervalMs` | `number` | `30000` | Auto status report interval (ms) |
| `physicsEnabled` | `boolean` | `false` | Enable mineflayer physics engine |

---

## 📝 License

ISC
