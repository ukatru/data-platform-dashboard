import React, { useState, useEffect } from 'react';
import { api, TableMetadata } from '../../services/api';
import { DynamicTable } from '../../components/DynamicTable';
import { Search, Filter } from 'lucide-react';

export const StatusDashboard: React.FC = () => {
    const [metadata, setMetadata] = useState<TableMetadata | null>(null);
    const [jobs, setJobs] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    useEffect(() => {
        const fetchMetadata = async () => {
            try {
                const res = await api.metadata.status();
                setMetadata(res.data);
            } catch (err) {
                console.error('Failed to fetch metadata', err);
            }
        };
        fetchMetadata();
    }, []);

    useEffect(() => {
        const fetchJobs = async () => {
            try {
                const res = await api.status.jobs({
                    job_nm: search || undefined,
                    sts_cd: statusFilter || undefined
                });
                setJobs(res.data);
            } catch (err) {
                console.error('Failed to fetch job status', err);
            }
        };
        fetchJobs();
        const interval = setInterval(fetchJobs, 5000);
        return () => clearInterval(interval);
    }, [search, statusFilter]);

    if (!metadata) {
        return <div>Loading metadata...</div>;
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
            />
        </div>
    );
};
