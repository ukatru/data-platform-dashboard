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

    const userRole = user?.role?.role_nm || user?.role_nm; // Support both flat and nested for migration
    const userLevel = (userRole && roleHierarchy[userRole as RoleName]) || 0;
    const requiredLevel = roleHierarchy[requiredRole];

    if (userLevel < requiredLevel) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
};
