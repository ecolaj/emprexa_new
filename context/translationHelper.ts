
import { en } from '../locales/en';
import { es } from '../locales/es';

export type Language = 'es' | 'en';

export type TranslationsMap = {
    [key in Language]: Record<string, any>;
};

export const translations: TranslationsMap = {
    es,
    en
};

export interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string, params?: Record<string, any>) => string;
}
