import { IpcMain, BrowserWindow } from 'electron'
import { Database } from '../database/schema'
import { Scheduler } from '../scheduler/scheduler'
import { rossTalkPool } from '../protocols/rosstalk'
import { swp08Pool } from '../protocols/swp08'

interface Device {
  id: number
  name: string
  type: 'xpression' | 'ultrix'
  host: string
  port: number
  enabled: boolean
}

export function registerIpcHandlers(ipcMain: IpcMain, db: Database, scheduler: Scheduler) {
  // Device handlers
  ipcMain.handle('devices:getAll', () => {
    return db.getAllDevices()
  })

  ipcMain.handle('devices:get', (_event, id: number) => {
    return db.getDevice(id)
  })

  ipcMain.handle('devices:create', (_event, device: Omit<Device, 'id'>) => {
    return db.createDevice(device)
  })

  ipcMain.handle('devices:update', (_event, id: number, device: Partial<Device>) => {
    const updated = db.updateDevice(id, device)
    // Disconnect and reconnect if host/port changed
    if (device.host || device.port) {
      const d = db.getDevice(id) as Device
      if (d.type === 'xpression') {
        rossTalkPool.disconnect(id)
      } else {
        swp08Pool.disconnect(id)
      }
    }
    return updated
  })

  ipcMain.handle('devices:delete', (_event, id: number) => {
    const device = db.getDevice(id) as Device | undefined
    if (device) {
      if (device.type === 'xpression') {
        rossTalkPool.disconnect(id)
      } else {
        swp08Pool.disconnect(id)
      }
    }
    db.deleteDevice(id)
  })

  ipcMain.handle('devices:testConnection', async (_event, id: number) => {
    const device = db.getDevice(id) as Device | undefined
    if (!device) {
      return { success: false, message: 'Device not found' }
    }
    if (device.type === 'xpression') {
      return rossTalkPool.testConnection(id, device.host, device.port)
    } else {
      return swp08Pool.testConnection(id, device.host, device.port)
    }
  })

  ipcMain.handle('devices:getStatus', (_event, id: number) => {
    const device = db.getDevice(id) as Device | undefined
    if (!device) {
      return { id, connected: false, lastCheck: new Date().toISOString() }
    }
    const connected = device.type === 'xpression'
      ? rossTalkPool.getStatus(id)
      : swp08Pool.getStatus(id)
    return { id, connected, lastCheck: new Date().toISOString() }
  })

  ipcMain.handle('devices:getAllStatuses', () => {
    const devices = db.getAllDevices() as Device[]
    return devices.map(device => ({
      id: device.id,
      connected: device.type === 'xpression'
        ? rossTalkPool.getStatus(device.id)
        : swp08Pool.getStatus(device.id),
      lastCheck: new Date().toISOString()
    }))
  })

  // Router endpoint handlers
  ipcMain.handle('endpoints:getByDevice', (_event, deviceId: number) => {
    return db.getRouterEndpoints(deviceId)
  })

  ipcMain.handle('endpoints:create', (_event, endpoint: { device_id: number; endpoint_type: string; number: number; name: string }) => {
    return db.createRouterEndpoint(endpoint)
  })

  ipcMain.handle('endpoints:update', (_event, id: number, endpoint: Partial<{ number: number; name: string }>) => {
    return db.updateRouterEndpoint(id, endpoint)
  })

  ipcMain.handle('endpoints:delete', (_event, id: number) => {
    db.deleteRouterEndpoint(id)
  })

  ipcMain.handle('endpoints:import', (_event, deviceId: number, csv: string) => {
    const lines = csv.split('\n').filter(line => line.trim())
    for (const line of lines) {
      const [type, number, name] = line.split(',').map(s => s.trim())
      if (type && number && name) {
        const endpointType = type.toLowerCase() === 'source' ? 'source' : 'destination'
        try {
          db.createRouterEndpoint({
            device_id: deviceId,
            endpoint_type: endpointType,
            number: parseInt(number, 10),
            name
          })
        } catch {
          // Skip duplicates
        }
      }
    }
  })

  // Schedule handlers
  ipcMain.handle('schedules:getAll', () => {
    return db.getAllSchedules()
  })

  ipcMain.handle('schedules:get', (_event, id: number) => {
    return db.getSchedule(id)
  })

  ipcMain.handle('schedules:getUpcoming', (_event, limit?: number) => {
    return db.getUpcomingSchedules(limit)
  })

  ipcMain.handle('schedules:create', (_event, scheduleData: {
    name: string
    device_id: number
    command_type: string
    command_data: string
    schedule_type: string
    cron_expression?: string | null
    run_at?: string | null
    enabled?: boolean
  }) => {
    const schedule = db.createSchedule(scheduleData)
    if (schedule && scheduleData.enabled !== false) {
      scheduler.addSchedule((schedule as { id: number }).id)
    }
    return schedule
  })

  ipcMain.handle('schedules:update', (_event, id: number, scheduleData: Record<string, unknown>) => {
    const schedule = db.updateSchedule(id, scheduleData)
    scheduler.updateSchedule(id)
    return schedule
  })

  ipcMain.handle('schedules:delete', (_event, id: number) => {
    scheduler.cancelJob(id)
    db.deleteSchedule(id)
  })

  ipcMain.handle('schedules:toggle', (_event, id: number, enabled: boolean) => {
    const schedule = db.updateSchedule(id, { enabled })
    if (enabled) {
      scheduler.enableSchedule(id)
    } else {
      scheduler.disableSchedule(id)
    }
    return schedule
  })

  ipcMain.handle('schedules:runNow', async (_event, id: number) => {
    return scheduler.runNow(id)
  })

  // Manual command handlers
  ipcMain.handle('commands:sendTake', async (_event, deviceId: number, takeId: number) => {
    const device = db.getDevice(deviceId) as Device | undefined
    if (!device) {
      return { success: false, message: 'Device not found' }
    }
    if (device.type !== 'xpression') {
      return { success: false, message: 'Device is not an Xpression' }
    }
    const result = await rossTalkPool.sendTake(deviceId, device.host, device.port, takeId)

    // Log the command
    db.createLog({
      device_id: deviceId,
      command: `TAKE ${takeId}`,
      status: result.success ? 'success' : 'error',
      response: result.message
    })

    return result
  })

  ipcMain.handle('commands:sendRoute', async (_event, deviceId: number, source: number, destination: number) => {
    const device = db.getDevice(deviceId) as Device | undefined
    if (!device) {
      return { success: false, message: 'Device not found' }
    }
    if (device.type !== 'ultrix') {
      return { success: false, message: 'Device is not an Ultrix router' }
    }
    const result = await swp08Pool.route(deviceId, device.host, device.port, source, destination)

    // Log the command
    db.createLog({
      device_id: deviceId,
      command: `ROUTE ${source} → ${destination}`,
      status: result.success ? 'success' : 'error',
      response: result.message
    })

    // Notify renderer
    const windows = BrowserWindow.getAllWindows()
    const log = db.getLogs(1, 0)[0]
    for (const win of windows) {
      win.webContents.send('schedule:executed', log)
    }

    return result
  })

  // Log handlers
  ipcMain.handle('logs:getAll', (_event, limit?: number, offset?: number) => {
    return db.getLogs(limit, offset)
  })

  ipcMain.handle('logs:getByDevice', (_event, deviceId: number, limit?: number) => {
    return db.getLogsByDevice(deviceId, limit)
  })

  ipcMain.handle('logs:getBySchedule', (_event, scheduleId: number, limit?: number) => {
    return db.getLogsBySchedule(scheduleId, limit)
  })

  ipcMain.handle('logs:export', (_event, format: 'csv' | 'json') => {
    const logs = db.getLogs(10000, 0)
    if (format === 'json') {
      return JSON.stringify(logs, null, 2)
    }
    // CSV format
    const headers = ['ID', 'Schedule', 'Device', 'Command', 'Status', 'Response', 'Executed At']
    const rows = (logs as Array<{
      id: number
      schedule_name: string | null
      device_name: string
      command: string
      status: string
      response: string | null
      executed_at: string
    }>).map(log => [
      log.id,
      log.schedule_name || '',
      log.device_name,
      log.command,
      log.status,
      log.response || '',
      log.executed_at
    ])
    return [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n')
  })

  ipcMain.handle('logs:clear', () => {
    db.clearLogs()
  })

  // Import/Export handlers
  ipcMain.handle('export:schedules', () => {
    const schedules = db.getAllSchedules()
    return JSON.stringify(schedules, null, 2)
  })

  ipcMain.handle('import:schedules', (_event, data: string) => {
    try {
      const schedules = JSON.parse(data) as Array<{
        name: string
        device_id: number
        command_type: string
        command_data: string
        schedule_type: string
        cron_expression?: string
        run_at?: string
        enabled?: boolean
      }>
      let imported = 0
      const errors: string[] = []

      for (const sched of schedules) {
        try {
          db.createSchedule({
            name: sched.name,
            device_id: sched.device_id,
            command_type: sched.command_type,
            command_data: sched.command_data,
            schedule_type: sched.schedule_type,
            cron_expression: sched.cron_expression,
            run_at: sched.run_at,
            enabled: sched.enabled
          })
          imported++
        } catch (err) {
          errors.push(`Failed to import "${sched.name}": ${err instanceof Error ? err.message : 'Unknown error'}`)
        }
      }

      // Reload schedules
      scheduler.stopAll()
      scheduler.loadSchedules()

      return { imported, errors }
    } catch {
      return { imported: 0, errors: ['Invalid JSON format'] }
    }
  })

  ipcMain.handle('export:config', () => {
    const devices = db.getAllDevices()
    const endpoints: unknown[] = []
    for (const device of devices as Array<{ id: number }>) {
      const deviceEndpoints = db.getRouterEndpoints(device.id)
      endpoints.push(...deviceEndpoints)
    }
    return JSON.stringify({ devices, endpoints }, null, 2)
  })

  ipcMain.handle('import:config', (_event, data: string) => {
    const config = JSON.parse(data) as {
      devices: Array<{ name: string; type: string; host: string; port: number; enabled: boolean }>
      endpoints: Array<{ device_id: number; endpoint_type: string; number: number; name: string }>
    }

    // Import devices
    const deviceIdMap = new Map<number, number>()
    for (const device of config.devices) {
      const created = db.createDevice(device) as { id: number }
      deviceIdMap.set(device.port, created.id) // Using port as temp key
    }

    // Import endpoints
    for (const endpoint of config.endpoints) {
      try {
        db.createRouterEndpoint(endpoint)
      } catch {
        // Skip duplicates
      }
    }
  })
}
