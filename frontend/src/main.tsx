import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

async function render() {
  if (clerkPubKey) {
    const { ClerkProvider } = await import('@clerk/clerk-react');
    const { default: ClerkTokenProvider } = await import('./components/ClerkTokenProvider');
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <ClerkProvider publishableKey={clerkPubKey} afterSignOutUrl="/kozy/">
          <ClerkTokenProvider>
            <App />
          </ClerkTokenProvider>
        </ClerkProvider>
      </React.StrictMode>
    );
  } else {
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  }
}

render();
