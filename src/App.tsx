import { Routes, Route, NavLink } from 'react-router-dom'
import { LayoutDashboard, Calendar, Settings, History, Play } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import Schedules from './pages/Schedules'
import Devices from './pages/Devices'
import HistoryPage from './pages/History'

function App() {
  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <nav className="w-64 bg-ross-gray flex flex-col">
        {/* Header with drag region */}
        <div className="drag-region h-12 flex items-center px-4 border-b border-gray-700">
          <Play className="w-6 h-6 text-ross-blue mr-2 no-drag" />
          <span className="font-bold text-lg no-drag">Ross Scheduler</span>
        </div>

        {/* Navigation */}
        <div className="flex-1 py-4">
          <NavItem to="/" icon={<LayoutDashboard className="w-5 h-5" />} label="Dashboard" />
          <NavItem to="/schedules" icon={<Calendar className="w-5 h-5" />} label="Schedules" />
          <NavItem to="/devices" icon={<Settings className="w-5 h-5" />} label="Devices" />
          <NavItem to="/history" icon={<History className="w-5 h-5" />} label="History" />
        </div>

        {/* Footer */}
        <div className="p-4 text-xs text-gray-500 border-t border-gray-700">
          Ross Equipment Scheduler v1.0.0
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-ross-dark">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/schedules" element={<Schedules />} />
          <Route path="/devices" element={<Devices />} />
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </main>
    </div>
  )
}

function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center px-4 py-3 mx-2 rounded-lg transition-colors ${
          isActive
            ? 'bg-ross-blue text-white'
            : 'text-gray-400 hover:bg-gray-700 hover:text-white'
        }`
      }
    >
      {icon}
      <span className="ml-3">{label}</span>
    </NavLink>
  )
}

export default App
