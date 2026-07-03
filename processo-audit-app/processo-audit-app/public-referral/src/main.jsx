import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import PublicReferral from './pages/PublicReferral';
import './index.css';

const BrandingProviderPlaceholder = ({ children }) => {
  const [branding, setBranding] = React.useState(null);

  React.useEffect(() => {
    fetch('/api/branding/public')
      .then(res => res.json())
      .then(data => setBranding(data))
      .catch(err => console.error('Erro ao carregar branding:', err));
  }, []);

  return (
    <div style={{ 
      '--primary-color': branding?.primary_color || '#0ba52b',
      '--primary-light': branding?.primary_light || '#ecfdf5',
      '--primary-dark': branding?.primary_dark || '#098a24',
      '--secondary-color': branding?.secondary_color || '#bbf804',
      '--accent-color': branding?.accent_color || '#274518',
      '--background-color': branding?.background_color || '#f4f7f6',
      '--surface-color': '#ffffff',
      '--text-dark': '#1a202c',
      '--text-medium': '#4a5568',
      '--text-light': '#718096',
      '--text-muted': '#a0aec0',
      '--border-color': '#e2e8f0',
      '--border-light': '#edf2f7',
      '--radius-md': '8px',
      '--radius-lg': '12px',
      '--radius-xl': '20px',
      '--transition': 'all 0.2s ease-in-out',
      '--shadow-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
    }}>
      {React.Children.map(children, child => 
        React.cloneElement(child, { branding })
      )}
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <BrandingProviderPlaceholder>
        <Routes>
          <Route path="/" element={<PublicReferral />} />
          <Route path="/indique" element={<PublicReferral />} />
        </Routes>
      </BrandingProviderPlaceholder>
    </BrowserRouter>
  </React.StrictMode>
);
