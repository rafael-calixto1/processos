import { createContext, useState, useContext, useEffect, ReactNode } from 'react';

export interface Branding {
  company_name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  favicon_url: string | null;
}

interface BrandingContextValue {
  branding: Branding;
  fetchBranding: () => Promise<void>;
}

const BrandingContext = createContext<BrandingContextValue | undefined>(undefined);

export const BrandingProvider = ({ children }: { children: ReactNode }) => {
  const [branding, setBranding] = useState<Branding>({
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

  useEffect(() => {
    if (branding.favicon_url) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = branding.favicon_url;
    }
  }, [branding.favicon_url]);

  const fetchBranding = async () => {
    try {
      const response = await fetch('/api/branding');
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

export const useBranding = (): BrandingContextValue => {
  const context = useContext(BrandingContext);
  if (!context) {
    throw new Error('useBranding deve ser usado dentro de BrandingProvider');
  }
  return context;
};
