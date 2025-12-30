import React from 'react';
import { useAuth, RoleName } from '../contexts/AuthContext';

interface RoleGuardProps {
    children: React.ReactNode;
    requiredRole: RoleName;
    fallback?: React.ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ children, requiredRole, fallback = null }) => {
    const { user } = useAuth();

    const roleHierarchy: Record<RoleName, number> = {
        'DPE_DATA_ANALYST': 1,
        'DPE_DEVELOPER': 2,
        'DPE_PLATFORM_ADMIN': 3
    };

    const userLevel = user ? roleHierarchy[user.role_nm] : 0;
    const requiredLevel = roleHierarchy[requiredRole];

    if (userLevel < requiredLevel) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
};
