export type Device = {
  id: number
  name: string
  type: 'xpression' | 'ultrix'
  host: string
  port: number
  enabled: boolean
  created_at: string
}

export type RouterEndpoint = {
  id: number
  device_id: number
  endpoint_type: 'source' | 'destination'
  number: number
  name: string
}

export type Schedule = {
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

export type CommandLog = {
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

export type DeviceStatus = {
  id: number
  connected: boolean
  lastCheck: string
}

export interface ElectronAPI {
  // Device operations
  getDevices: () => Promise<Device[]>
  getDevice: (id: number) => Promise<Device | null>
  createDevice: (device: Omit<Device, 'id' | 'created_at'>) => Promise<Device>
  updateDevice: (id: number, device: Partial<Device>) => Promise<Device>
  deleteDevice: (id: number) => Promise<void>
  testConnection: (id: number) => Promise<{ success: boolean; message: string }>
  getDeviceStatus: (id: number) => Promise<DeviceStatus>
  getAllDeviceStatuses: () => Promise<DeviceStatus[]>

  // Router endpoint operations
  getRouterEndpoints: (deviceId: number) => Promise<RouterEndpoint[]>
  createRouterEndpoint: (endpoint: Omit<RouterEndpoint, 'id'>) => Promise<RouterEndpoint>
  updateRouterEndpoint: (id: number, endpoint: Partial<RouterEndpoint>) => Promise<RouterEndpoint>
  deleteRouterEndpoint: (id: number) => Promise<void>
  importEndpoints: (deviceId: number, csv: string) => Promise<void>

  // Schedule operations
  getSchedules: () => Promise<Schedule[]>
  getSchedule: (id: number) => Promise<Schedule | null>
  createSchedule: (schedule: Omit<Schedule, 'id' | 'last_run' | 'next_run' | 'created_at'>) => Promise<Schedule>
  updateSchedule: (id: number, schedule: Partial<Schedule>) => Promise<Schedule>
  deleteSchedule: (id: number) => Promise<void>
  toggleSchedule: (id: number, enabled: boolean) => Promise<Schedule>
  runScheduleNow: (id: number) => Promise<{ success: boolean; message: string }>
  getUpcomingSchedules: (limit?: number) => Promise<Schedule[]>

  // Manual command operations
  sendTakeCommand: (deviceId: number, takeId: number) => Promise<{ success: boolean; message: string }>
  sendRouteCommand: (deviceId: number, source: number, destination: number) => Promise<{ success: boolean; message: string }>

  // Log operations
  getLogs: (limit?: number, offset?: number) => Promise<CommandLog[]>
  getLogsByDevice: (deviceId: number, limit?: number) => Promise<CommandLog[]>
  getLogsBySchedule: (scheduleId: number, limit?: number) => Promise<CommandLog[]>
  exportLogs: (format: 'csv' | 'json') => Promise<string>
  clearLogs: () => Promise<void>

  // Import/Export
  exportSchedules: () => Promise<string>
  importSchedules: (data: string) => Promise<{ imported: number; errors: string[] }>
  exportConfig: () => Promise<string>
  importConfig: (data: string) => Promise<void>

  // Event subscriptions
  onScheduleExecuted: (callback: (log: CommandLog) => void) => () => void
  onDeviceStatusChange: (callback: (status: DeviceStatus) => void) => () => void
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
