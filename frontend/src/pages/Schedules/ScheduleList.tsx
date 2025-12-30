import React, { useState, useEffect } from 'react';
import { api, TableMetadata } from '../../services/api';
import { DynamicTable } from '../../components/DynamicTable';
import { Plus, X } from 'lucide-react';
import { RoleGuard } from '../../components/RoleGuard';

export const ScheduleList: React.FC = () => {
    const [metadata, setMetadata] = useState<TableMetadata | null>(null);
    const [schedules, setSchedules] = useState<any[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [editingSched, setEditingSched] = useState<any>(null);
    const [formData, setFormData] = useState({
        slug: '',
        cron: '',
        timezone: 'UTC',
        actv_ind: true,
    });

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
        try {
            const res = await api.schedules.list();
            setSchedules(res.data);
        } catch (err) {
            console.error('Failed to fetch schedules', err);
        }
    };

    useEffect(() => {
        fetchSchedules();
    }, []);

    const handleCreate = () => {
        setEditingSched(null);
        setFormData({ slug: '', cron: '', timezone: 'UTC', actv_ind: true });
        setShowModal(true);
    };

    const handleEdit = (sched: any) => {
        setEditingSched(sched);
        setFormData({
            slug: sched.slug,
            cron: sched.cron,
            timezone: sched.timezone || 'UTC',
            actv_ind: sched.actv_ind,
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
            alert(`Failed to save schedule: ${err.response?.data?.detail || err.message}`);
        }
    };

    const handleDelete = async (row: any) => {
        if (!confirm(`Delete schedule "${row.slug}"? This cannot be undone.`)) return;
        try {
            await api.schedules.delete(row.id);
            fetchSchedules();
        } catch (err: any) {
            alert(`Failed to delete: ${err.response?.data?.detail || err.message}`);
        }
    };

    if (!metadata) {
        return <div>Loading metadata...</div>;
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Schedules</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Manage cron-based execution schedules</p>
                </div>
                <RoleGuard requiredRole="DPE_DEVELOPER">
                    <button className="btn-primary" onClick={handleCreate} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Plus size={20} /> New Schedule
                    </button>
                </RoleGuard>
            </div>

            <DynamicTable
                metadata={metadata.columns}
                data={schedules}
                onEdit={handleEdit}
                onDelete={handleDelete}
                primaryKey={metadata.primary_key}
                editRole="DPE_DEVELOPER"
                deleteRole="DPE_DEVELOPER"
            />

            {showModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="glass" style={{ width: '500px', padding: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                            <h3>{editingSched ? 'Edit Schedule' : 'New Schedule'}</h3>
                            <button onClick={() => setShowModal(false)}><X /></button>
                        </div>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                    Slug *
                                </label>
                                <input
                                    required
                                    value={formData.slug}
                                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                                    placeholder="e.g. daily_at_midnight"
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                    Cron Expression *
                                </label>
                                <input
                                    required
                                    value={formData.cron}
                                    onChange={(e) => setFormData({ ...formData, cron: e.target.value })}
                                    placeholder="0 0 * * *"
                                    style={{ fontFamily: 'monospace' }}
                                />
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                    Format: minute hour day month weekday
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                    Timezone
                                </label>
                                <select
                                    value={formData.timezone}
                                    onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                                >
                                    <option value="UTC">UTC</option>
                                    <option value="America/New_York">America/New_York</option>
                                    <option value="America/Chicago">America/Chicago</option>
                                    <option value="America/Los_Angeles">America/Los_Angeles</option>
                                    <option value="Europe/London">Europe/London</option>
                                </select>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <input
                                    type="checkbox"
                                    id="actv_ind"
                                    checked={formData.actv_ind}
                                    onChange={(e) => setFormData({ ...formData, actv_ind: e.target.checked })}
                                    style={{ width: 'auto' }}
                                />
                                <label htmlFor="actv_ind" style={{ margin: 0, cursor: 'pointer' }}>
                                    Active
                                </label>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                                    {editingSched ? 'Update' : 'Create'}
                                </button>
                                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
