import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './lib/pwa.js' // service worker + installatievraag zo vroeg mogelijk

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
