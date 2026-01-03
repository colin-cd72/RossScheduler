import * as net from 'net'
import { EventEmitter } from 'events'

export interface RossTalkOptions {
  host: string
  port: number
  reconnectInterval?: number
  timeout?: number
}

export class RossTalkClient extends EventEmitter {
  private host: string
  private port: number
  private socket: net.Socket | null = null
  private connected = false
  private reconnectInterval: number
  private timeout: number
  private reconnectTimer: NodeJS.Timeout | null = null
  private responseBuffer = ''

  constructor(options: RossTalkOptions) {
    super()
    this.host = options.host
    this.port = options.port
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
        this.socket?.removeAllListeners()
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
        this.responseBuffer += data.toString()
        const lines = this.responseBuffer.split('\r\n')
        this.responseBuffer = lines.pop() || ''
        for (const line of lines) {
          if (line.trim()) {
            this.emit('response', line.trim())
          }
        }
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

  async sendCommand(command: string): Promise<string> {
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

      const responseHandler = (response: string) => {
        clearTimeout(timeoutId)
        this.removeListener('response', responseHandler)
        resolve(response)
      }

      this.once('response', responseHandler)

      const fullCommand = command.endsWith('\r\n') ? command : command + '\r\n'
      this.socket.write(fullCommand, (err) => {
        if (err) {
          clearTimeout(timeoutId)
          this.removeListener('response', responseHandler)
          reject(err)
        }
      })
    })
  }

  async sendTake(takeId: number): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.sendCommand(`TAKE ${takeId}`)
      return { success: true, message: response || 'Command sent successfully' }
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

// Connection pool for multiple Xpression machines
export class RossTalkPool {
  private clients = new Map<number, RossTalkClient>()

  getClient(deviceId: number, host: string, port: number): RossTalkClient {
    let client = this.clients.get(deviceId)
    if (!client) {
      client = new RossTalkClient({ host, port })
      this.clients.set(deviceId, client)
    }
    return client
  }

  async sendTake(deviceId: number, host: string, port: number, takeId: number): Promise<{ success: boolean; message: string }> {
    const client = this.getClient(deviceId, host, port)
    return client.sendTake(takeId)
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

export const rossTalkPool = new RossTalkPool()
