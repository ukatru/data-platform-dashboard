import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, RoleName } from '../contexts/AuthContext';

interface ProtectedRouteProps {
    children: React.ReactNode;
    requiredRole?: RoleName;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
    const { isAuthenticated, user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return <div className="loading-container">Loading session...</div>;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (requiredRole) {
        const roleHierarchy: Record<RoleName, number> = {
            'DPE_DATA_ANALYST': 1,
            'DPE_DEVELOPER': 2,
            'DPE_PLATFORM_ADMIN': 3
        };

        const userRole = user?.role?.role_nm || user?.role_nm;
        const userLevel = (userRole && roleHierarchy[userRole as RoleName]) || 0;
        const requiredLevel = roleHierarchy[requiredRole];

        if (userLevel < requiredLevel) {
            return <Navigate to="/" replace />;
        }
    }

    return <>{children}</>;
};
