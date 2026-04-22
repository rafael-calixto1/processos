import React, { createContext, useState, useContext, useEffect } from 'react';

const BrandingContext = createContext();

export const BrandingProvider = ({ children }) => {
  const [branding, setBranding] = useState({
    company_name: 'Minha Empresa',
    logo_url: null,
    primary_color: '#0ba52b',
    secondary_color: '#bbf804',
    accent_color: '#274518',
    background_color: '#ffffff',
    favicon_url: null
  });

  useEffect(() => {
    fetchBranding();
    const interval = setInterval(fetchBranding, 30000); // Atualizar a cada 30s
    return () => clearInterval(interval);
  }, []);

  const fetchBranding = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/branding');
      if (response.ok) {
        const data = await response.json();
        setBranding(data);
      }
    } catch (error) {
      console.error('Erro ao buscar branding:', error);
    }
  };

  return (
    <BrandingContext.Provider value={{ branding, fetchBranding }}>
      {children}
    </BrandingContext.Provider>
  );
};

export const useBranding = () => {
  const context = useContext(BrandingContext);
  if (!context) {
    throw new Error('useBranding deve ser usado dentro de BrandingProvider');
  }
  return context;
};
