import React, { useState, useEffect } from 'react';
import { api, TableMetadata } from '../../services/api';
import { DynamicTable } from '../../components/DynamicTable';
import { X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export const StatusDashboard: React.FC = () => {
    const { currentTeamId } = useAuth();
    const [metadata, setMetadata] = useState<TableMetadata | null>(null);
    const [jobs, setJobs] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchMetadata = async () => {
            try {
                const res = await api.metadata.status();
                setMetadata(res.data);
            } catch (err: any) {
                console.error('Failed to fetch metadata', err);
                if (err.response?.status === 403) {
                    setError("You do not have permission to view status monitoring.");
                } else {
                    setError("Failed to load status metadata.");
                }
            }
        };
        fetchMetadata();
    }, []);

    useEffect(() => {
        const fetchJobs = async () => {
            try {
                const res = await api.status.jobs({
                    job_nm: search || undefined,
                    sts_cd: statusFilter || undefined,
                    team_id: currentTeamId
                });
                setJobs(res.data);
            } catch (err) {
                console.error('Failed to fetch job status', err);
            }
        };
        fetchJobs();
        const interval = setInterval(fetchJobs, 5000);
        return () => clearInterval(interval);
    }, [search, statusFilter, currentTeamId]);

    if (error) {
        return (
            <div className="glass" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                {error}
            </div>
        );
    }

    if (!metadata) {
        return (
            <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <div style={{ marginBottom: '1rem', opacity: 0.5 }}>Initializing...</div>
            </div>
        );
    }

    return (
        <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '0.5rem', background: 'linear-gradient(to bottom right, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Status Monitoring
                    </h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-secondary)' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 12px var(--success)', animation: 'pulse 2s infinite' }}></div>
                        <span style={{ fontSize: '0.9rem', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Live System Status</span>
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div className="premium-search-container" style={{ position: 'relative', width: '380px' }}>
                        <X
                            size={18}
                            style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', opacity: search ? 1 : 0, transition: 'opacity 0.2s', zIndex: 10 }}
                            onClick={() => setSearch('')}
                        />
                        <input
                            type="text"
                            placeholder="Filter by job name..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="premium-input"
                            style={{ padding: '0.6rem 2.5rem 0.6rem 1rem', width: '100%', fontSize: '0.9rem' }}
                        />
                    </div>

                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="dark-select"
                        style={{ width: '160px', padding: '0.6rem 1rem', fontSize: '0.85rem' }}
                    >
                        <option value="">All Statuses</option>
                        <option value="R">Running</option>
                        <option value="C">Success</option>
                        <option value="A">Failed</option>
                    </select>
                </div>
            </div>

            <div className="premium-glass" style={{ overflow: 'hidden', borderRadius: 'var(--radius-lg)' }}>
                <DynamicTable
                    metadata={metadata.columns}
                    data={jobs}
                    primaryKey={metadata.primary_key}
                    emptyMessage="No job runs found for this team."
                />
            </div>

            <style>{`
                @keyframes pulse {
                    0% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.4; transform: scale(0.8); }
                    100% { opacity: 1; transform: scale(1); }
                }
            `}</style>
        </div>
    );
};
