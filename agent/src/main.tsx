import { createRoot } from 'react-dom/client'
import './index.css'
import Home from './pages/Home'

const logToScreen = (msg: string) => {
  const debugDiv = document.getElementById('agent-debug-console');
  if (debugDiv) {
    debugDiv.innerHTML += `> [Main] ${msg}<br>`;
    debugDiv.scrollTop = debugDiv.scrollHeight;
  }
  console.log(`[Main] ${msg}`);
};

const mountAgent = () => {
  const container = document.getElementById('agent-root');
  
  if (!container) {
    logToScreen('Container #agent-root not found yet, retrying...');
    return false;
  }
  
  if (container.hasChildNodes() && container.querySelector('#agent-inner-root')) {
    logToScreen('Already mounted.');
    return true;
  }
  
  logToScreen('Container found! Mounting now...');
  try {
    createRoot(container).render(
      <div id="agent-inner-root" style={{ width: '100%', height: '100%' }}>
         <Home />
      </div>
    );
    logToScreen('Render called.');
    return true;
  } catch (e: any) {
    logToScreen(`Mount error: ${e.message}`);
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
    if (!success) logToScreen('Failed to mount after 100 attempts.');
  }
}, 100);

// Global trigger for manual mounting if needed
(window as any).mountAgentManually = mountAgent;
