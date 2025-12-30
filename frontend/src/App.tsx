import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import {
    Dashboard,
    PipelineList,
    PipelineDetail,
    ConnectionList,
    ScheduleList,
    SchemaList,
    StatusDashboard,
    UserManagement,
    Login,
    Profile
} from './pages';
import { Sidebar } from './components/Sidebar';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import './index.css';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <div className="layout">
            <Sidebar />
            <main className="main-content">
                {children}
            </main>
        </div>
    );
};

function AppRoutes() {
    const { loading } = useAuth();

    if (loading) {
        return (
            <div style={{
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-primary)',
                color: 'var(--text-secondary)',
                gap: '1rem'
            }}>
                <div style={{
                    width: '40px',
                    height: '40px',
                    border: '3px solid rgba(99, 102, 241, 0.1)',
                    borderTopColor: 'var(--accent-primary)',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                }} />
                Initializing Platform...
                <style>{`
                    @keyframes spin { to { transform: rotate(360deg); } }
                `}</style>
            </div>
        );
    }

    return (
        <Routes>
            <Route path="/login" element={<Login />} />

            <Route path="/" element={
                <ProtectedRoute>
                    <Layout><Dashboard /></Layout>
                </ProtectedRoute>
            } />

            <Route path="/pipelines" element={
                <ProtectedRoute requiredRole="DPE_DATA_ANALYST">
                    <Layout><PipelineList /></Layout>
                </ProtectedRoute>
            } />

            <Route path="/pipelines/:id" element={
                <ProtectedRoute requiredRole="DPE_DATA_ANALYST">
                    <Layout><PipelineDetail /></Layout>
                </ProtectedRoute>
            } />

            <Route path="/connections" element={
                <ProtectedRoute requiredRole="DPE_DATA_ANALYST">
                    <Layout><ConnectionList /></Layout>
                </ProtectedRoute>
            } />

            <Route path="/schedules" element={
                <ProtectedRoute requiredRole="DPE_DATA_ANALYST">
                    <Layout><ScheduleList /></Layout>
                </ProtectedRoute>
            } />

            <Route path="/schemas" element={
                <ProtectedRoute requiredRole="DPE_DATA_ANALYST">
                    <Layout><SchemaList /></Layout>
                </ProtectedRoute>
            } />

            <Route path="/status" element={
                <ProtectedRoute requiredRole="DPE_DATA_ANALYST">
                    <Layout><StatusDashboard /></Layout>
                </ProtectedRoute>
            } />

            <Route path="/admin" element={
                <ProtectedRoute requiredRole="DPE_PLATFORM_ADMIN">
                    <Layout><UserManagement /></Layout>
                </ProtectedRoute>
            } />

            <Route path="/profile" element={
                <ProtectedRoute>
                    <Layout><Profile /></Layout>
                </ProtectedRoute>
            } />

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <AppRoutes />
            </BrowserRouter>
        </AuthProvider>
    );
}

export default App;
