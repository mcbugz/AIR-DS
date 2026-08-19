import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import type { FleetData } from '../types.ts';
import { App } from './App.tsx';
import './dashboard.css';

declare global {
  interface Window {
    __FLEET_DATA__?: FleetData;
  }
}

const data = window.__FLEET_DATA__;
const el = document.getElementById('root');
if (!el) throw new Error('fleet dashboard: #root not found');
if (!data) throw new Error('fleet dashboard: window.__FLEET_DATA__ missing (data.js not loaded?)');

createRoot(el).render(
  <StrictMode>
    <App data={data} />
  </StrictMode>,
);
