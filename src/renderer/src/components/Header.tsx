import React from 'react'
import { useAppStore } from '../store/appStore'
import type { AppScreen } from '../store/appStore'

interface NavItem {
  id: AppScreen
  label: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'setup',        label: 'Setup' },
  { id: 'live',         label: 'Live Analysis' },
  { id: 'multichannel', label: 'Multi-Channel' },
  { id: 'import',       label: 'Import' },
  { id: 'settings',     label: 'Settings' }
]

export function Header(): React.ReactElement {
  const currentScreen = useAppStore(s => s.currentScreen)
  const navigateTo    = useAppStore(s => s.navigateTo)
  const isCapturing   = useAppStore(s => s.isCapturing)

  return (
    <header className="app-header">
      <div className="header-brand">
        <span className="brand-icon">◈</span>
        <span className="brand-name">SoundPilot</span>
        {isCapturing && <span className="capture-badge">● LIVE</span>}
      </div>

      <nav className="header-nav">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`nav-btn ${currentScreen === item.id ? 'nav-btn--active' : ''}`}
            onClick={() => navigateTo(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </header>
  )
}
