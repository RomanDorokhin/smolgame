import { createRoot } from 'react-dom/client'
import './index.css'
import Home from './pages/Home'

const mountAgent = () => {
  const container = document.getElementById('agent-root');
  if (!container) {
    console.error('[Agent] Container #agent-root not found!');
    return;
  }
  
  console.log('[Agent] Mounting to agent-root...');
  createRoot(container).render(
    <div id="agent-inner-root" style={{ width: '100%', height: '100%' }}>
       <Home />
    </div>
  );
};

// Start mounting
mountAgent();
