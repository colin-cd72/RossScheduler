import { useEffect, useState } from 'react'
import { useAppStore, type CommandLog } from '../stores/appStore'
import { Play, Wifi, WifiOff, Clock, CheckCircle, XCircle, Zap } from 'lucide-react'

export default function Dashboard() {
  const { devices, deviceStatuses, upcomingSchedules, logs, loadDevices, loadSchedules, loadLogs, loadUpcomingSchedules, addLog, updateDeviceStatus } = useAppStore()
  const [manualTakeId, setManualTakeId] = useState('')
  const [selectedDevice, setSelectedDevice] = useState<number | null>(null)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    loadDevices()
    loadSchedules()
    loadLogs(10)
    loadUpcomingSchedules()

    // Subscribe to events
    const unsubExecuted = window.api.onScheduleExecuted((log: CommandLog) => {
      addLog(log)
      loadUpcomingSchedules()
    })

    const unsubStatus = window.api.onDeviceStatusChange(updateDeviceStatus)

    return () => {
      unsubExecuted()
      unsubStatus()
    }
  }, [])

  const xpressionDevices = devices.filter(d => d.type === 'xpression' && d.enabled)
  const ultrixDevices = devices.filter(d => d.type === 'ultrix' && d.enabled)

  const handleManualTake = async () => {
    if (!selectedDevice || !manualTakeId) return
    setSending(true)
    try {
      await window.api.sendTakeCommand(selectedDevice, parseInt(manualTakeId, 10))
      setManualTakeId('')
      loadLogs(10)
    } catch (error) {
      console.error('Failed to send take:', error)
    }
    setSending(false)
  }

  const handleRunSchedule = async (scheduleId: number) => {
    try {
      await window.api.runScheduleNow(scheduleId)
      loadLogs(10)
      loadUpcomingSchedules()
    } catch (error) {
      console.error('Failed to run schedule:', error)
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Device Status Grid */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4 text-gray-300">Device Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {devices.map(device => {
            const status = deviceStatuses.get(device.id)
            const isConnected = status?.connected ?? false
            return (
              <div
                key={device.id}
                className={`p-4 rounded-lg border ${
                  device.enabled
                    ? isConnected
                      ? 'border-green-500 bg-green-500/10'
                      : 'border-red-500 bg-red-500/10'
                    : 'border-gray-600 bg-gray-700/50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{device.name}</span>
                  {device.enabled ? (
                    isConnected ? (
                      <Wifi className="w-5 h-5 text-green-500" />
                    ) : (
                      <WifiOff className="w-5 h-5 text-red-500" />
                    )
                  ) : (
                    <span className="text-xs text-gray-500">Disabled</span>
                  )}
                </div>
                <div className="text-sm text-gray-400">
                  {device.type === 'xpression' ? 'Xpression' : 'Ultrix'}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {device.host}:{device.port}
                </div>
              </div>
            )
          })}
          {devices.length === 0 && (
            <div className="col-span-4 text-center py-8 text-gray-500">
              No devices configured. Go to Devices to add one.
            </div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Manual Control */}
        <section className="bg-ross-gray rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <Zap className="w-5 h-5 mr-2 text-yellow-500" />
            Manual Control
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Xpression Device</label>
              <select
                value={selectedDevice ?? ''}
                onChange={(e) => setSelectedDevice(e.target.value ? parseInt(e.target.value, 10) : null)}
                className="w-full bg-ross-dark border border-gray-600 rounded px-3 py-2 text-white"
              >
                <option value="">Select device...</option>
                {xpressionDevices.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Take ID</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={manualTakeId}
                  onChange={(e) => setManualTakeId(e.target.value)}
                  placeholder="Enter Take ID"
                  className="flex-1 bg-ross-dark border border-gray-600 rounded px-3 py-2 text-white"
                />
                <button
                  onClick={handleManualTake}
                  disabled={!selectedDevice || !manualTakeId || sending}
                  className="px-4 py-2 bg-ross-blue text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  <Play className="w-4 h-4 mr-1" />
                  Send
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Upcoming Schedules */}
        <section className="bg-ross-gray rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <Clock className="w-5 h-5 mr-2 text-blue-400" />
            Upcoming Schedules
          </h2>

          <div className="space-y-2">
            {upcomingSchedules.map(schedule => (
              <div
                key={schedule.id}
                className="flex items-center justify-between p-3 bg-ross-dark rounded"
              >
                <div>
                  <div className="font-medium">{schedule.name}</div>
                  <div className="text-sm text-gray-400">
                    {schedule.device_name} • {schedule.command_type === 'take' ? 'Take' : 'Route'}
                  </div>
                  {schedule.next_run && (
                    <div className="text-xs text-gray-500">
                      {new Date(schedule.next_run).toLocaleString()}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleRunSchedule(schedule.id)}
                  className="p-2 hover:bg-gray-700 rounded"
                  title="Run now"
                >
                  <Play className="w-4 h-4 text-green-400" />
                </button>
              </div>
            ))}
            {upcomingSchedules.length === 0 && (
              <div className="text-center py-4 text-gray-500">
                No upcoming schedules
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Recent Activity */}
      <section className="mt-6 bg-ross-gray rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
        <div className="space-y-2">
          {logs.slice(0, 10).map(log => (
            <div
              key={log.id}
              className="flex items-center justify-between p-3 bg-ross-dark rounded"
            >
              <div className="flex items-center">
                {log.status === 'success' ? (
                  <CheckCircle className="w-4 h-4 text-green-500 mr-3" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500 mr-3" />
                )}
                <div>
                  <div className="font-medium">{log.command}</div>
                  <div className="text-sm text-gray-400">
                    {log.device_name}
                    {log.schedule_name && ` • ${log.schedule_name}`}
                  </div>
                </div>
              </div>
              <div className="text-sm text-gray-500">
                {new Date(log.executed_at).toLocaleTimeString()}
              </div>
            </div>
          ))}
          {logs.length === 0 && (
            <div className="text-center py-4 text-gray-500">
              No recent activity
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
