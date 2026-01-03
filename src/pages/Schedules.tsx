import { useEffect, useState } from 'react'
import { useAppStore, type Schedule, type Device, type RouterEndpoint } from '../stores/appStore'
import { Plus, Pencil, Trash2, Play, X, Copy, Clock, Calendar } from 'lucide-react'

export default function Schedules() {
  const { schedules, devices, loadSchedules, loadDevices, createSchedule, updateSchedule, deleteSchedule, toggleSchedule } = useAppStore()
  const [showModal, setShowModal] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null)
  const [endpoints, setEndpoints] = useState<RouterEndpoint[]>([])

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    device_id: 0,
    command_type: 'take' as 'take' | 'route',
    take_id: 1,
    source: 1,
    destination: 1,
    schedule_type: 'once' as 'once' | 'recurring',
    run_at: '',
    cron_expression: '',
    cron_preset: 'custom',
    enabled: true
  })

  useEffect(() => {
    loadSchedules()
    loadDevices()
  }, [])

  useEffect(() => {
    if (formData.device_id) {
      const device = devices.find(d => d.id === formData.device_id)
      if (device?.type === 'ultrix') {
        loadEndpoints(formData.device_id)
      }
    }
  }, [formData.device_id])

  const loadEndpoints = async (deviceId: number) => {
    const eps = await window.api.getRouterEndpoints(deviceId)
    setEndpoints(eps)
  }

  const handleOpenModal = (schedule?: Schedule) => {
    if (schedule) {
      setEditingSchedule(schedule)
      const cmdData = JSON.parse(schedule.command_data)
      setFormData({
        name: schedule.name,
        device_id: schedule.device_id,
        command_type: schedule.command_type,
        take_id: cmdData.takeId || 1,
        source: cmdData.source || 1,
        destination: cmdData.destination || 1,
        schedule_type: schedule.schedule_type,
        run_at: schedule.run_at ? schedule.run_at.slice(0, 16) : '',
        cron_expression: schedule.cron_expression || '',
        cron_preset: 'custom',
        enabled: schedule.enabled
      })
    } else {
      setEditingSchedule(null)
      const now = new Date()
      now.setMinutes(now.getMinutes() + 5)
      setFormData({
        name: '',
        device_id: devices[0]?.id || 0,
        command_type: 'take',
        take_id: 1,
        source: 1,
        destination: 1,
        schedule_type: 'once',
        run_at: now.toISOString().slice(0, 16),
        cron_expression: '0 * * * *',
        cron_preset: 'custom',
        enabled: true
      })
    }
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const commandData = formData.command_type === 'take'
      ? { takeId: formData.take_id }
      : { source: formData.source, destination: formData.destination }

    const scheduleData = {
      name: formData.name,
      device_id: formData.device_id,
      command_type: formData.command_type,
      command_data: JSON.stringify(commandData),
      schedule_type: formData.schedule_type,
      cron_expression: formData.schedule_type === 'recurring' ? formData.cron_expression : null,
      run_at: formData.schedule_type === 'once' ? new Date(formData.run_at).toISOString() : null,
      enabled: formData.enabled
    }

    if (editingSchedule) {
      await updateSchedule(editingSchedule.id, scheduleData)
    } else {
      await createSchedule(scheduleData)
    }
    setShowModal(false)
  }

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this schedule?')) {
      await deleteSchedule(id)
    }
  }

  const handleDuplicate = async (schedule: Schedule) => {
    const cmdData = JSON.parse(schedule.command_data)
    await createSchedule({
      name: `${schedule.name} (Copy)`,
      device_id: schedule.device_id,
      command_type: schedule.command_type,
      command_data: JSON.stringify(cmdData),
      schedule_type: schedule.schedule_type,
      cron_expression: schedule.cron_expression,
      run_at: schedule.run_at,
      enabled: false
    })
  }

  const handleRunNow = async (id: number) => {
    await window.api.runScheduleNow(id)
    loadSchedules()
  }

  const selectedDevice = devices.find(d => d.id === formData.device_id)
  const sources = endpoints.filter(e => e.endpoint_type === 'source')
  const destinations = endpoints.filter(e => e.endpoint_type === 'destination')

  const cronPresets = [
    { label: 'Every minute', value: '* * * * *' },
    { label: 'Every 5 minutes', value: '*/5 * * * *' },
    { label: 'Every hour', value: '0 * * * *' },
    { label: 'Every day at midnight', value: '0 0 * * *' },
    { label: 'Every day at noon', value: '0 12 * * *' },
    { label: 'Every Monday at 9am', value: '0 9 * * 1' },
    { label: 'Custom', value: 'custom' }
  ]

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Schedules</h1>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center px-4 py-2 bg-ross-blue text-white rounded hover:bg-blue-600"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Schedule
        </button>
      </div>

      {/* Schedule List */}
      <div className="space-y-4">
        {schedules.map(schedule => (
          <div
            key={schedule.id}
            className={`p-4 rounded-lg border ${schedule.enabled ? 'border-gray-600' : 'border-gray-700 opacity-60'} bg-ross-gray`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <label className="relative inline-flex items-center cursor-pointer mr-4">
                  <input
                    type="checkbox"
                    checked={schedule.enabled}
                    onChange={(e) => toggleSchedule(schedule.id, e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-ross-blue"></div>
                </label>
                <div>
                  <div className="font-medium flex items-center">
                    {schedule.name}
                    {schedule.schedule_type === 'recurring' ? (
                      <Clock className="w-4 h-4 ml-2 text-blue-400" />
                    ) : (
                      <Calendar className="w-4 h-4 ml-2 text-green-400" />
                    )}
                  </div>
                  <div className="text-sm text-gray-400">
                    {schedule.device_name} • {schedule.command_type === 'take' ? 'Take' : 'Route'}
                    {schedule.command_type === 'take' && ` #${JSON.parse(schedule.command_data).takeId}`}
                    {schedule.command_type === 'route' && ` ${JSON.parse(schedule.command_data).source} → ${JSON.parse(schedule.command_data).destination}`}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {schedule.schedule_type === 'recurring' ? (
                      <>Cron: {schedule.cron_expression}</>
                    ) : (
                      <>Run at: {schedule.run_at ? new Date(schedule.run_at).toLocaleString() : 'Not set'}</>
                    )}
                    {schedule.next_run && (
                      <span className="ml-2">
                        • Next: {new Date(schedule.next_run).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleRunNow(schedule.id)}
                  className="p-2 hover:bg-gray-700 rounded text-green-400"
                  title="Run now"
                >
                  <Play className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDuplicate(schedule)}
                  className="p-2 hover:bg-gray-700 rounded"
                  title="Duplicate"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleOpenModal(schedule)}
                  className="p-2 hover:bg-gray-700 rounded"
                  title="Edit"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(schedule.id)}
                  className="p-2 hover:bg-gray-700 rounded text-red-400"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {schedules.length === 0 && (
          <div className="text-center py-12 text-gray-500 bg-ross-gray rounded-lg">
            No schedules configured. Click "Add Schedule" to create one.
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-ross-gray rounded-lg p-6 w-full max-w-lg my-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">
                {editingSchedule ? 'Edit Schedule' : 'Add Schedule'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-700 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Morning Show Open"
                  className="w-full bg-ross-dark border border-gray-600 rounded px-3 py-2 text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Device</label>
                <select
                  value={formData.device_id}
                  onChange={(e) => {
                    const deviceId = parseInt(e.target.value, 10)
                    const device = devices.find(d => d.id === deviceId)
                    setFormData(prev => ({
                      ...prev,
                      device_id: deviceId,
                      command_type: device?.type === 'ultrix' ? 'route' : 'take'
                    }))
                  }}
                  className="w-full bg-ross-dark border border-gray-600 rounded px-3 py-2 text-white"
                  required
                >
                  <option value="">Select device...</option>
                  {devices.filter(d => d.enabled).map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.type === 'xpression' ? 'Xpression' : 'Ultrix'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Command Configuration */}
              {selectedDevice?.type === 'xpression' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Take ID</label>
                  <input
                    type="number"
                    value={formData.take_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, take_id: parseInt(e.target.value, 10) }))}
                    min={1}
                    className="w-full bg-ross-dark border border-gray-600 rounded px-3 py-2 text-white"
                    required
                  />
                </div>
              )}

              {selectedDevice?.type === 'ultrix' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Source</label>
                    <select
                      value={formData.source}
                      onChange={(e) => setFormData(prev => ({ ...prev, source: parseInt(e.target.value, 10) }))}
                      className="w-full bg-ross-dark border border-gray-600 rounded px-3 py-2 text-white"
                    >
                      {sources.length > 0 ? (
                        sources.map(s => (
                          <option key={s.id} value={s.number}>{s.name} (#{s.number})</option>
                        ))
                      ) : (
                        Array.from({ length: 16 }, (_, i) => (
                          <option key={i + 1} value={i + 1}>Source {i + 1}</option>
                        ))
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Destination</label>
                    <select
                      value={formData.destination}
                      onChange={(e) => setFormData(prev => ({ ...prev, destination: parseInt(e.target.value, 10) }))}
                      className="w-full bg-ross-dark border border-gray-600 rounded px-3 py-2 text-white"
                    >
                      {destinations.length > 0 ? (
                        destinations.map(d => (
                          <option key={d.id} value={d.number}>{d.name} (#{d.number})</option>
                        ))
                      ) : (
                        Array.from({ length: 16 }, (_, i) => (
                          <option key={i + 1} value={i + 1}>Destination {i + 1}</option>
                        ))
                      )}
                    </select>
                  </div>
                </div>
              )}

              {/* Schedule Type */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Schedule Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={formData.schedule_type === 'once'}
                      onChange={() => setFormData(prev => ({ ...prev, schedule_type: 'once' }))}
                      className="mr-2"
                    />
                    One-time
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={formData.schedule_type === 'recurring'}
                      onChange={() => setFormData(prev => ({ ...prev, schedule_type: 'recurring' }))}
                      className="mr-2"
                    />
                    Recurring
                  </label>
                </div>
              </div>

              {/* One-time datetime */}
              {formData.schedule_type === 'once' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Run At</label>
                  <input
                    type="datetime-local"
                    value={formData.run_at}
                    onChange={(e) => setFormData(prev => ({ ...prev, run_at: e.target.value }))}
                    className="w-full bg-ross-dark border border-gray-600 rounded px-3 py-2 text-white"
                    required
                  />
                </div>
              )}

              {/* Recurring cron */}
              {formData.schedule_type === 'recurring' && (
                <>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Preset</label>
                    <select
                      value={formData.cron_preset}
                      onChange={(e) => {
                        const preset = e.target.value
                        if (preset !== 'custom') {
                          setFormData(prev => ({ ...prev, cron_preset: preset, cron_expression: preset }))
                        } else {
                          setFormData(prev => ({ ...prev, cron_preset: 'custom' }))
                        }
                      }}
                      className="w-full bg-ross-dark border border-gray-600 rounded px-3 py-2 text-white"
                    >
                      {cronPresets.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Cron Expression</label>
                    <input
                      type="text"
                      value={formData.cron_expression}
                      onChange={(e) => setFormData(prev => ({ ...prev, cron_expression: e.target.value, cron_preset: 'custom' }))}
                      placeholder="* * * * *"
                      className="w-full bg-ross-dark border border-gray-600 rounded px-3 py-2 text-white font-mono"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Format: minute hour day-of-month month day-of-week
                    </p>
                  </div>
                </>
              )}

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.enabled}
                    onChange={(e) => setFormData(prev => ({ ...prev, enabled: e.target.checked }))}
                    className="mr-2"
                  />
                  Enabled
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-ross-blue text-white rounded hover:bg-blue-600"
                >
                  {editingSchedule ? 'Save' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
