import * as fs from 'fs'
import * as path from 'path'

interface DeviceRecord {
  id: number
  name: string
  type: 'xpression' | 'ultrix'
  host: string
  port: number
  enabled: boolean
  created_at: string
}

interface RouterEndpointRecord {
  id: number
  device_id: number
  endpoint_type: 'source' | 'destination'
  number: number
  name: string
}

interface ScheduleRecord {
  id: number
  name: string
  device_id: number
  command_type: 'take' | 'route'
  command_data: string
  schedule_type: 'once' | 'recurring'
  cron_expression: string | null
  run_at: string | null
  enabled: boolean
  last_run: string | null
  next_run: string | null
  created_at: string
}

interface CommandLogRecord {
  id: number
  schedule_id: number | null
  device_id: number
  command: string
  status: 'success' | 'error'
  response: string | null
  executed_at: string
}

interface DatabaseData {
  devices: DeviceRecord[]
  router_endpoints: RouterEndpointRecord[]
  schedules: ScheduleRecord[]
  command_log: CommandLogRecord[]
  nextId: {
    devices: number
    router_endpoints: number
    schedules: number
    command_log: number
  }
}

export class Database {
  private data: DatabaseData
  private dbPath: string
  private saveTimer: NodeJS.Timeout | null = null

  constructor(dbPath: string) {
    this.dbPath = dbPath
    this.data = {
      devices: [],
      router_endpoints: [],
      schedules: [],
      command_log: [],
      nextId: {
        devices: 1,
        router_endpoints: 1,
        schedules: 1,
        command_log: 1
      }
    }
  }

  async init(): Promise<void> {
    // Ensure directory exists
    const dir = path.dirname(this.dbPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    // Load existing data or use defaults
    if (fs.existsSync(this.dbPath)) {
      try {
        const raw = fs.readFileSync(this.dbPath, 'utf-8')
        this.data = JSON.parse(raw)
      } catch {
        // Use defaults on error
      }
    }

    this.save()
  }

  private save() {
    // Debounce saves
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
    }

    this.saveTimer = setTimeout(() => {
      fs.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2))
    }, 100)
  }

  private getNextId(table: keyof DatabaseData['nextId']): number {
    const id = this.data.nextId[table]
    this.data.nextId[table]++
    return id
  }

  // Device operations
  getAllDevices() {
    return [...this.data.devices].sort((a, b) => a.name.localeCompare(b.name))
  }

  getDevice(id: number) {
    return this.data.devices.find(d => d.id === id) || null
  }

  createDevice(device: { name: string; type: string; host: string; port: number; enabled?: boolean }) {
    const newDevice: DeviceRecord = {
      id: this.getNextId('devices'),
      name: device.name,
      type: device.type as 'xpression' | 'ultrix',
      host: device.host,
      port: device.port,
      enabled: device.enabled !== false,
      created_at: new Date().toISOString()
    }
    this.data.devices.push(newDevice)
    this.save()
    return newDevice
  }

  updateDevice(id: number, device: Partial<{ name: string; type: string; host: string; port: number; enabled: boolean }>) {
    const existing = this.data.devices.find(d => d.id === id)
    if (!existing) return null

    if (device.name !== undefined) existing.name = device.name
    if (device.type !== undefined) existing.type = device.type as 'xpression' | 'ultrix'
    if (device.host !== undefined) existing.host = device.host
    if (device.port !== undefined) existing.port = device.port
    if (device.enabled !== undefined) existing.enabled = device.enabled

    this.save()
    return existing
  }

  deleteDevice(id: number) {
    this.data.devices = this.data.devices.filter(d => d.id !== id)
    // Cascade delete
    this.data.router_endpoints = this.data.router_endpoints.filter(e => e.device_id !== id)
    this.data.schedules = this.data.schedules.filter(s => s.device_id !== id)
    this.data.command_log = this.data.command_log.filter(l => l.device_id !== id)
    this.save()
  }

  // Router endpoint operations
  getRouterEndpoints(deviceId: number) {
    return this.data.router_endpoints
      .filter(e => e.device_id === deviceId)
      .sort((a, b) => {
        if (a.endpoint_type !== b.endpoint_type) {
          return a.endpoint_type.localeCompare(b.endpoint_type)
        }
        return a.number - b.number
      })
  }

  createRouterEndpoint(endpoint: { device_id: number; endpoint_type: string; number: number; name: string }) {
    // Check for duplicate
    const exists = this.data.router_endpoints.find(
      e => e.device_id === endpoint.device_id &&
           e.endpoint_type === endpoint.endpoint_type &&
           e.number === endpoint.number
    )
    if (exists) throw new Error('Endpoint already exists')

    const newEndpoint: RouterEndpointRecord = {
      id: this.getNextId('router_endpoints'),
      device_id: endpoint.device_id,
      endpoint_type: endpoint.endpoint_type as 'source' | 'destination',
      number: endpoint.number,
      name: endpoint.name
    }
    this.data.router_endpoints.push(newEndpoint)
    this.save()
    return newEndpoint
  }

  updateRouterEndpoint(id: number, endpoint: Partial<{ number: number; name: string }>) {
    const existing = this.data.router_endpoints.find(e => e.id === id)
    if (!existing) return null

    if (endpoint.number !== undefined) existing.number = endpoint.number
    if (endpoint.name !== undefined) existing.name = endpoint.name

    this.save()
    return existing
  }

  deleteRouterEndpoint(id: number) {
    this.data.router_endpoints = this.data.router_endpoints.filter(e => e.id !== id)
    this.save()
  }

  // Schedule operations
  getAllSchedules() {
    return this.data.schedules.map(s => {
      const device = this.data.devices.find(d => d.id === s.device_id)
      return {
        ...s,
        device_name: device?.name,
        device_type: device?.type
      }
    }).sort((a, b) => {
      if (a.next_run && b.next_run) return a.next_run.localeCompare(b.next_run)
      if (a.next_run) return -1
      if (b.next_run) return 1
      return a.name.localeCompare(b.name)
    })
  }

  getSchedule(id: number) {
    return this.data.schedules.find(s => s.id === id) || null
  }

  getEnabledSchedules() {
    return this.data.schedules
      .filter(s => s.enabled)
      .map(s => {
        const device = this.data.devices.find(d => d.id === s.device_id && d.enabled)
        if (!device) return null
        return {
          ...s,
          host: device.host,
          port: device.port,
          device_type: device.type
        }
      })
      .filter((s): s is NonNullable<typeof s> => s !== null)
  }

  getUpcomingSchedules(limit = 10) {
    return this.data.schedules
      .filter(s => s.enabled && s.next_run)
      .map(s => {
        const device = this.data.devices.find(d => d.id === s.device_id)
        return {
          ...s,
          device_name: device?.name
        }
      })
      .sort((a, b) => (a.next_run || '').localeCompare(b.next_run || ''))
      .slice(0, limit)
  }

  createSchedule(schedule: {
    name: string
    device_id: number
    command_type: string
    command_data: string
    schedule_type: string
    cron_expression?: string | null
    run_at?: string | null
    enabled?: boolean
    next_run?: string | null
  }) {
    const newSchedule: ScheduleRecord = {
      id: this.getNextId('schedules'),
      name: schedule.name,
      device_id: schedule.device_id,
      command_type: schedule.command_type as 'take' | 'route',
      command_data: schedule.command_data,
      schedule_type: schedule.schedule_type as 'once' | 'recurring',
      cron_expression: schedule.cron_expression ?? null,
      run_at: schedule.run_at ?? null,
      enabled: schedule.enabled !== false,
      last_run: null,
      next_run: schedule.next_run ?? null,
      created_at: new Date().toISOString()
    }
    this.data.schedules.push(newSchedule)
    this.save()
    return newSchedule
  }

  updateSchedule(id: number, schedule: Partial<{
    name: string
    device_id: number
    command_type: string
    command_data: string
    schedule_type: string
    cron_expression: string | null
    run_at: string | null
    enabled: boolean
    last_run: string | null
    next_run: string | null
  }>) {
    const existing = this.data.schedules.find(s => s.id === id)
    if (!existing) return null

    if (schedule.name !== undefined) existing.name = schedule.name
    if (schedule.device_id !== undefined) existing.device_id = schedule.device_id
    if (schedule.command_type !== undefined) existing.command_type = schedule.command_type as 'take' | 'route'
    if (schedule.command_data !== undefined) existing.command_data = schedule.command_data
    if (schedule.schedule_type !== undefined) existing.schedule_type = schedule.schedule_type as 'once' | 'recurring'
    if (schedule.cron_expression !== undefined) existing.cron_expression = schedule.cron_expression
    if (schedule.run_at !== undefined) existing.run_at = schedule.run_at
    if (schedule.enabled !== undefined) existing.enabled = schedule.enabled
    if (schedule.last_run !== undefined) existing.last_run = schedule.last_run
    if (schedule.next_run !== undefined) existing.next_run = schedule.next_run

    this.save()
    return existing
  }

  deleteSchedule(id: number) {
    this.data.schedules = this.data.schedules.filter(s => s.id !== id)
    // Update logs to remove schedule reference
    this.data.command_log.forEach(l => {
      if (l.schedule_id === id) l.schedule_id = null
    })
    this.save()
  }

  // Command log operations
  getLogs(limit = 100, offset = 0) {
    return this.data.command_log
      .map(l => {
        const device = this.data.devices.find(d => d.id === l.device_id)
        const schedule = l.schedule_id ? this.data.schedules.find(s => s.id === l.schedule_id) : null
        return {
          ...l,
          device_name: device?.name,
          schedule_name: schedule?.name
        }
      })
      .sort((a, b) => b.executed_at.localeCompare(a.executed_at))
      .slice(offset, offset + limit)
  }

  getLogsByDevice(deviceId: number, limit = 100) {
    return this.data.command_log
      .filter(l => l.device_id === deviceId)
      .map(l => {
        const device = this.data.devices.find(d => d.id === l.device_id)
        const schedule = l.schedule_id ? this.data.schedules.find(s => s.id === l.schedule_id) : null
        return {
          ...l,
          device_name: device?.name,
          schedule_name: schedule?.name
        }
      })
      .sort((a, b) => b.executed_at.localeCompare(a.executed_at))
      .slice(0, limit)
  }

  getLogsBySchedule(scheduleId: number, limit = 100) {
    return this.data.command_log
      .filter(l => l.schedule_id === scheduleId)
      .map(l => {
        const device = this.data.devices.find(d => d.id === l.device_id)
        const schedule = this.data.schedules.find(s => s.id === l.schedule_id)
        return {
          ...l,
          device_name: device?.name,
          schedule_name: schedule?.name
        }
      })
      .sort((a, b) => b.executed_at.localeCompare(a.executed_at))
      .slice(0, limit)
  }

  createLog(log: { schedule_id?: number | null; device_id: number; command: string; status: string; response?: string | null }) {
    const newLog: CommandLogRecord = {
      id: this.getNextId('command_log'),
      schedule_id: log.schedule_id ?? null,
      device_id: log.device_id,
      command: log.command,
      status: log.status as 'success' | 'error',
      response: log.response ?? null,
      executed_at: new Date().toISOString()
    }
    this.data.command_log.push(newLog)
    // Keep only last 10000 logs
    if (this.data.command_log.length > 10000) {
      this.data.command_log = this.data.command_log.slice(-10000)
    }
    this.save()
    return newLog
  }

  clearLogs() {
    this.data.command_log = []
    this.save()
  }

  close() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
    }
    // Synchronous final save
    fs.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2))
  }
}
