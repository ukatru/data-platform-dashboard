import React, { useState, useEffect } from 'react';
import { api, TableMetadata } from '../../services/api';
import { DynamicTable } from '../../components/DynamicTable';
import { Plus, X } from 'lucide-react';
import { RoleGuard } from '../../components/RoleGuard';
import { useAuth } from '../../contexts/AuthContext';

export const ScheduleList: React.FC = () => {
    const [metadata, setMetadata] = useState<TableMetadata | null>(null);
    const [schedules, setSchedules] = useState<any[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [editingSched, setEditingSched] = useState<any>(null);
    const { currentTeamId } = useAuth();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        slug: '',
        cron: '',
        timezone: 'UTC',
        actv_ind: true,
        team_id: '' as string | number
    });

    const [search, setSearch] = useState('');
    const [pageLimit, setPageLimit] = useState(25);
    const [pageOffset, setPageOffset] = useState(0);
    const [totalCount, setTotalCount] = useState(0);

    useEffect(() => {
        const fetchMetadata = async () => {
            try {
                const res = await api.metadata.schedules();
                setMetadata(res.data);
            } catch (err) {
                console.error('Failed to fetch metadata', err);
            }
        };
        fetchMetadata();
    }, []);

    const fetchSchedules = async () => {
        setLoading(true);
        try {
            const res = await api.schedules.list(pageLimit, pageOffset, search);
            setSchedules(res.data.items);
            setTotalCount(res.data.total_count);
        } catch (err) {
            console.error('Failed to fetch schedules', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSchedules();
    }, [currentTeamId, pageLimit, pageOffset, search]);

    const handleCreate = () => {
        setEditingSched(null);
        setFormData({
            slug: '',
            cron: '',
            timezone: 'UTC',
            actv_ind: true,
            team_id: currentTeamId || ''
        });
        setShowModal(true);
    };

    const handleEdit = (sched: any) => {
        setEditingSched(sched);
        setFormData({
            slug: sched.slug,
            cron: sched.cron,
            timezone: sched.timezone || 'UTC',
            actv_ind: sched.actv_ind,
            team_id: sched.team_id || ''
        });
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingSched) {
                await api.schedules.update(editingSched.id, formData);
            } else {
                await api.schedules.create(formData);
            }
            setShowModal(false);
            fetchSchedules();
        } catch (err: any) {
            alert(`Failed to save: ${err.response?.data?.detail || err.message}`);
        }
    };

    const handleDelete = async (row: any) => {
        if (!confirm(`Delete schedule "${row.slug}"?`)) return;
        try {
            await api.schedules.delete(row.id);
            fetchSchedules();
        } catch (err: any) {
            alert(`Failed to delete: ${err.response?.data?.detail || err.message}`);
        }
    };

    if (!metadata) return <div style={{ padding: '4rem', textAlign: 'center' }}>Initializing...</div>;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 800, background: 'linear-gradient(to right, #fff, rgba(255,255,255,0.5))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Schedules</h1>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: '1.1rem' }}>Orchestrate your pipelines with precision timing</p>
                </div>
                <RoleGuard requiredRole="DPE_DEVELOPER">
                    <button className="btn-primary" onClick={handleCreate} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                        <Plus size={18} /> New Schedule
                    </button>
                </RoleGuard>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '2.5rem' }}>
                <div className="premium-search-container" style={{ position: 'relative', width: '400px' }}>
                    <X
                        size={18}
                        style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', opacity: search ? 1 : 0, transition: 'opacity 0.2s', zIndex: 10 }}
                        onClick={() => setSearch('')}
                    />
                    <input
                        type="text"
                        placeholder="Search schedules..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPageOffset(0); }}
                        className="premium-input"
                        style={{ padding: '0.6rem 2.5rem 0.6rem 1rem', width: '100%', fontSize: '0.9rem' }}
                    />
                </div>
            </div>

            <DynamicTable
                metadata={metadata.columns}
                data={schedules}
                onEdit={handleEdit}
                onDelete={handleDelete}
                primaryKey={metadata.primary_key}
                editRole="DPE_DEVELOPER"
                deleteRole="DPE_DEVELOPER"
                totalCount={totalCount}
                limit={pageLimit}
                offset={pageOffset}
                onPageChange={setPageOffset}
                onLimitChange={(l) => { setPageLimit(l); setPageOffset(0); }}
                loading={loading}
            />

            {showModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="premium-glass" style={{ width: '500px', padding: '2.5rem', background: '#0f172a', borderRadius: 'var(--radius-xl)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{editingSched ? 'Edit Schedule' : 'New Schedule'}</h2>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}><X size={24} /></button>
                        </div>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Slug *</label>
                                <input
                                    required
                                    className="premium-input"
                                    value={formData.slug}
                                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                                    placeholder="e.g. daily_at_midnight"
                                    style={{ padding: '0.8rem 1rem', width: '100%' }}
                                />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Cron Expression *</label>
                                <input
                                    required
                                    className="premium-input"
                                    value={formData.cron}
                                    onChange={(e) => setFormData({ ...formData, cron: e.target.value })}
                                    placeholder="0 0 * * *"
                                    style={{ padding: '0.8rem 1rem', width: '100%', fontFamily: 'monospace' }}
                                />
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>minute hour day month weekday</span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Timezone</label>
                                <select
                                    className="premium-input"
                                    value={formData.timezone}
                                    onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                                    style={{ padding: '0.8rem 1rem', width: '100%', cursor: 'pointer' }}
                                >
                                    <option value="UTC">UTC</option>
                                    <option value="America/New_York">America/New_York</option>
                                    <option value="America/Chicago">America/Chicago</option>
                                    <option value="America/Los_Angeles">America/Los_Angeles</option>
                                    <option value="Europe/London">Europe/London</option>
                                </select>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <input
                                    type="checkbox"
                                    id="actv_ind"
                                    checked={formData.actv_ind}
                                    onChange={(e) => setFormData({ ...formData, actv_ind: e.target.checked })}
                                    style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
                                />
                                <label htmlFor="actv_ind" style={{ fontSize: '0.9rem', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 500 }}>Active</label>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                <button type="submit" className="btn-primary" style={{ flex: 1, height: '48px', fontWeight: 600 }}>{editingSched ? 'Update' : 'Create'}</button>
                                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary" style={{ flex: 1, height: '48px', fontWeight: 600 }}>Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
