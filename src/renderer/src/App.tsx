import React from 'react'
import { Header }             from './components/Header'
import { SetupScreen }        from './screens/SetupScreen'
import { LiveScreen }         from './screens/LiveScreen'
import { MultiChannelScreen }    from './screens/MultiChannelScreen'
import { MultiTrackImportScreen } from './screens/MultiTrackImportScreen'
import { SettingsScreen }         from './screens/SettingsScreen'
import { useAppStore }        from './store/appStore'
import { usePreferences }     from './hooks/usePreferences'

export function App(): React.ReactElement {
  const currentScreen = useAppStore(s => s.currentScreen)

  // Load and persist preferences via IPC (runs silently in the background)
  usePreferences()

  return (
    <div className="app-root">
      <Header />
      <main className="app-main">
        {currentScreen === 'setup'        && <SetupScreen />}
        {currentScreen === 'live'         && <LiveScreen />}
        {currentScreen === 'multichannel' && <MultiChannelScreen />}
        {currentScreen === 'import'       && <MultiTrackImportScreen />}
        {currentScreen === 'settings'     && <SettingsScreen />}
      </main>
    </div>
  )
}
