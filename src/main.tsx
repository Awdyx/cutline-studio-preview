import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { syncLayoutProfileAttribute } from './platform/layoutProfile'
import { syncTouchFirstAttribute } from './platform/compositor'
import App from './App.tsx'

syncLayoutProfileAttribute()
syncTouchFirstAttribute()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
