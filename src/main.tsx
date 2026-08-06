import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from './theme/themeContext';
import { ToastProvider } from './components/Toast/ToastContext';
import { ToastContainer as ToastView } from './components/Toast/Toast';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <App />
        <ToastView />
      </ToastProvider>
    </ThemeProvider>
  </React.StrictMode>
);
