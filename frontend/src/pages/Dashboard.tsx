import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Activity, Database, Calendar, Workflow, AlertCircle } from 'lucide-react';

export const Dashboard: React.FC = () => {
    const [stats, setStats] = useState<any>(null);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await api.status.summary();
                setStats(res.data);
            } catch (err) {
                console.error('Failed to fetch stats', err);
            }
        };
        fetchStats();
        const interval = setInterval(fetchStats, 10000);
        return () => clearInterval(interval);
    }, []);

    const StatCard = ({ label, value, icon: Icon, color }: any) => (
        <div className="glass" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                        {label}
                    </div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 700, color: color || 'var(--text-primary)' }}>
                        {value ?? '—'}
                    </div>
                </div>
                <Icon size={32} color={color || 'var(--accent-primary)'} style={{ opacity: 0.6 }} />
            </div>
        </div>
    );

    return (
        <div>
            <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Platform Overview</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '3rem' }}>
                Real-time operational health and distribution
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
                <StatCard label="Active Runs" value={stats?.active_runs} icon={Activity} color="var(--accent-primary)" />
                <StatCard label="Failed Today" value={stats?.failed_today} icon={AlertCircle} color="var(--error)" />
                <StatCard label="Total Pipelines" value={stats?.jobs} icon={Workflow} />
                <StatCard label="Connections" value={stats?.connections} icon={Database} />
                <StatCard label="Schedules" value={stats?.schedules} icon={Calendar} />
            </div>

            <div className="glass" style={{ padding: '2rem' }}>
                <h3 style={{ marginBottom: '1.5rem' }}>Quick Actions</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <button className="btn-secondary" onClick={() => window.location.href = '/pipelines'}>
                        View Pipelines
                    </button>
                    <button className="btn-secondary" onClick={() => window.location.href = '/status'}>
                        Monitor Status
                    </button>
                    <button className="btn-secondary" onClick={() => window.location.href = '/connections'}>
                        Manage Connections
                    </button>
                </div>
            </div>
        </div>
    );
};
