import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
    children: React.ReactNode;
    requiredRole?: string;
    requiredPermission?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole, requiredPermission }) => {
    const { isAuthenticated, hasPermission, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return <div className="loading-container">Loading session...</div>;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // New Permission Check
    if (requiredPermission && !hasPermission(requiredPermission)) {
        return <Navigate to="/" replace />;
    }

    // Legacy Role Check (mapped to permissions)
    if (requiredRole) {
        let perm = 'CAN_VIEW_LOGS'; // Default for ANALYST
        if (requiredRole === 'DPE_PLATFORM_ADMIN') perm = 'PLATFORM_ADMIN';
        if (requiredRole === 'DPE_DEVELOPER') perm = 'CAN_EDIT_PIPELINES';

        if (!hasPermission(perm)) {
            return <Navigate to="/" replace />;
        }
    }

    return <>{children}</>;
};
