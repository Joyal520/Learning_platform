import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

function mountEdtechraOcr() {
  const rootElement = document.getElementById('root')
  if (!rootElement) return
  if (!window.EdtechraOcrRoot) {
    window.EdtechraOcrRoot = createRoot(rootElement)
  }
  window.EdtechraOcrRoot.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

window.EdtechraOcrMount = mountEdtechraOcr
mountEdtechraOcr()
