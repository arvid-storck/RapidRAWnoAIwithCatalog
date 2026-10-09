import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

// Production (including portable builds) has no runtime console logging.
if (import.meta.env.PROD) {
  const silent = () => {};
  Object.assign(console, { debug: silent, info: silent, log: silent, warn: silent, error: silent });
}

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
