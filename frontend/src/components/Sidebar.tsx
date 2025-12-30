import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Workflow,
    Database,
    FileJson,
    Calendar,
    Activity,
    Settings
} from 'lucide-react';

export const Sidebar: React.FC = () => {
    const location = useLocation();

    const isActive = (path: string) => location.pathname === path;

    const NavItem = ({ to, icon: Icon, label }: any) => (
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
                <NavItem to="/admin" icon={Settings} label="Admin" />
            </nav>

            <div style={{ marginTop: 'auto', paddingTop: '2rem' }}>
                <div className="glass" style={{ padding: '1rem', fontSize: '0.8rem' }}>
                    <div style={{ color: 'var(--text-secondary)' }}>Status</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }}></div>
                        API Connected
                    </div>
                </div>
            </div>
        </div>
    );
};
