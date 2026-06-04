import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { syncLayoutProfileAttribute } from './platform/layoutProfile'
import { syncTouchFirstAttribute } from './platform/compositor'
import { isNativeDesktop, syncNativeShellAttributes } from './platform/nativeShell'
import App from './App.tsx'
import AppAccessGate, { APP_ACCESS_GATE_ENABLED } from './components/AppAccessGate.tsx'

syncLayoutProfileAttribute()
syncTouchFirstAttribute()
syncNativeShellAttributes()

function Root() {
  useEffect(() => {
    syncNativeShellAttributes()
  }, [])

  const [unlocked, setUnlocked] = useState(
    () => !APP_ACCESS_GATE_ENABLED || isNativeDesktop(),
  )

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
