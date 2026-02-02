import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface PrivacyContextType {
    isVisible: boolean;
    toggleVisibility: () => void;
}

const PrivacyContext = createContext({} as PrivacyContextType);

export function PrivacyProvider({ children }: { children: ReactNode }) {
    // Começa lendo do localStorage, se não tiver nada, assume que é TRUE (visível)
    const [isVisible, setIsVisible] = useState(() => {
        const saved = localStorage.getItem('fortuna_privacy');
        return saved !== null ? JSON.parse(saved) : true;
    });

    useEffect(() => {
        localStorage.setItem('fortuna_privacy', JSON.stringify(isVisible));
    }, [isVisible]);

    const toggleVisibility = () => setIsVisible((prev: boolean) => !prev);
    return (
        <PrivacyContext.Provider value={{ isVisible, toggleVisibility }}>
            {children}
        </PrivacyContext.Provider>
    );
}

export const usePrivacy = () => useContext(PrivacyContext);