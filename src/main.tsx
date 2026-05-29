import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { syncLayoutProfileAttribute } from './platform/layoutProfile'
import { syncTouchFirstAttribute } from './platform/compositor'
import App from './App.tsx'
import AppAccessGate from './components/AppAccessGate.tsx'

syncLayoutProfileAttribute()
syncTouchFirstAttribute()

function Root() {
  const [unlocked, setUnlocked] = useState(false)

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
