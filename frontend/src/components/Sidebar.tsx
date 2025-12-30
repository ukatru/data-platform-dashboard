import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../services/api';
import {
    LayoutDashboard,
    Workflow,
    Database,
    FileJson,
    Calendar,
    Activity,
    Settings,
    LogOut,
    UserCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { RoleGuard } from './RoleGuard';

export const Sidebar: React.FC = () => {
    const location = useLocation();
    const [isConnected, setIsConnected] = useState<boolean | null>(null);
    const { user, logout } = useAuth();

    useEffect(() => {
        const checkHealth = async () => {
            try {
                await api.healthCheck();
                setIsConnected(true);
            } catch (err) {
                setIsConnected(false);
            }
        };

        checkHealth();
        const interval = setInterval(checkHealth, 30000); // Check every 30s
        return () => clearInterval(interval);
    }, []);

    const isActive = (path: string) => location.pathname === path;

    const NavItem = ({ to, icon: Icon, label, requiredRole }: any) => {
        const content = (
            <Link
                to={to}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '0.875rem 1.25rem',
                    borderRadius: 'var(--radius-md)',
                    color: isActive(to) ? 'white' : 'var(--text-secondary)',
                    background: isActive(to) ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                    fontWeight: isActive(to) ? 600 : 400,
                    textDecoration: 'none',
                    transition: 'all 0.2s',
                }}
            >
                <Icon size={20} color={isActive(to) ? 'var(--accent-primary)' : 'inherit'} />
                {label}
            </Link>
        );

        if (requiredRole) {
            return <RoleGuard requiredRole={requiredRole}>{content}</RoleGuard>;
        }

        return content;
    };

    return (
        <div className="sidebar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '3rem' }}>
                <Workflow size={32} color="var(--accent-primary)" />
                <h1 style={{ fontSize: '1.25rem' }}>Nexus Control</h1>
            </div>

            <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <NavItem to="/" icon={LayoutDashboard} label="Dashboard" />
                <NavItem to="/pipelines" icon={Workflow} label="Pipelines" />
                <NavItem to="/connections" icon={Database} label="Connections" />
                <NavItem to="/schemas" icon={FileJson} label="Schemas" />
                <NavItem to="/schedules" icon={Calendar} label="Schedules" />
                <NavItem to="/status" icon={Activity} label="Status" />
                <NavItem to="/admin" icon={Settings} label="Admin" requiredRole="DPE_PLATFORM_ADMIN" />
            </nav>

            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{
                    padding: '1rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem'
                }}>
                    <Link to="/profile" title="Profile Settings" style={{ color: 'inherit', display: 'flex' }}>
                        <UserCircle size={32} color={isActive('/profile') ? 'var(--accent-primary)' : 'var(--text-secondary)'} />
                    </Link>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <Link to="/profile" style={{ textDecoration: 'none', color: 'inherit' }}>
                            <div style={{ color: 'white', fontSize: '0.875rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {user?.full_nm || 'Loading...'}
                            </div>
                        </Link>
                        <div style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
                            {(user?.role?.role_nm || user?.role_nm || 'Guest').replace('DPE_', '')}
                        </div>
                    </div>
                    <button
                        onClick={logout}
                        title="Sign Out"
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            padding: '0.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            transition: 'color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--error)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                    >
                        <LogOut size={18} />
                    </button>
                </div>

                <div className="glass" style={{ padding: '1rem', fontSize: '0.8rem' }}>
                    <div style={{ color: 'var(--text-secondary)' }}>Status</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                        <div style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: isConnected === null ? 'var(--text-secondary)' : (isConnected ? 'var(--success)' : 'var(--error)')
                        }}></div>
                        {isConnected === null ? 'Checking...' : (isConnected ? 'API Connected' : 'API Disconnected')}
                    </div>
                </div>
            </div>
        </div>
    );
};
