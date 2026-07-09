import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import './net/socket' // boots the socket connection + handlers

createRoot(document.getElementById('root')!).render(<App />)
