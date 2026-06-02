import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { syncLayoutProfileAttribute } from './platform/layoutProfile'
import { syncTouchFirstAttribute } from './platform/compositor'
import { isTauriDesktop, syncTauriDesktopAttribute } from './platform/tauriDesktop'
import App from './App.tsx'
import AppAccessGate from './components/AppAccessGate.tsx'

syncLayoutProfileAttribute()
syncTouchFirstAttribute()
syncTauriDesktopAttribute()

function Root() {
  const [unlocked, setUnlocked] = useState(() => isTauriDesktop())

  return (
    <>
      {!unlocked && <AppAccessGate onUnlock={() => setUnlocked(true)} />}
      {unlocked && (
        <StrictMode>
          <App />
        </StrictMode>
      )}
    </>
  )
}

createRoot(document.getElementById('root')!).render(<Root />)
