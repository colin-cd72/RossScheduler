import { useEffect, useState } from 'react'
import { useAppStore, type Device, type RouterEndpoint } from '../stores/appStore'
import { Plus, Pencil, Trash2, Wifi, WifiOff, X, Upload } from 'lucide-react'

export default function Devices() {
  const { devices, deviceStatuses, loadDevices, createDevice, updateDevice, deleteDevice } = useAppStore()
  const [showModal, setShowModal] = useState(false)
  const [editingDevice, setEditingDevice] = useState<Device | null>(null)
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const [endpoints, setEndpoints] = useState<RouterEndpoint[]>([])
  const [testing, setTesting] = useState<number | null>(null)
  const [testResult, setTestResult] = useState<{ id: number; success: boolean; message: string } | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: 'xpression' as 'xpression' | 'ultrix',
    host: '',
    port: 7788,
    enabled: true
  })

  useEffect(() => {
    loadDevices()
  }, [])

  useEffect(() => {
    if (selectedDevice && selectedDevice.type === 'ultrix') {
      loadEndpoints(selectedDevice.id)
    }
  }, [selectedDevice])

  const loadEndpoints = async (deviceId: number) => {
    const eps = await window.api.getRouterEndpoints(deviceId)
    setEndpoints(eps)
  }

  const handleOpenModal = (device?: Device) => {
    if (device) {
      setEditingDevice(device)
      setFormData({
        name: device.name,
        type: device.type,
        host: device.host,
        port: device.port,
        enabled: device.enabled
      })
    } else {
      setEditingDevice(null)
      setFormData({
        name: '',
        type: 'xpression',
        host: '',
        port: 7788,
        enabled: true
      })
    }
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editingDevice) {
      await updateDevice(editingDevice.id, formData)
    } else {
      await createDevice(formData)
    }
    setShowModal(false)
  }

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this device? All associated schedules will also be deleted.')) {
      await deleteDevice(id)
      if (selectedDevice?.id === id) {
        setSelectedDevice(null)
      }
    }
  }

  const handleTestConnection = async (device: Device) => {
    setTesting(device.id)
    setTestResult(null)
    try {
      const result = await window.api.testConnection(device.id)
      setTestResult({ id: device.id, ...result })
      loadDevices()
    } catch (error) {
      setTestResult({ id: device.id, success: false, message: 'Test failed' })
    }
    setTesting(null)
  }

  const handleTypeChange = (type: 'xpression' | 'ultrix') => {
    setFormData(prev => ({
      ...prev,
      type,
      port: type === 'xpression' ? 7788 : 2000
    }))
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Devices</h1>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center px-4 py-2 bg-ross-blue text-white rounded hover:bg-blue-600"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Device
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Device List */}
        <div className="lg:col-span-2 space-y-4">
          {devices.map(device => {
            const status = deviceStatuses.get(device.id)
            const isConnected = status?.connected ?? false

            return (
              <div
                key={device.id}
                className={`p-4 rounded-lg border ${
                  selectedDevice?.id === device.id ? 'border-ross-blue' : 'border-gray-600'
                } bg-ross-gray cursor-pointer hover:border-gray-500`}
                onClick={() => setSelectedDevice(device)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    {device.enabled ? (
                      isConnected ? (
                        <Wifi className="w-5 h-5 text-green-500 mr-3" />
                      ) : (
                        <WifiOff className="w-5 h-5 text-red-500 mr-3" />
                      )
                    ) : (
                      <WifiOff className="w-5 h-5 text-gray-500 mr-3" />
                    )}
                    <div>
                      <div className="font-medium">{device.name}</div>
                      <div className="text-sm text-gray-400">
                        {device.type === 'xpression' ? 'Ross Xpression' : 'Ross Ultrix'} • {device.host}:{device.port}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {testResult?.id === device.id && (
                      <span className={`text-sm ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
                        {testResult.message}
                      </span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleTestConnection(device) }}
                      disabled={testing === device.id}
                      className="px-3 py-1 text-sm bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-50"
                    >
                      {testing === device.id ? 'Testing...' : 'Test'}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleOpenModal(device) }}
                      className="p-2 hover:bg-gray-700 rounded"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(device.id) }}
                      className="p-2 hover:bg-gray-700 rounded text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}

          {devices.length === 0 && (
            <div className="text-center py-12 text-gray-500 bg-ross-gray rounded-lg">
              No devices configured. Click "Add Device" to get started.
            </div>
          )}
        </div>

        {/* Device Details / Endpoint Configuration */}
        <div className="bg-ross-gray rounded-lg p-4">
          {selectedDevice ? (
            selectedDevice.type === 'ultrix' ? (
              <EndpointConfig
                device={selectedDevice}
                endpoints={endpoints}
                onRefresh={() => loadEndpoints(selectedDevice.id)}
              />
            ) : (
              <div className="text-center py-8 text-gray-400">
                <p className="mb-2">Xpression Device</p>
                <p className="text-sm">No additional configuration needed.</p>
                <p className="text-sm mt-4">Use Take IDs to trigger graphics.</p>
              </div>
            )
          ) : (
            <div className="text-center py-8 text-gray-500">
              Select a device to view details
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-ross-gray rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">
                {editingDevice ? 'Edit Device' : 'Add Device'}
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
                  className="w-full bg-ross-dark border border-gray-600 rounded px-3 py-2 text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={formData.type === 'xpression'}
                      onChange={() => handleTypeChange('xpression')}
                      className="mr-2"
                    />
                    Xpression
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={formData.type === 'ultrix'}
                      onChange={() => handleTypeChange('ultrix')}
                      className="mr-2"
                    />
                    Ultrix
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Host / IP Address</label>
                <input
                  type="text"
                  value={formData.host}
                  onChange={(e) => setFormData(prev => ({ ...prev, host: e.target.value }))}
                  placeholder="192.168.1.100"
                  className="w-full bg-ross-dark border border-gray-600 rounded px-3 py-2 text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Port</label>
                <input
                  type="number"
                  value={formData.port}
                  onChange={(e) => setFormData(prev => ({ ...prev, port: parseInt(e.target.value, 10) }))}
                  className="w-full bg-ross-dark border border-gray-600 rounded px-3 py-2 text-white"
                  required
                />
              </div>

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
                  {editingDevice ? 'Save' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function EndpointConfig({
  device,
  endpoints,
  onRefresh
}: {
  device: Device
  endpoints: RouterEndpoint[]
  onRefresh: () => void
}) {
  const [newEndpoint, setNewEndpoint] = useState({
    endpoint_type: 'source' as 'source' | 'destination',
    number: 1,
    name: ''
  })
  const [importText, setImportText] = useState('')
  const [showImport, setShowImport] = useState(false)

  const sources = endpoints.filter(e => e.endpoint_type === 'source')
  const destinations = endpoints.filter(e => e.endpoint_type === 'destination')

  const handleAddEndpoint = async () => {
    if (!newEndpoint.name) return
    await window.api.createRouterEndpoint({
      device_id: device.id,
      ...newEndpoint
    })
    setNewEndpoint(prev => ({ ...prev, number: prev.number + 1, name: '' }))
    onRefresh()
  }

  const handleDeleteEndpoint = async (id: number) => {
    await window.api.deleteRouterEndpoint(id)
    onRefresh()
  }

  const handleImport = async () => {
    await window.api.importEndpoints(device.id, importText)
    setImportText('')
    setShowImport(false)
    onRefresh()
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold">Router Endpoints</h3>
        <button
          onClick={() => setShowImport(!showImport)}
          className="flex items-center text-sm text-gray-400 hover:text-white"
        >
          <Upload className="w-4 h-4 mr-1" />
          Import CSV
        </button>
      </div>

      {showImport && (
        <div className="mb-4 p-3 bg-ross-dark rounded">
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="source,1,Camera 1&#10;source,2,Camera 2&#10;destination,1,Program"
            className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm h-24"
          />
          <button
            onClick={handleImport}
            className="mt-2 px-3 py-1 bg-ross-blue text-sm rounded"
          >
            Import
          </button>
        </div>
      )}

      {/* Add new endpoint */}
      <div className="mb-4 p-3 bg-ross-dark rounded">
        <div className="flex gap-2 mb-2">
          <select
            value={newEndpoint.endpoint_type}
            onChange={(e) => setNewEndpoint(prev => ({ ...prev, endpoint_type: e.target.value as 'source' | 'destination' }))}
            className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
          >
            <option value="source">Source</option>
            <option value="destination">Destination</option>
          </select>
          <input
            type="number"
            value={newEndpoint.number}
            onChange={(e) => setNewEndpoint(prev => ({ ...prev, number: parseInt(e.target.value, 10) }))}
            className="w-16 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
            min={1}
          />
          <input
            type="text"
            value={newEndpoint.name}
            onChange={(e) => setNewEndpoint(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Name"
            className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
          />
          <button
            onClick={handleAddEndpoint}
            className="px-2 py-1 bg-ross-blue rounded text-sm"
          >
            Add
          </button>
        </div>
      </div>

      {/* Sources */}
      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-400 mb-2">Sources ({sources.length})</h4>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {sources.map(ep => (
            <div key={ep.id} className="flex items-center justify-between p-2 bg-ross-dark rounded text-sm">
              <span>
                <span className="text-gray-500 mr-2">#{ep.number}</span>
                {ep.name}
              </span>
              <button
                onClick={() => handleDeleteEndpoint(ep.id)}
                className="text-gray-500 hover:text-red-400"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Destinations */}
      <div>
        <h4 className="text-sm font-medium text-gray-400 mb-2">Destinations ({destinations.length})</h4>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {destinations.map(ep => (
            <div key={ep.id} className="flex items-center justify-between p-2 bg-ross-dark rounded text-sm">
              <span>
                <span className="text-gray-500 mr-2">#{ep.number}</span>
                {ep.name}
              </span>
              <button
                onClick={() => handleDeleteEndpoint(ep.id)}
                className="text-gray-500 hover:text-red-400"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
