import schedule, { Job } from 'node-schedule'
import { Database } from '../database/schema'
import { rossTalkPool } from '../protocols/rosstalk'
import { swp08Pool } from '../protocols/swp08'
import { BrowserWindow } from 'electron'

interface ScheduleData {
  id: number
  name: string
  device_id: number
  device_type: string
  host: string
  port: number
  command_type: 'take' | 'route'
  command_data: string
  schedule_type: 'once' | 'recurring'
  cron_expression: string | null
  run_at: string | null
}

interface CommandData {
  takeId?: number
  source?: number
  destination?: number
}

export class Scheduler {
  private db: Database
  private jobs = new Map<number, Job>()

  constructor(db: Database) {
    this.db = db
  }

  async loadSchedules() {
    const schedules = this.db.getEnabledSchedules() as ScheduleData[]
    for (const sched of schedules) {
      this.scheduleJob(sched)
    }
  }

  private scheduleJob(sched: ScheduleData) {
    // Cancel existing job if any
    this.cancelJob(sched.id)

    let job: Job | null = null

    if (sched.schedule_type === 'recurring' && sched.cron_expression) {
      // Recurring schedule using cron expression
      job = schedule.scheduleJob(sched.cron_expression, () => {
        this.executeCommand(sched)
      })
    } else if (sched.schedule_type === 'once' && sched.run_at) {
      // One-time schedule
      const runDate = new Date(sched.run_at)
      if (runDate > new Date()) {
        job = schedule.scheduleJob(runDate, () => {
          this.executeCommand(sched)
          // Disable one-time schedule after execution
          this.db.updateSchedule(sched.id, { enabled: false })
        })
      }
    }

    if (job) {
      this.jobs.set(sched.id, job)
      // Update next run time
      const nextRun = job.nextInvocation()
      if (nextRun) {
        this.db.updateSchedule(sched.id, { next_run: nextRun.toISOString() })
      }
    }
  }

  private async executeCommand(sched: ScheduleData) {
    const commandData: CommandData = JSON.parse(sched.command_data)
    let result: { success: boolean; message: string }
    let command: string

    try {
      if (sched.command_type === 'take' && commandData.takeId !== undefined) {
        command = `TAKE ${commandData.takeId}`
        result = await rossTalkPool.sendTake(sched.device_id, sched.host, sched.port, commandData.takeId)
      } else if (sched.command_type === 'route' && commandData.source !== undefined && commandData.destination !== undefined) {
        command = `ROUTE ${commandData.source} → ${commandData.destination}`
        result = await swp08Pool.route(sched.device_id, sched.host, sched.port, commandData.source, commandData.destination)
      } else {
        result = { success: false, message: 'Invalid command data' }
        command = 'UNKNOWN'
      }
    } catch (error) {
      result = { success: false, message: error instanceof Error ? error.message : 'Unknown error' }
      command = sched.command_type === 'take' ? `TAKE ${commandData.takeId}` : `ROUTE ${commandData.source} → ${commandData.destination}`
    }

    // Log the command
    const log = this.db.createLog({
      schedule_id: sched.id,
      device_id: sched.device_id,
      command,
      status: result.success ? 'success' : 'error',
      response: result.message
    })

    // Update last run time
    this.db.updateSchedule(sched.id, { last_run: new Date().toISOString() })

    // Update next run time for recurring schedules
    const job = this.jobs.get(sched.id)
    if (job) {
      const nextRun = job.nextInvocation()
      if (nextRun) {
        this.db.updateSchedule(sched.id, { next_run: nextRun.toISOString() })
      }
    }

    // Notify renderer
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      win.webContents.send('schedule:executed', log)
    }
  }

  async runNow(scheduleId: number): Promise<{ success: boolean; message: string }> {
    const sched = this.db.getSchedule(scheduleId) as ScheduleData | undefined
    if (!sched) {
      return { success: false, message: 'Schedule not found' }
    }

    // Get device info
    const device = this.db.getDevice(sched.device_id) as { host: string; port: number; type: string } | undefined
    if (!device) {
      return { success: false, message: 'Device not found' }
    }

    const fullSched: ScheduleData = {
      ...sched,
      host: device.host,
      port: device.port,
      device_type: device.type
    }

    await this.executeCommand(fullSched)
    return { success: true, message: 'Command executed' }
  }

  addSchedule(scheduleId: number) {
    const schedules = this.db.getEnabledSchedules() as ScheduleData[]
    const sched = schedules.find(s => s.id === scheduleId)
    if (sched) {
      this.scheduleJob(sched)
    }
  }

  updateSchedule(scheduleId: number) {
    this.cancelJob(scheduleId)
    this.addSchedule(scheduleId)
  }

  cancelJob(scheduleId: number) {
    const job = this.jobs.get(scheduleId)
    if (job) {
      job.cancel()
      this.jobs.delete(scheduleId)
    }
  }

  enableSchedule(scheduleId: number) {
    this.addSchedule(scheduleId)
  }

  disableSchedule(scheduleId: number) {
    this.cancelJob(scheduleId)
  }

  stopAll() {
    for (const job of this.jobs.values()) {
      job.cancel()
    }
    this.jobs.clear()
    rossTalkPool.disconnectAll()
    swp08Pool.disconnectAll()
  }

  getNextRun(scheduleId: number): Date | null {
    const job = this.jobs.get(scheduleId)
    return job?.nextInvocation() ?? null
  }
}
