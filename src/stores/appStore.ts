import { create } from 'zustand'

export interface Device {
  id: number
  name: string
  type: 'xpression' | 'ultrix'
  host: string
  port: number
  enabled: boolean
  created_at: string
}

export interface RouterEndpoint {
  id: number
  device_id: number
  endpoint_type: 'source' | 'destination'
  number: number
  name: string
}

export interface Schedule {
  id: number
  name: string
  device_id: number
  device_name?: string
  device_type?: string
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

export interface CommandLog {
  id: number
  schedule_id: number | null
  schedule_name?: string
  device_id: number
  device_name?: string
  command: string
  status: 'success' | 'error'
  response: string | null
  executed_at: string
}

export interface DeviceStatus {
  id: number
  connected: boolean
  lastCheck: string
}

interface AppState {
  devices: Device[]
  schedules: Schedule[]
  logs: CommandLog[]
  deviceStatuses: Map<number, DeviceStatus>
  upcomingSchedules: Schedule[]

  // Actions
  loadDevices: () => Promise<void>
  loadSchedules: () => Promise<void>
  loadLogs: (limit?: number) => Promise<void>
  loadUpcomingSchedules: () => Promise<void>
  updateDeviceStatus: (status: DeviceStatus) => void
  addLog: (log: CommandLog) => void

  // Device actions
  createDevice: (device: Omit<Device, 'id' | 'created_at'>) => Promise<Device>
  updateDevice: (id: number, device: Partial<Device>) => Promise<Device>
  deleteDevice: (id: number) => Promise<void>

  // Schedule actions
  createSchedule: (schedule: Omit<Schedule, 'id' | 'last_run' | 'next_run' | 'created_at'>) => Promise<Schedule>
  updateSchedule: (id: number, schedule: Partial<Schedule>) => Promise<Schedule>
  deleteSchedule: (id: number) => Promise<void>
  toggleSchedule: (id: number, enabled: boolean) => Promise<void>
}

export const useAppStore = create<AppState>((set, get) => ({
  devices: [],
  schedules: [],
  logs: [],
  deviceStatuses: new Map(),
  upcomingSchedules: [],

  loadDevices: async () => {
    const devices = await window.api.getDevices()
    const statuses = await window.api.getAllDeviceStatuses()
    const statusMap = new Map<number, DeviceStatus>()
    for (const status of statuses) {
      statusMap.set(status.id, status)
    }
    set({ devices, deviceStatuses: statusMap })
  },

  loadSchedules: async () => {
    const schedules = await window.api.getSchedules()
    set({ schedules })
  },

  loadLogs: async (limit = 100) => {
    const logs = await window.api.getLogs(limit)
    set({ logs })
  },

  loadUpcomingSchedules: async () => {
    const upcomingSchedules = await window.api.getUpcomingSchedules(5)
    set({ upcomingSchedules })
  },

  updateDeviceStatus: (status) => {
    const statuses = new Map(get().deviceStatuses)
    statuses.set(status.id, status)
    set({ deviceStatuses: statuses })
  },

  addLog: (log) => {
    set((state) => ({
      logs: [log, ...state.logs].slice(0, 100)
    }))
  },

  createDevice: async (device) => {
    const created = await window.api.createDevice(device)
    await get().loadDevices()
    return created
  },

  updateDevice: async (id, device) => {
    const updated = await window.api.updateDevice(id, device)
    await get().loadDevices()
    return updated
  },

  deleteDevice: async (id) => {
    await window.api.deleteDevice(id)
    await get().loadDevices()
  },

  createSchedule: async (schedule) => {
    const created = await window.api.createSchedule(schedule)
    await get().loadSchedules()
    await get().loadUpcomingSchedules()
    return created
  },

  updateSchedule: async (id, schedule) => {
    const updated = await window.api.updateSchedule(id, schedule)
    await get().loadSchedules()
    await get().loadUpcomingSchedules()
    return updated
  },

  deleteSchedule: async (id) => {
    await window.api.deleteSchedule(id)
    await get().loadSchedules()
    await get().loadUpcomingSchedules()
  },

  toggleSchedule: async (id, enabled) => {
    await window.api.toggleSchedule(id, enabled)
    await get().loadSchedules()
    await get().loadUpcomingSchedules()
  }
}))
