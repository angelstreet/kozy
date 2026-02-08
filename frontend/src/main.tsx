import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import ClerkTokenProvider from './components/ClerkTokenProvider';
import App from './App';
import './index.css';

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!clerkPubKey) {
  console.error('Missing VITE_CLERK_PUBLISHABLE_KEY — add it to .env');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {clerkPubKey ? (
      <ClerkProvider publishableKey={clerkPubKey} afterSignOutUrl="/kozy/">
        <ClerkTokenProvider>
          <App />
        </ClerkTokenProvider>
      </ClerkProvider>
    ) : (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h1>⚠️ Clerk not configured</h1>
        <p>Set <code>VITE_CLERK_PUBLISHABLE_KEY</code> in <code>frontend/.env</code></p>
      </div>
    )}
  </React.StrictMode>
);
