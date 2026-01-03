import { contextBridge, ipcRenderer } from 'electron'

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
  device_id: number
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

const api = {
  // Device operations
  getDevices: (): Promise<Device[]> => ipcRenderer.invoke('devices:getAll'),
  getDevice: (id: number): Promise<Device | null> => ipcRenderer.invoke('devices:get', id),
  createDevice: (device: Omit<Device, 'id' | 'created_at'>): Promise<Device> =>
    ipcRenderer.invoke('devices:create', device),
  updateDevice: (id: number, device: Partial<Device>): Promise<Device> =>
    ipcRenderer.invoke('devices:update', id, device),
  deleteDevice: (id: number): Promise<void> => ipcRenderer.invoke('devices:delete', id),
  testConnection: (id: number): Promise<{ success: boolean; message: string }> =>
    ipcRenderer.invoke('devices:testConnection', id),
  getDeviceStatus: (id: number): Promise<DeviceStatus> =>
    ipcRenderer.invoke('devices:getStatus', id),
  getAllDeviceStatuses: (): Promise<DeviceStatus[]> =>
    ipcRenderer.invoke('devices:getAllStatuses'),

  // Router endpoint operations
  getRouterEndpoints: (deviceId: number): Promise<RouterEndpoint[]> =>
    ipcRenderer.invoke('endpoints:getByDevice', deviceId),
  createRouterEndpoint: (endpoint: Omit<RouterEndpoint, 'id'>): Promise<RouterEndpoint> =>
    ipcRenderer.invoke('endpoints:create', endpoint),
  updateRouterEndpoint: (id: number, endpoint: Partial<RouterEndpoint>): Promise<RouterEndpoint> =>
    ipcRenderer.invoke('endpoints:update', id, endpoint),
  deleteRouterEndpoint: (id: number): Promise<void> =>
    ipcRenderer.invoke('endpoints:delete', id),
  importEndpoints: (deviceId: number, csv: string): Promise<void> =>
    ipcRenderer.invoke('endpoints:import', deviceId, csv),

  // Schedule operations
  getSchedules: (): Promise<Schedule[]> => ipcRenderer.invoke('schedules:getAll'),
  getSchedule: (id: number): Promise<Schedule | null> => ipcRenderer.invoke('schedules:get', id),
  createSchedule: (schedule: Omit<Schedule, 'id' | 'last_run' | 'next_run' | 'created_at'>): Promise<Schedule> =>
    ipcRenderer.invoke('schedules:create', schedule),
  updateSchedule: (id: number, schedule: Partial<Schedule>): Promise<Schedule> =>
    ipcRenderer.invoke('schedules:update', id, schedule),
  deleteSchedule: (id: number): Promise<void> => ipcRenderer.invoke('schedules:delete', id),
  toggleSchedule: (id: number, enabled: boolean): Promise<Schedule> =>
    ipcRenderer.invoke('schedules:toggle', id, enabled),
  runScheduleNow: (id: number): Promise<{ success: boolean; message: string }> =>
    ipcRenderer.invoke('schedules:runNow', id),
  getUpcomingSchedules: (limit?: number): Promise<Schedule[]> =>
    ipcRenderer.invoke('schedules:getUpcoming', limit),

  // Manual command operations
  sendTakeCommand: (deviceId: number, takeId: number): Promise<{ success: boolean; message: string }> =>
    ipcRenderer.invoke('commands:sendTake', deviceId, takeId),
  sendRouteCommand: (deviceId: number, source: number, destination: number): Promise<{ success: boolean; message: string }> =>
    ipcRenderer.invoke('commands:sendRoute', deviceId, source, destination),

  // Log operations
  getLogs: (limit?: number, offset?: number): Promise<CommandLog[]> =>
    ipcRenderer.invoke('logs:getAll', limit, offset),
  getLogsByDevice: (deviceId: number, limit?: number): Promise<CommandLog[]> =>
    ipcRenderer.invoke('logs:getByDevice', deviceId, limit),
  getLogsBySchedule: (scheduleId: number, limit?: number): Promise<CommandLog[]> =>
    ipcRenderer.invoke('logs:getBySchedule', scheduleId, limit),
  exportLogs: (format: 'csv' | 'json'): Promise<string> =>
    ipcRenderer.invoke('logs:export', format),
  clearLogs: (): Promise<void> => ipcRenderer.invoke('logs:clear'),

  // Import/Export
  exportSchedules: (): Promise<string> => ipcRenderer.invoke('export:schedules'),
  importSchedules: (data: string): Promise<{ imported: number; errors: string[] }> =>
    ipcRenderer.invoke('import:schedules', data),
  exportConfig: (): Promise<string> => ipcRenderer.invoke('export:config'),
  importConfig: (data: string): Promise<void> => ipcRenderer.invoke('import:config', data),

  // Event subscriptions
  onScheduleExecuted: (callback: (log: CommandLog) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, log: CommandLog) => callback(log)
    ipcRenderer.on('schedule:executed', listener)
    return () => ipcRenderer.removeListener('schedule:executed', listener)
  },
  onDeviceStatusChange: (callback: (status: DeviceStatus) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: DeviceStatus) => callback(status)
    ipcRenderer.on('device:statusChange', listener)
    return () => ipcRenderer.removeListener('device:statusChange', listener)
  }
}

contextBridge.exposeInMainWorld('api', api)

declare global {
  interface Window {
    api: typeof api
  }
}
