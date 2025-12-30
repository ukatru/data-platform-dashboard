import React from 'react';
import { useAuth } from '../contexts/AuthContext';

interface RoleGuardProps {
    children: React.ReactNode;
    requiredRole?: string;
    requiredPermission?: string;
    fallback?: React.ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ children, requiredRole, requiredPermission, fallback = null }) => {
    const { hasPermission } = useAuth();

    if (requiredPermission && !hasPermission(requiredPermission)) {
        return <>{fallback}</>;
    }

    if (requiredRole) {
        let perm = 'CAN_VIEW_LOGS';
        if (requiredRole === 'DPE_PLATFORM_ADMIN') perm = 'PLATFORM_ADMIN';
        if (requiredRole === 'DPE_DEVELOPER') perm = 'CAN_EDIT_PIPELINES';

        if (!hasPermission(perm)) {
            return <>{fallback}</>;
        }
    }

    return <>{children}</>;
};
