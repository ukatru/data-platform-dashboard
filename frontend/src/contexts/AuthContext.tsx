import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type RoleName = 'DPE_PLATFORM_ADMIN' | 'DPE_DEVELOPER' | 'DPE_DATA_ANALYST';

export interface User {
    id: number;
    username: string;
    full_nm: string;
    email?: string;
    role_nm: RoleName;
    actv_ind: boolean;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isAdmin: boolean;
    isDeveloper: boolean;
    isAnalyst: boolean;
    login: (token: string, user: User) => void;
    logout: () => void;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const logout = useCallback(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
        window.location.href = '/login';
    }, []);

    const login = useCallback((newToken: string, newUser: User) => {
        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify(newUser));
        setToken(newToken);
        setUser(newUser);
    }, []);

    useEffect(() => {
        const savedToken = localStorage.getItem('token');
        const savedUser = localStorage.getItem('user');

        if (savedToken && savedUser) {
            try {
                setToken(savedToken);
                setUser(JSON.parse(savedUser));
            } catch (e) {
                console.error('Failed to parse saved user', e);
                logout();
            }
        }
        setLoading(false);
    }, [logout]);

    const isAuthenticated = !!token;
    const isAdmin = user?.role_nm === 'DPE_PLATFORM_ADMIN';
    const isDeveloper = isAdmin || user?.role_nm === 'DPE_DEVELOPER';
    const isAnalyst = isDeveloper || user?.role_nm === 'DPE_DATA_ANALYST';

    return (
        <AuthContext.Provider value={{
            user,
            token,
            isAuthenticated,
            isAdmin,
            isDeveloper,
            isAnalyst,
            login,
            logout,
            loading
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
