import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider, ToastProvider, ToastContainer as ToastView } from '#toolcrib';
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
