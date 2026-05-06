import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Home from './pages/Home'

console.log('[Agent] Mounting to agent-root...');
createRoot(document.getElementById('agent-root')!).render(
  <StrictMode>
    <div id="agent-inner-root" style={{ width: '100%', height: '100%' }}>
       <Home />
    </div>
  </StrictMode>,
)
