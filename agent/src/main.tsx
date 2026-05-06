import { createRoot } from 'react-dom/client'
import './index.css'
import Home from './pages/Home'

const mountAgent = () => {
  const container = document.getElementById('agent-root');
  
  if (!container) {
    console.warn('[Agent] Container #agent-root not found yet, retrying...');
    return false;
  }
  
  if (container.hasChildNodes() && container.querySelector('#agent-inner-root')) {
    console.log('[Agent] Already mounted.');
    return true;
  }
  
  console.log('[Agent] Container found! Mounting now...');
  try {
    createRoot(container).render(
      <div id="agent-inner-root" style={{ width: '100%', height: '100%' }}>
         <Home />
      </div>
    );
    return true;
  } catch (e) {
    console.error('[Agent] Mount error:', e);
    return false;
  }
};

// Polling for container
let mountAttempts = 0;
const mountInterval = setInterval(() => {
  mountAttempts++;
  const success = mountAgent();
  if (success || mountAttempts > 100) { // Stop after 10 seconds
    clearInterval(mountInterval);
    if (!success) console.error('[Agent] Failed to mount after 100 attempts.');
  }
}, 100);

// Global trigger for manual mounting if needed
(window as any).mountAgentManually = mountAgent;
