import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AppProvider } from './context/AppContext.tsx'
import { AuthProvider } from './auth/AuthProvider.tsx'
import { CustomerAuthProvider } from './auth/customer/CustomerAuthProvider.tsx'
import { BrowserRouter } from 'react-router-dom'
import { redirectLegacyHash } from './routing/legacyHashRedirect.ts'

const renderApp = () => createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CustomerAuthProvider>
          <AppProvider>
            <App />
          </AppProvider>
        </CustomerAuthProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)

void redirectLegacyHash()
  .then((redirected) => { if (!redirected) renderApp() })
  .catch(renderApp)

