import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { syncLayoutProfileAttribute } from './platform/layoutProfile'
import { syncTouchFirstAttribute } from './platform/compositor'
import { applyDefaultSeedForFirstVisit } from './defaults/bootstrapDefaultSeed'
import App from './App.tsx'
import AppAccessGate from './components/AppAccessGate.tsx'
import { loadAppAccessUnlocked, saveAppAccessUnlocked } from './components/appAccessPersistence'

syncLayoutProfileAttribute()
syncTouchFirstAttribute()

function Root() {
  const [unlocked, setUnlocked] = useState(loadAppAccessUnlocked)

  const handleUnlock = (persist: boolean) => {
    if (persist) saveAppAccessUnlocked()
    setUnlocked(true)
  }

  return (
    <>
      {!unlocked && <AppAccessGate onUnlock={handleUnlock} />}
      {unlocked && (
        <StrictMode>
          <App />
        </StrictMode>
      )}
    </>
  )
}

async function boot() {
  await applyDefaultSeedForFirstVisit()
  if (import.meta.env.DEV) {
    void import('./defaults/devDefaultSeedCapture')
  }
  createRoot(document.getElementById('root')!).render(<Root />)
}

void boot()
