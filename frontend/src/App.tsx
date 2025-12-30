import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { PipelineList } from './pages/Pipelines/PipelineList';
import { PipelineDetail } from './pages/Pipelines/PipelineDetail';
import { ConnectionList } from './pages/Connections/ConnectionList';
import { ScheduleList } from './pages/Schedules/ScheduleList';
import { SchemaList } from './pages/Schemas/SchemaList';
import { StatusDashboard } from './pages/Status/StatusDashboard';
import { UserManagement } from './pages/Users';
import { Login } from './pages/Login';
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
        return <div className="loading-container">Initializing...</div>;
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
