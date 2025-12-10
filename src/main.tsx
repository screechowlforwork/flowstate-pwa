import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './index.css';
import App from './App';

// Add Inter font from Google Fonts
const link = document.createElement('link');
link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
link.rel = 'stylesheet';
document.head.appendChild(link);

// Register service worker for PWA
registerSW();

// Set app height for mobile browsers
const setAppHeight = () => {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
};

window.addEventListener('resize', setAppHeight);
setAppHeight();

// Add keyboard event listener for better accessibility
document.addEventListener('keydown', (e) => {
  // Add keyboard shortcuts if needed
  if (e.key === 'Escape') {
    // Handle escape key
  }
});

// Render the app
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
