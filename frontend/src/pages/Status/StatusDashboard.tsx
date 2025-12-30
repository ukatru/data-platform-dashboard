import React, { useState, useEffect } from 'react';
import { api, TableMetadata } from '../../services/api';
import { DynamicTable } from '../../components/DynamicTable';
import { Search } from 'lucide-react';
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
        <div>
            <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Status Monitoring</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                Real-time job execution monitoring
            </p>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                <div className="glass" style={{ flex: 1, padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Search size={20} color="var(--text-secondary)" />
                    <input
                        type="text"
                        placeholder="Search by job name..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ background: 'transparent', border: 'none', outline: 'none', width: '100%' }}
                    />
                </div>

                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    style={{ width: '200px' }}
                >
                    <option value="">All Statuses</option>
                    <option value="R">Running</option>
                    <option value="C">Success</option>
                    <option value="A">Failed</option>
                </select>
            </div>

            <DynamicTable
                metadata={metadata.columns}
                data={jobs}
                primaryKey={metadata.primary_key}
                emptyMessage="No job runs found for this team."
            />
        </div>
    );
};
