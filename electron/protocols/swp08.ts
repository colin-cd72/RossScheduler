import * as net from 'net'
import { EventEmitter } from 'events'

// SW-P-08 Protocol Constants
const SOM = 0x10 // Start of Message
const EOM = 0x10 // End of Message (followed by EOM2)
const EOM2 = 0x11 // Second byte of EOM sequence
const COMMAND_CONNECT = 0x02 // Connect command
const COMMAND_INTERROGATE = 0x61 // Interrogate crosspoints

export interface SWP08Options {
  host: string
  port: number
  matrix?: number // Matrix number (default 0)
  level?: number // Level (default 0 for all levels)
  reconnectInterval?: number
  timeout?: number
}

export class SWP08Client extends EventEmitter {
  private host: string
  private port: number
  private matrix: number
  private level: number
  private socket: net.Socket | null = null
  private connected = false
  private reconnectInterval: number
  private timeout: number
  private reconnectTimer: NodeJS.Timeout | null = null
  private responseBuffer: Buffer = Buffer.alloc(0)

  constructor(options: SWP08Options) {
    super()
    this.host = options.host
    this.port = options.port
    this.matrix = options.matrix ?? 0
    this.level = options.level ?? 0
    this.reconnectInterval = options.reconnectInterval ?? 5000
    this.timeout = options.timeout ?? 5000
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.connected && this.socket) {
        resolve()
        return
      }

      this.socket = new net.Socket()
      this.socket.setTimeout(this.timeout)

      const cleanup = () => {
        this.socket?.removeAllListeners('error')
        this.socket?.removeAllListeners('timeout')
      }

      this.socket.once('connect', () => {
        this.connected = true
        this.emit('connected')
        cleanup()
        resolve()
      })

      this.socket.once('error', (err) => {
        cleanup()
        reject(err)
      })

      this.socket.once('timeout', () => {
        cleanup()
        this.socket?.destroy()
        reject(new Error('Connection timeout'))
      })

      this.socket.on('data', (data) => {
        this.responseBuffer = Buffer.concat([this.responseBuffer, data])
        this.processResponse()
      })

      this.socket.on('close', () => {
        this.connected = false
        this.emit('disconnected')
        this.scheduleReconnect()
      })

      this.socket.on('error', (err) => {
        this.emit('error', err)
      })

      this.socket.connect(this.port, this.host)
    })
  }

  private processResponse() {
    // Look for complete messages (SOM ... EOM EOM2)
    let startIdx = this.responseBuffer.indexOf(SOM)
    while (startIdx !== -1) {
      // Find end of message
      for (let i = startIdx + 1; i < this.responseBuffer.length - 1; i++) {
        if (this.responseBuffer[i] === EOM && this.responseBuffer[i + 1] === EOM2) {
          const message = this.responseBuffer.subarray(startIdx, i + 2)
          this.emit('response', message)
          this.responseBuffer = this.responseBuffer.subarray(i + 2)
          startIdx = this.responseBuffer.indexOf(SOM)
          break
        }
      }
      break
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null
      try {
        await this.connect()
      } catch {
        this.scheduleReconnect()
      }
    }, this.reconnectInterval)
  }

  private buildConnectCommand(source: number, destination: number): Buffer {
    // SW-P-08 Connect command format:
    // SOM, CMD, MATRIX, LEVEL, DEST_MSB, DEST_LSB, SOURCE_MSB, SOURCE_LSB, CHECKSUM, EOM, EOM2

    const destMsb = (destination >> 7) & 0x7F
    const destLsb = destination & 0x7F
    const srcMsb = (source >> 7) & 0x7F
    const srcLsb = source & 0x7F

    // Calculate checksum (XOR of all bytes between SOM and checksum)
    const data = [COMMAND_CONNECT, this.matrix, this.level, destMsb, destLsb, srcMsb, srcLsb]
    let checksum = 0
    for (const byte of data) {
      checksum ^= byte
    }

    return Buffer.from([SOM, ...data, checksum, EOM, EOM2])
  }

  async sendCommand(command: Buffer): Promise<Buffer> {
    if (!this.connected || !this.socket) {
      await this.connect()
    }

    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not initialized'))
        return
      }

      const timeoutId = setTimeout(() => {
        reject(new Error('Command timeout'))
      }, this.timeout)

      const responseHandler = (response: Buffer) => {
        clearTimeout(timeoutId)
        this.removeListener('response', responseHandler)
        resolve(response)
      }

      this.once('response', responseHandler)

      this.socket.write(command, (err) => {
        if (err) {
          clearTimeout(timeoutId)
          this.removeListener('response', responseHandler)
          reject(err)
        }
      })
    })
  }

  async route(source: number, destination: number): Promise<{ success: boolean; message: string }> {
    try {
      const command = this.buildConnectCommand(source, destination)
      await this.sendCommand(command)
      return { success: true, message: `Route ${source} → ${destination} executed` }
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.connect()
      return { success: true, message: 'Connected successfully' }
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Connection failed' }
    }
  }

  isConnected(): boolean {
    return this.connected
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.socket) {
      this.socket.removeAllListeners()
      this.socket.destroy()
      this.socket = null
    }
    this.connected = false
  }
}

// Pool for Ultrix routers
export class SWP08Pool {
  private clients = new Map<number, SWP08Client>()

  getClient(deviceId: number, host: string, port: number): SWP08Client {
    let client = this.clients.get(deviceId)
    if (!client) {
      client = new SWP08Client({ host, port })
      this.clients.set(deviceId, client)
    }
    return client
  }

  async route(deviceId: number, host: string, port: number, source: number, destination: number): Promise<{ success: boolean; message: string }> {
    const client = this.getClient(deviceId, host, port)
    return client.route(source, destination)
  }

  async testConnection(deviceId: number, host: string, port: number): Promise<{ success: boolean; message: string }> {
    const client = this.getClient(deviceId, host, port)
    return client.testConnection()
  }

  getStatus(deviceId: number): boolean {
    const client = this.clients.get(deviceId)
    return client?.isConnected() ?? false
  }

  disconnectAll() {
    for (const client of this.clients.values()) {
      client.disconnect()
    }
    this.clients.clear()
  }

  disconnect(deviceId: number) {
    const client = this.clients.get(deviceId)
    if (client) {
      client.disconnect()
      this.clients.delete(deviceId)
    }
  }
}

export const swp08Pool = new SWP08Pool()
