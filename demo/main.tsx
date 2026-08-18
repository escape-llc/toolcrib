import React from 'react';
import ReactDOM from 'react-dom/client';
import { ToolcribProvider } from '#toolcrib';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToolcribProvider>
      <App />
    </ToolcribProvider>
  </React.StrictMode>
);
