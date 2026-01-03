import { useEffect, useState } from 'react'
import { useAppStore } from '../stores/appStore'
import { CheckCircle, XCircle, Download, Trash2, Search } from 'lucide-react'

export default function HistoryPage() {
  const { logs, devices, loadLogs, loadDevices } = useAppStore()
  const [filter, setFilter] = useState({
    search: '',
    status: 'all' as 'all' | 'success' | 'error',
    deviceId: 0
  })

  useEffect(() => {
    loadDevices()
    loadLogs(500)
  }, [])

  const filteredLogs = logs.filter(log => {
    if (filter.status !== 'all' && log.status !== filter.status) return false
    if (filter.deviceId && log.device_id !== filter.deviceId) return false
    if (filter.search) {
      const searchLower = filter.search.toLowerCase()
      return (
        log.command.toLowerCase().includes(searchLower) ||
        log.device_name?.toLowerCase().includes(searchLower) ||
        log.schedule_name?.toLowerCase().includes(searchLower) ||
        log.response?.toLowerCase().includes(searchLower)
      )
    }
    return true
  })

  const handleExport = async (format: 'csv' | 'json') => {
    const data = await window.api.exportLogs(format)
    const blob = new Blob([data], { type: format === 'json' ? 'application/json' : 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ross-scheduler-logs.${format}`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleClear = async () => {
    if (confirm('Are you sure you want to clear all logs? This cannot be undone.')) {
      await window.api.clearLogs()
      loadLogs(500)
    }
  }

  const successCount = logs.filter(l => l.status === 'success').length
  const errorCount = logs.filter(l => l.status === 'error').length

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Command History</h1>
        <div className="flex gap-2">
          <button
            onClick={() => handleExport('csv')}
            className="flex items-center px-3 py-2 bg-gray-700 rounded hover:bg-gray-600"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </button>
          <button
            onClick={() => handleExport('json')}
            className="flex items-center px-3 py-2 bg-gray-700 rounded hover:bg-gray-600"
          >
            <Download className="w-4 h-4 mr-2" />
            Export JSON
          </button>
          <button
            onClick={handleClear}
            className="flex items-center px-3 py-2 bg-red-600/20 text-red-400 rounded hover:bg-red-600/30"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear All
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-ross-gray rounded-lg p-4">
          <div className="text-2xl font-bold">{logs.length}</div>
          <div className="text-sm text-gray-400">Total Commands</div>
        </div>
        <div className="bg-ross-gray rounded-lg p-4">
          <div className="text-2xl font-bold text-green-400">{successCount}</div>
          <div className="text-sm text-gray-400">Successful</div>
        </div>
        <div className="bg-ross-gray rounded-lg p-4">
          <div className="text-2xl font-bold text-red-400">{errorCount}</div>
          <div className="text-sm text-gray-400">Failed</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-ross-gray rounded-lg p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={filter.search}
                onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value }))}
                placeholder="Search commands, devices, schedules..."
                className="w-full bg-ross-dark border border-gray-600 rounded pl-10 pr-3 py-2 text-white"
              />
            </div>
          </div>
          <div>
            <select
              value={filter.status}
              onChange={(e) => setFilter(prev => ({ ...prev, status: e.target.value as 'all' | 'success' | 'error' }))}
              className="bg-ross-dark border border-gray-600 rounded px-3 py-2 text-white"
            >
              <option value="all">All Statuses</option>
              <option value="success">Success Only</option>
              <option value="error">Errors Only</option>
            </select>
          </div>
          <div>
            <select
              value={filter.deviceId}
              onChange={(e) => setFilter(prev => ({ ...prev, deviceId: parseInt(e.target.value, 10) }))}
              className="bg-ross-dark border border-gray-600 rounded px-3 py-2 text-white"
            >
              <option value={0}>All Devices</option>
              {devices.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Log Table */}
      <div className="bg-ross-gray rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-800/50">
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Status</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Time</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Device</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Command</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Schedule</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Response</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map(log => (
              <tr key={log.id} className="border-t border-gray-700 hover:bg-gray-800/30">
                <td className="px-4 py-3">
                  {log.status === 'success' ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  <div>{new Date(log.executed_at).toLocaleDateString()}</div>
                  <div className="text-gray-500">{new Date(log.executed_at).toLocaleTimeString()}</div>
                </td>
                <td className="px-4 py-3 text-sm">{log.device_name}</td>
                <td className="px-4 py-3 text-sm font-mono">{log.command}</td>
                <td className="px-4 py-3 text-sm text-gray-400">{log.schedule_name || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-400 max-w-xs truncate" title={log.response || ''}>
                  {log.response || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredLogs.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            {logs.length === 0 ? 'No command history yet' : 'No logs match your filters'}
          </div>
        )}
      </div>

      {filteredLogs.length > 0 && (
        <div className="mt-4 text-sm text-gray-500 text-center">
          Showing {filteredLogs.length} of {logs.length} entries
        </div>
      )}
    </div>
  )
}
