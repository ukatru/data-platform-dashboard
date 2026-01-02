import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../services/api';
import {
    LayoutDashboard,
    Workflow,
    Database,
    FileJson,
    Calendar,
    Activity,
    UserCircle,
    ShieldCheck,
    GitBranch,
    Puzzle,
    Settings
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { RoleGuard } from './RoleGuard';

export const Sidebar: React.FC = () => {
    const location = useLocation();
    const [isConnected, setIsConnected] = useState<boolean | null>(null);
    const [showConsole, setShowConsole] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(true);
    const consoleRef = useRef<HTMLDivElement>(null);
    const { user, currentOrg, logout, currentTeamId, setCurrentTeamId } = useAuth();

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

        // Click-away listener
        const handleClickOutside = (event: MouseEvent) => {
            if (consoleRef.current && !consoleRef.current.contains(event.target as Node)) {
                setShowConsole(false);
            }
        };

        if (showConsole) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            clearInterval(interval);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showConsole]);

    const isActive = (path: string) => location.pathname === path;

    const NavItem = ({ to, icon: Icon, label, requiredRole, requiredPermission }: any) => {
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

        if (requiredRole || requiredPermission) {
            return <RoleGuard requiredRole={requiredRole} requiredPermission={requiredPermission}>{content}</RoleGuard>;
        }

        return content;
    };

    return (
        <div className="sidebar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <Workflow size={32} color="var(--accent-primary)" />
                <div style={{ flex: 1 }}>
                    <h1 style={{ fontSize: '1.25rem', marginBottom: '0.125rem' }}>
                        {currentOrg?.org_code || 'Nexus'} Control
                    </h1>
                    {currentOrg && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {currentOrg.org_nm}
                        </div>
                    )}
                </div>
            </div>


            <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <NavItem to="/" icon={LayoutDashboard} label="Dashboard" />
                <NavItem to="/blueprints" icon={Puzzle} label="Blueprints" requiredPermission="CAN_VIEW_LOGS" />
                <NavItem to="/pipelines" icon={Workflow} label="Pipelines" requiredPermission="CAN_VIEW_LOGS" />
                <NavItem to="/connections" icon={Database} label="Connections" requiredPermission="CAN_MANAGE_CONNECTIONS" />
                <NavItem to="/schemas" icon={FileJson} label="Schemas" requiredPermission="CAN_VIEW_LOGS" />
                <NavItem to="/schedules" icon={Calendar} label="Schedules" requiredPermission="CAN_VIEW_LOGS" />
                <NavItem to="/variables" icon={Settings} label="Variables" requiredPermission="CAN_VIEW_LOGS" />
                <NavItem to="/status" icon={Activity} label="Status" requiredPermission="CAN_VIEW_LOGS" />
                <NavItem to="/code-locations" icon={GitBranch} label="Repositories" requiredPermission="CAN_EDIT_PIPELINES" />
                <div style={{ margin: '0.75rem 0', height: '1px', background: 'var(--glass-border)' }}></div>
                <NavItem to="/admin" icon={ShieldCheck} label="Access Management" requiredPermission="PLATFORM_ADMIN" />
            </nav>

            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div
                    ref={consoleRef}
                    style={{
                        padding: '1rem',
                        background: 'rgba(255, 255, 255, 0.05)',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        border: '1px solid transparent',
                        position: 'relative'
                    }}
                    onClick={() => setShowConsole(!showConsole)}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', minWidth: 0 }}>
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                            <UserCircle size={32} color={isActive('/profile') ? 'var(--accent-primary)' : 'var(--text-secondary)'} />
                            {currentTeamId && (
                                <div style={{ position: 'absolute', bottom: -2, right: -2, width: 12, height: 12, borderRadius: '50%', background: 'var(--accent-primary)', border: '2px solid #1a1a2e' }} />
                            )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                                color: 'white',
                                fontSize: '0.875rem',
                                fontWeight: 600,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                            }}>
                                {user?.full_nm || 'Loading...'}
                            </div>
                            <div style={{
                                color: 'var(--text-tertiary)',
                                fontSize: '0.75rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                            }}>
                                {currentTeamId ? (
                                    <>
                                        <span style={{ color: 'var(--accent-primary)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {user?.team_memberships?.find(m => m.team_id === currentTeamId)?.team.team_nm}
                                        </span>
                                        <span>•</span>
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {user?.team_memberships?.find(m => m.team_id === currentTeamId)?.role.role_nm.replace('DPE_', '').replace(/_/g, ' ')}
                                        </span>
                                    </>
                                ) : (
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {user?.role?.role_nm?.replace('DPE_', '') || 'Guest'}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {showConsole && (
                        <div
                            className="glass"
                            style={{
                                position: 'absolute',
                                bottom: 'calc(100% + 1rem)',
                                left: 0,
                                width: '280px',
                                padding: '1.25rem',
                                zIndex: 1000,
                                boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                                animation: 'slideUp 0.3s ease-out'
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em', display: 'block', marginBottom: '0.75rem' }}>
                                    Switch Role / Workspace
                                </label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <div
                                        onClick={() => { setCurrentTeamId(null); setShowConsole(false); }}
                                        style={{
                                            padding: '0.75rem',
                                            borderRadius: '8px',
                                            background: currentTeamId === null ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255,255,255,0.03)',
                                            border: '1px solid',
                                            borderColor: currentTeamId === null ? 'var(--accent-primary)' : 'transparent',
                                            cursor: 'pointer',
                                            fontSize: '0.85rem'
                                        }}
                                    >
                                        <div style={{ fontWeight: 600, color: currentTeamId === null ? 'white' : 'var(--text-secondary)' }}>All Teams</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Unified Organization View</div>
                                    </div>

                                    {user?.team_memberships?.map(m => (
                                        <div
                                            key={m.team_id}
                                            onClick={() => { setCurrentTeamId(m.team_id); setShowConsole(false); }}
                                            style={{
                                                padding: '0.75rem',
                                                borderRadius: '8px',
                                                background: currentTeamId === m.team_id ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255,255,255,0.03)',
                                                border: '1px solid',
                                                borderColor: currentTeamId === m.team_id ? 'var(--accent-primary)' : 'transparent',
                                                cursor: 'pointer',
                                                fontSize: '0.85rem',
                                                overflow: 'hidden'
                                            }}
                                        >
                                            <div style={{ fontWeight: 600, color: currentTeamId === m.team_id ? 'white' : 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {m.team.team_nm}
                                            </div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {m.role.role_nm.replace('DPE_', '').replace(/_/g, ' ')}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div style={{ height: '1px', background: 'var(--glass-border)', margin: '1rem 0' }}></div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>Appearance</span>
                                <div
                                    onClick={() => setIsDarkMode(!isDarkMode)}
                                    style={{
                                        width: '44px',
                                        height: '24px',
                                        borderRadius: '12px',
                                        background: isDarkMode ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)',
                                        position: 'relative',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s'
                                    }}
                                >
                                    <div style={{
                                        position: 'absolute',
                                        top: '2px',
                                        left: isDarkMode ? '22px' : '2px',
                                        width: '20px',
                                        height: '20px',
                                        borderRadius: '50%',
                                        background: 'white',
                                        transition: 'all 0.3s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '10px'
                                    }}>
                                        {isDarkMode ? '🌙' : '☀️'}
                                    </div>
                                </div>
                            </div>

                            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                                <Link to="/profile" style={{ flex: 1, textDecoration: 'none' }} onClick={() => setShowConsole(false)}>
                                    <button className="btn-secondary" style={{ width: '100%', fontSize: '0.75rem', padding: '0.5rem' }}>Profile</button>
                                </Link>
                                <button onClick={logout} className="btn-secondary" style={{ flex: 1, fontSize: '0.75rem', padding: '0.5rem', color: '#ef4444' }}>Sign Out</button>
                            </div>
                        </div>
                    )}
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
