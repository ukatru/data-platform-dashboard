import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

export type RoleName = 'DPE_PLATFORM_ADMIN' | 'DPE_DEVELOPER' | 'DPE_DATA_ANALYST';

export interface User {
    id: number;
    username: string;
    full_nm: string;
    email?: string;
    role?: {
        id: number;
        role_nm: string;
    };
    role_nm?: string;
    org_id?: number | null;
    org?: {
        id: number;
        org_nm: string;
        org_code: string;
    } | null;
    actv_ind: boolean;
    permissions: string[];
    team_memberships: Array<{
        team_id: number;
        team: {
            id: number;
            team_nm: string;
        };
        role: {
            role_nm: string;
        };
    }>;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    currentOrg: User['org'] | null;
    currentTeamId: number | null;
    hasPermission: (permission: string) => boolean;
    setCurrentTeamId: (teamId: number | null) => void;
    login: (token: string, user: User) => void;
    logout: () => void;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [currentTeamId, setCurrentTeamIdState] = useState<number | null>(() => {
        const saved = localStorage.getItem('currentTeamId');
        return saved ? parseInt(saved) : null;
    });
    const [loading, setLoading] = useState(true);

    const logout = useCallback(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('currentTeamId');
        setToken(null);
        setUser(null);
        setCurrentTeamIdState(null);
        window.location.href = '/login';
    }, []);

    const login = useCallback((newToken: string, newUser: User) => {
        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify(newUser));
        setToken(newToken);
        setUser(newUser);
    }, []);

    const setCurrentTeamId = (teamId: number | null) => {
        if (teamId === null) {
            localStorage.removeItem('currentTeamId');
        } else {
            localStorage.setItem('currentTeamId', teamId.toString());
        }
        setCurrentTeamIdState(teamId);
    };

    useEffect(() => {
        const initSession = async () => {
            const savedToken = localStorage.getItem('token');
            const savedUser = localStorage.getItem('user');

            if (savedToken && savedUser) {
                try {
                    const parsedUser = JSON.parse(savedUser);
                    setToken(savedToken);
                    setUser(parsedUser);

                    // Refresh session to get latest permissions/teams
                    try {
                        const res = await api.auth.me();
                        const freshUser = res.data;
                        setUser(freshUser);
                        localStorage.setItem('user', JSON.stringify(freshUser));
                    } catch (refreshErr: any) {
                        console.error('Session refresh failed', refreshErr);
                        if (refreshErr.response?.status === 401) {
                            logout();
                        }
                    }
                } catch (e) {
                    console.error('Failed to parse saved user', e);
                    logout();
                }
            }
            setLoading(false);
        };

        initSession();
    }, [logout]);

    const isAuthenticated = !!token;

    const hasPermission = (permission: string): boolean => {
        if (!user || !user.permissions) return false;
        return user.permissions.includes(permission) || user.permissions.includes('PLATFORM_ADMIN');
    };

    return (
        <AuthContext.Provider value={{
            user,
            token,
            isAuthenticated,
            currentOrg: user?.org || null,
            currentTeamId,
            hasPermission,
            setCurrentTeamId,
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
