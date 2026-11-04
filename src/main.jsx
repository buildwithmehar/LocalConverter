import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import App from './App.jsx';
import { UiProvider } from './components/ui-kit.jsx';
import './magicui.css';
import './styles.css';
import './homepage-details.css';
import './hero-background.css';
import './header.css';
import './converter-experience.css';
import './typography.css';
import './magicui-integration.css';
import './format-catalog.css';
import './light-motion.css';
import './premium-feedback.css';
import './homepage-refresh.css';
import './theme-palette.css';
import './reading-guides.css';
import './format-picker.css';
import './page-scrollbar.css';
import './brand-identity.css';
import './information-pages.css';
import './tools-menu.css';
import './everyday-tools.css';
import './operation-guides.css';
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <UiProvider>
      <App />
    </UiProvider>
  </React.StrictMode>,
);
