import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { translations, Language, LanguageContextType } from './translationHelper';

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [language, setLanguage] = useState<Language>(() => {
        const saved = localStorage.getItem('emprexa_lang');
        if (saved === 'en' || saved === 'es') {
            return saved as Language;
        }
        return 'es';
    });

    useEffect(() => {
        localStorage.setItem('emprexa_lang', language);
    }, [language]);

    const t = (key: string, params?: Record<string, any>): string => {
        const keys = key.split('.');
        let current: any = translations[language];

        for (const k of keys) {
            if (current === undefined || current[k] === undefined) {
                console.warn(`Translation key not found: ${key}`);
                return key;
            }
            current = current[k];
        }

        let translation = current as string;
        if (params) {
            Object.keys(params).forEach(param => {
                translation = translation.replace(new RegExp(`{${param}}`, 'g'), params[param]);
            });
        }

        return translation;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
}
