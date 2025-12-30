import React, { useState, useEffect } from 'react';
import { api, TableMetadata } from '../../services/api';
import { DynamicTable } from '../../components/DynamicTable';
import { Plus, Search, X } from 'lucide-react';
import { RoleGuard } from '../../components/RoleGuard';

export const PipelineList: React.FC = () => {
    const [metadata, setMetadata] = useState<TableMetadata | null>(null);
    const [pipelines, setPipelines] = useState<any[]>([]);
    const [connections, setConnections] = useState<any[]>([]);
    const [schedules, setSchedules] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingPipeline, setEditingPipeline] = useState<any>(null);
    const [formData, setFormData] = useState({
        job_nm: '',
        invok_id: '',
        source_conn_nm: '',
        target_conn_nm: '',
        schedule_id: undefined as number | undefined,
        cron_schedule: '',
        partition_start_dt: '',
        actv_ind: true,
    });
    const [useCustomCron, setUseCustomCron] = useState(false);
    const [isCreatingSchedule, setIsCreatingSchedule] = useState(false);
    const [newScheduleData, setNewScheduleData] = useState({
        slug: '',
        cron: '',
    });

    useEffect(() => {
        const fetchMetadata = async () => {
            try {
                const res = await api.metadata.pipelines();
                setMetadata(res.data);
            } catch (err) {
                console.error('Failed to fetch metadata', err);
            }
        };
        fetchMetadata();
    }, []);

    useEffect(() => {
        // Fetch connections and schedules for dropdowns
        const fetchReferenceData = async () => {
            try {
                const [connRes, schedRes] = await Promise.all([
                    api.connections.list(),
                    api.schedules.list()
                ]);
                setConnections(connRes.data);
                setSchedules(schedRes.data);
            } catch (err) {
                console.error('Failed to fetch reference data', err);
            }
        };
        fetchReferenceData();
    }, []);

    const fetchPipelines = async () => {
        try {
            const res = await api.pipelines.list();
            setPipelines(res.data);
        } catch (err) {
            console.error('Failed to fetch pipelines', err);
        }
    };

    useEffect(() => {
        fetchPipelines();
    }, []);

    const handleCreate = () => {
        setEditingPipeline(null);
        setFormData({
            job_nm: '',
            invok_id: '',
            source_conn_nm: '',
            target_conn_nm: '',
            schedule_id: undefined,
            cron_schedule: '',
            partition_start_dt: '',
            actv_ind: true
        });
        setUseCustomCron(false);
        setIsCreatingSchedule(false);
        setShowModal(true);
    };

    const handleEdit = (pipeline: any) => {
        setEditingPipeline(pipeline);
        setFormData({
            job_nm: pipeline.job_nm,
            invok_id: pipeline.invok_id,
            source_conn_nm: pipeline.source_conn_nm || '',
            target_conn_nm: pipeline.target_conn_nm || '',
            schedule_id: pipeline.schedule_id,
            cron_schedule: pipeline.cron_schedule || '',
            partition_start_dt: pipeline.partition_start_dt ? new Date(pipeline.partition_start_dt).toISOString().split('T')[0] : '',
            actv_ind: pipeline.actv_ind !== false,
        });
        setUseCustomCron(!!pipeline.cron_schedule);
        setIsCreatingSchedule(false);
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                ...formData,
                source_conn_nm: formData.source_conn_nm || null,
                target_conn_nm: formData.target_conn_nm || null,
                schedule_id: useCustomCron ? null : (formData.schedule_id || null),
                cron_schedule: useCustomCron ? formData.cron_schedule : null,
                partition_start_dt: formData.partition_start_dt ? formData.partition_start_dt : null,
                actv_ind: formData.actv_ind,
            };

            if (editingPipeline) {
                await api.pipelines.update(editingPipeline.id, payload);
            } else {
                await api.pipelines.create(payload);
            }
            setShowModal(false);
            fetchPipelines();
        } catch (err: any) {
            alert(`Failed to save pipeline: ${err.response?.data?.detail || err.message}`);
        }
    };

    const handleCreateSchedule = async () => {
        if (!newScheduleData.slug || !newScheduleData.cron) return;
        try {
            const res = await api.schedules.create({
                ...newScheduleData,
                timezone: 'UTC',
                actv_ind: true
            });
            // Refresh list and select the new one
            const schedRes = await api.schedules.list();
            setSchedules(schedRes.data);
            setFormData({ ...formData, schedule_id: res.data.id });
            setIsCreatingSchedule(false);
            setNewScheduleData({ slug: '', cron: '' });
        } catch (err: any) {
            alert(`Failed to create schedule: ${err.response?.data?.detail || err.message}`);
        }
    };

    const handleDelete = async (row: any) => {
        if (!confirm(`Delete pipeline "${row.job_nm}"? This will also delete associated parameters. This cannot be undone.`)) return;
        try {
            await api.pipelines.delete(row.id);
            fetchPipelines();
        } catch (err: any) {
            alert(`Failed to delete: ${err.response?.data?.detail || err.message}`);
        }
    };

    const filtered = pipelines.filter(p =>
        p.job_nm.toLowerCase().includes(search.toLowerCase())
    );

    if (!metadata) {
        return <div>Loading metadata...</div>;
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Pipelines</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Manage ETL pipeline configurations</p>
                </div>
                <RoleGuard requiredRole="DPE_DEVELOPER">
                    <button className="btn-primary" onClick={handleCreate} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Plus size={20} /> New Pipeline
                    </button>
                </RoleGuard>
            </div>

            <div className="glass" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <Search size={20} color="var(--text-secondary)" />
                <input
                    type="text"
                    placeholder="Search pipelines..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ background: 'transparent', border: 'none', outline: 'none', width: '100%' }}
                />
            </div>

            <DynamicTable
                metadata={metadata.columns}
                data={filtered}
                onEdit={handleEdit}
                onDelete={handleDelete}
                editRole="DPE_DEVELOPER"
                deleteRole="DPE_PLATFORM_ADMIN"
                linkColumn="job_nm"
                linkPath={(row) => `/pipelines/${row.id}`}
                primaryKey={metadata.primary_key}
            />

            {showModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="glass" style={{ width: '600px', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                            <h3>{editingPipeline ? 'Edit Pipeline' : 'New Pipeline'}</h3>
                            <button onClick={() => setShowModal(false)}><X /></button>
                        </div>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                    Pipeline Name *
                                </label>
                                <input
                                    required
                                    value={formData.job_nm}
                                    onChange={(e) => setFormData({ ...formData, job_nm: e.target.value })}
                                    placeholder="e.g. sales_daily_load"
                                />
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                    Unique identifier for this pipeline
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                    Invocation ID *
                                </label>
                                <input
                                    required
                                    value={formData.invok_id}
                                    onChange={(e) => setFormData({ ...formData, invok_id: e.target.value })}
                                    placeholder="e.g. PROD_001"
                                />
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                    Environment or instance identifier
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                    Source Connection
                                </label>
                                <select
                                    value={formData.source_conn_nm}
                                    onChange={(e) => setFormData({ ...formData, source_conn_nm: e.target.value })}
                                >
                                    <option value="">-- Select Source --</option>
                                    {connections.map(conn => (
                                        <option key={conn.id} value={conn.conn_nm}>
                                            {conn.conn_nm} ({conn.conn_type})
                                        </option>
                                    ))}
                                </select>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                    Where data is extracted from
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                    Target Connection
                                </label>
                                <select
                                    value={formData.target_conn_nm}
                                    onChange={(e) => setFormData({ ...formData, target_conn_nm: e.target.value })}
                                >
                                    <option value="">-- Select Target --</option>
                                    {connections.map(conn => (
                                        <option key={conn.id} value={conn.conn_nm}>
                                            {conn.conn_nm} ({conn.conn_type})
                                        </option>
                                    ))}
                                </select>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                    Where data is loaded to
                                </div>
                            </div>

                            <div className="form-group">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                        Scheduling Strategy
                                    </label>
                                    <button
                                        type="button"
                                        className="badge"
                                        onClick={() => setUseCustomCron(!useCustomCron)}
                                        style={{ cursor: 'pointer', border: 'none', background: 'var(--glass-bg)', fontSize: '0.7rem' }}
                                    >
                                        {useCustomCron ? 'Switch to Central Schedule' : 'Switch to Custom Cron'}
                                    </button>
                                </div>

                                {!useCustomCron ? (
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <select
                                            style={{ flex: 1 }}
                                            value={formData.schedule_id || ''}
                                            onChange={(e) => setFormData({ ...formData, schedule_id: e.target.value ? parseInt(e.target.value) : undefined })}
                                        >
                                            <option value="">-- Manual Execution --</option>
                                            {schedules.filter(s => s.actv_ind).map(sched => (
                                                <option key={sched.id} value={sched.id}>
                                                    {sched.slug} ({sched.cron})
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            className="btn-secondary"
                                            style={{ padding: '0 0.75rem' }}
                                            onClick={() => setIsCreatingSchedule(!isCreatingSchedule)}
                                            title="Register new schedule"
                                        >
                                            <Plus size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <input
                                        value={formData.cron_schedule}
                                        onChange={(e) => setFormData({ ...formData, cron_schedule: e.target.value })}
                                        placeholder="e.g. 0 0 * * *"
                                    />
                                )}
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                    {useCustomCron ? 'Provide a raw cron expression for this pipeline' : 'Select a reusable schedule or create a new one'}
                                </div>
                            </div>

                            {isCreatingSchedule && !useCustomCron && (
                                <div style={{
                                    background: 'rgba(255,255,255,0.03)',
                                    padding: '1.25rem',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--glass-border)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '1rem'
                                }}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-primary)' }}>New Reusable Schedule</div>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <input
                                            style={{ fontSize: '0.85rem', flex: 1 }}
                                            placeholder="Schedule Slug (e.g. daily_midnight)"
                                            value={newScheduleData.slug}
                                            onChange={(e) => setNewScheduleData({ ...newScheduleData, slug: e.target.value })}
                                        />
                                        <input
                                            style={{ fontSize: '0.85rem', flex: 1 }}
                                            placeholder="Cron (e.g. 0 0 * * *)"
                                            value={newScheduleData.cron}
                                            onChange={(e) => setNewScheduleData({ ...newScheduleData, cron: e.target.value })}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button
                                            type="button"
                                            className="btn-primary"
                                            style={{ fontSize: '0.8rem', padding: '0.4rem' }}
                                            onClick={handleCreateSchedule}
                                        >
                                            Register & Select
                                        </button>
                                        <button
                                            type="button"
                                            className="btn-secondary"
                                            style={{ fontSize: '0.8rem', padding: '0.4rem' }}
                                            onClick={() => setIsCreatingSchedule(false)}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                        Partition Start Date
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.partition_start_dt}
                                        onChange={(e) => setFormData({ ...formData, partition_start_dt: e.target.value })}
                                        style={{ width: '100%' }}
                                    />
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                        Optional: Start date for backfills
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1.75rem' }}>
                                    <input
                                        type="checkbox"
                                        id="actv_ind"
                                        checked={formData.actv_ind}
                                        onChange={(e) => setFormData({ ...formData, actv_ind: e.target.checked })}
                                        style={{ width: 'auto', margin: 0 }}
                                    />
                                    <label htmlFor="actv_ind" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                        Pipeline Active
                                    </label>
                                </div>
                            </div>

                            {!editingPipeline && (
                                <div style={{
                                    background: 'var(--glass-bg)',
                                    padding: '1rem',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--glass-border)'
                                }}>
                                    <div style={{ fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: 600 }}>
                                        What happens on creation:
                                    </div>
                                    <ul style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, paddingLeft: '1.5rem' }}>
                                        <li>Pipeline record created in <code>etl_job</code></li>
                                        <li>Empty parameter record initialized in <code>etl_job_parameter</code></li>
                                        <li>Configure parameters in the detail page after creation</li>
                                    </ul>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                                    {editingPipeline ? 'Update Pipeline' : 'Create Pipeline'}
                                </button>
                                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div >
            )}
        </div >
    );
};
