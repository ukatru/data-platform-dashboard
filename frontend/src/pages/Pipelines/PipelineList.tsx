import React, { useState, useEffect } from 'react';
import { api, TableMetadata } from '../../services/api';
import { DynamicTable } from '../../components/DynamicTable';
import { Search, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { ResourceDeleteModal } from '../../components/ResourceDeleteModal';


export const PipelineList: React.FC = () => {
    const { currentTeamId } = useAuth();
    const [searchParams] = useSearchParams();
    const blueprintFilter = searchParams.get('blueprint');

    const [metadata, setMetadata] = useState<TableMetadata | null>(null);
    const [pipelines, setPipelines] = useState<any[]>([]);
    const [schedules, setSchedules] = useState<any[]>([]);
    const [search, setSearch] = useState(blueprintFilter || '');
    const [showModal, setShowModal] = useState(false);
    const [editingPipeline, setEditingPipeline] = useState<any>(null);
    const [formData, setFormData] = useState({
        job_nm: '',
        instance_id: '',
        schedule_id: undefined as number | undefined,
        cron_schedule: '',
        partition_start_dt: '',
        actv_ind: true,
    });
    const [loading, setLoading] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [pipelineToDelete, setPipelineToDelete] = useState<any>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [pageLimit, setPageLimit] = useState(25);
    const [pageOffset, setPageOffset] = useState(0);
    const [totalCount, setTotalCount] = useState(0);

    useEffect(() => {
        const fetchMetadata = async () => {
            try {
                const res = await api.metadata.pipelines();
                setMetadata(res.data);
            } catch (err: any) {
                console.error('Failed to fetch metadata', err);
                setError("Failed to load pipeline metadata.");
            }
        };
        fetchMetadata();
    }, []);

    useEffect(() => {
        const fetchReferenceData = async () => {
            try {
                const schedRes = await api.schedules.list();
                setSchedules(schedRes.data.items || []);
            } catch (err) {
                console.error('Failed to fetch reference data', err);
            }
        };
        fetchReferenceData();
    }, [currentTeamId]);

    const fetchPipelines = async () => {
        setLoading(true);
        try {
            const res = await api.pipelines.list(pageLimit, pageOffset, search);
            setPipelines(res.data.items);
            setTotalCount(res.data.total_count);
        } catch (err) {
            console.error('Failed to fetch pipelines', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPipelines();
    }, [currentTeamId, pageLimit, pageOffset, search]);

    const handleEdit = (pipeline: any) => {
        setEditingPipeline(pipeline);
        console.log('Editing Pipeline:', pipeline); // Debug log
        setFormData({
            job_nm: pipeline.job_nm,
            instance_id: pipeline.instance_id,
            schedule_id: pipeline.schedule_id || undefined,
            cron_schedule: pipeline.cron_schedule || '',
            partition_start_dt: pipeline.partition_start_dt ? new Date(pipeline.partition_start_dt).toISOString().split('T')[0] : '',
            actv_ind: pipeline.actv_ind !== false,
        });
        setShowModal(true);
    };

    const handleDelete = (pipeline: any) => {
        setPipelineToDelete(pipeline);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!pipelineToDelete) return;
        setDeleteLoading(true);
        try {
            await api.pipelines.delete(pipelineToDelete.id);
            setIsDeleteModalOpen(false);
            setPipelineToDelete(null);
            fetchPipelines();
        } catch (err: any) {
            alert(`Failed to delete: ${err.response?.data?.detail || err.message}`);
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingPipeline) {
                await api.pipelines.update(editingPipeline.id, formData);
            } else {
                await api.pipelines.create(formData);
            }
            setShowModal(false);
            fetchPipelines();
        } catch (err: any) {
            alert(`Failed to save: ${err.response?.data?.detail || err.message}`);
        }
    };

    if (error) {
        return <div style={{ padding: '4rem', textAlign: 'center' }}>{error}</div>;
    }

    if (!metadata) {
        return <div style={{ padding: '4rem', textAlign: 'center' }}>Initializing...</div>;
    }

    const filtered = pipelines;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.02em', background: 'linear-gradient(to right, #fff, rgba(255,255,255,0.5))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Pipelines</h1>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: '1.1rem' }}>Manage and monitor existing ETL executions</p>
                </div>
            </div>

            <div className="command-bar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                    <Search size={18} color="var(--accent-primary)" />
                    <input
                        type="text"
                        placeholder="Search pipelines..."
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPageOffset(0);
                        }}
                        className="premium-input"
                        style={{ background: 'transparent', border: 'none', outline: 'none', width: '100%', boxShadow: 'none', fontSize: '0.9rem' }}
                    />
                </div>
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
                emptyMessage="No pipelines found for this team."
                totalCount={totalCount}
                limit={pageLimit}
                offset={pageOffset}
                onPageChange={setPageOffset}
                onLimitChange={(l) => { setPageLimit(l); setPageOffset(0); }}
                loading={loading}
            />

            {showModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.3s ease-out' }}>
                    <div className="premium-glass" style={{ width: '600px', padding: '2.5rem', borderRadius: 'var(--radius-xl)', border: '1px solid rgba(255,255,255,0.1)', background: '#0f172a', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{editingPipeline ? 'Edit Pipeline' : 'New Pipeline'}</h2>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}><X size={24} /></button>
                        </div>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pipeline Name *</label>
                                <input
                                    required
                                    className="premium-input"
                                    value={formData.job_nm}
                                    onChange={(e) => setFormData({ ...formData, job_nm: e.target.value })}
                                    placeholder="e.g. sales_daily_load"
                                    style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '8px' }}
                                />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Instance ID *</label>
                                <input
                                    required
                                    className="premium-input"
                                    value={formData.instance_id}
                                    onChange={(e) => setFormData({ ...formData, instance_id: e.target.value })}
                                    placeholder="e.g. PROD_001"
                                    style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '8px' }}
                                />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Scheduling Strategy</label>
                                <select
                                    className="premium-input"
                                    value={formData.schedule_id || ''}
                                    onChange={(e) => {
                                        const newSchedId = e.target.value ? parseInt(e.target.value) : undefined;
                                        setFormData({
                                            ...formData,
                                            schedule_id: newSchedId,
                                            // Clear custom cron if a named schedule is selected
                                            cron_schedule: newSchedId ? '' : formData.cron_schedule
                                        });
                                    }}
                                    style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '8px' }}
                                >
                                    <option value="">-- Manual Execution --</option>
                                    {schedules.filter(s => s.actv_ind).map(sched => (
                                        <option key={sched.id} value={sched.id}>{sched.slug} ({sched.cron})</option>
                                    ))}
                                </select>
                            </div>

                            {(!formData.schedule_id) && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Custom Cron Override (Optional)</label>
                                    <input
                                        className="premium-input"
                                        value={formData.cron_schedule}
                                        onChange={(e) => setFormData({ ...formData, cron_schedule: e.target.value })}
                                        placeholder="* * * * * (e.g., 0 0 * * *)"
                                        style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '8px', border: formData.cron_schedule ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.1)' }}
                                    />
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Leave empty for strict manual execution, or provide a cron string for custom timing.</p>
                                </div>
                            )}

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <input
                                    type="checkbox"
                                    id="actv_ind"
                                    checked={formData.actv_ind}
                                    onChange={(e) => setFormData({ ...formData, actv_ind: e.target.checked })}
                                    style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
                                />
                                <label htmlFor="actv_ind" style={{ fontSize: '0.9rem', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 500 }}>Pipeline Active</label>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                                <button type="submit" className="btn-primary" style={{ flex: 1, padding: '0.8rem', fontSize: '1rem', fontWeight: 600 }}>{editingPipeline ? 'Update Pipeline' : 'Create Pipeline'}</button>
                                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary" style={{ flex: 1, padding: '0.8rem', fontSize: '1rem', fontWeight: 600 }}>Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ResourceDeleteModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={confirmDelete}
                resourceName={pipelineToDelete?.job_nm || ''}
                resourceType="pipeline"
                description={`This will permanently delete the pipeline "${pipelineToDelete?.job_nm}". This action cannot be undone.`}
                loading={deleteLoading}
            />
        </div>
    );
};
