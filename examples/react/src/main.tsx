import React from 'react';
import ReactDOM from 'react-dom/client';
import 'xrpl-connect'; // Register web components
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
