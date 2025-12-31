import React, { useState, useEffect } from 'react';
import { api, TableMetadata } from '../../services/api';
import { RoleGuard } from '../../components/RoleGuard';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Search, X, ChevronRight, ChevronDown, FileCode, Play } from 'lucide-react';
import { JobDefinitionModal } from './JobDefinitionModal';

export const PipelineList: React.FC = () => {
    const { currentTeamId } = useAuth();
    const [metadata, setMetadata] = useState<TableMetadata | null>(null);
    const [definitions, setDefinitions] = useState<any[]>([]);
    const [instances, setInstances] = useState<any[]>([]);
    const [schedules, setSchedules] = useState<any[]>([]);
    const [expandedJobs, setExpandedJobs] = useState<Set<number>>(new Set());
    const [search, setSearch] = useState('');
    const [showInstanceModal, setShowInstanceModal] = useState(false);
    const [viewingDefinition, setViewingDefinition] = useState<any | null>(null);
    const [editingInstance, setEditingInstance] = useState<any>(null);

    // Form state for creating/editing an instance
    const [formData, setFormData] = useState({
        job_definition_id: 0,
        instance_id: '',
        description: '',
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

    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchMetadata = async () => {
            try {
                const [instMeta] = await Promise.all([
                    api.metadata.pipelines(),
                    api.metadata.jobs()
                ]);
                setMetadata(instMeta.data);
            } catch (err: any) {
                console.error('Failed to fetch metadata', err);
                setError("Failed to load pipeline metadata.");
            }
        };
        fetchMetadata();
    }, []);

    useEffect(() => {
        // Fetch schedules for dropdowns
        const fetchReferenceData = async () => {
            try {
                const schedRes = await api.schedules.list();
                setSchedules(schedRes.data);
            } catch (err) {
                console.error('Failed to fetch reference data', err);
            }
        };
        fetchReferenceData();
    }, [currentTeamId]);

    const fetchData = async () => {
        try {
            const [defRes, instRes] = await Promise.all([
                api.jobs.list(),
                api.pipelines.list()
            ]);
            setDefinitions(defRes.data);
            setInstances(instRes.data);

            // Auto-expand jobs with instances
            const withInstances = new Set<number>(instRes.data.map((i: any) => i.job_definition_id as number));
            setExpandedJobs(withInstances);
        } catch (err) {
            console.error('Failed to fetch data', err);
        }
    };

    useEffect(() => {
        fetchData();
    }, [currentTeamId]);

    const handleCreateInstance = (defId?: number) => {
        setEditingInstance(null);
        setFormData({
            job_definition_id: defId || (definitions[0]?.id || 0),
            instance_id: '',
            description: '',
            schedule_id: undefined,
            cron_schedule: '',
            partition_start_dt: '',
            actv_ind: true
        });
        setUseCustomCron(false);
        setIsCreatingSchedule(false);
        setShowInstanceModal(true);
    };

    const handleEditInstance = (instance: any) => {
        setEditingInstance(instance);
        setFormData({
            job_definition_id: instance.job_definition_id,
            instance_id: instance.instance_id,
            description: instance.description || '',
            schedule_id: instance.schedule_id,
            cron_schedule: instance.cron_schedule || '',
            partition_start_dt: instance.partition_start_dt ? new Date(instance.partition_start_dt).toISOString().split('T')[0] : '',
            actv_ind: instance.actv_ind !== false,
        });
        setUseCustomCron(!!instance.cron_schedule);
        setIsCreatingSchedule(false);
        setShowInstanceModal(true);
    };

    const handleSubmitInstance = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                ...formData,
                schedule_id: useCustomCron ? null : (formData.schedule_id || null),
                cron_schedule: useCustomCron ? formData.cron_schedule : null,
                partition_start_dt: formData.partition_start_dt ? formData.partition_start_dt : null,
            };

            if (editingInstance) {
                await api.pipelines.update(editingInstance.id, payload);
            } else {
                await api.pipelines.create(payload);
            }
            setShowInstanceModal(false);
            fetchData();
        } catch (err: any) {
            alert(`Failed to save instance: ${err.response?.data?.detail || err.message}`);
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

    const handleDeleteInstance = async (row: any) => {
        if (!confirm(`Delete instance "${row.instance_id}"? This cannot be undone.`)) return;
        try {
            await api.pipelines.delete(row.id);
            fetchData();
        } catch (err: any) {
            alert(`Failed to delete: ${err.response?.data?.detail || err.message}`);
        }
    };

    const toggleJobExpansion = (jobId: number) => {
        const next = new Set(expandedJobs);
        if (next.has(jobId)) next.delete(jobId);
        else next.add(jobId);
        setExpandedJobs(next);
    };

    const filteredDefinitions = definitions.filter(d =>
        d.job_nm.toLowerCase().includes(search.toLowerCase())
    );

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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Pipelines</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Discoverable jobs (YAML Source) and configured instances</p>
                </div>
                <RoleGuard requiredRole="DPE_DEVELOPER">
                    <button className="btn-primary" onClick={() => handleCreateInstance()} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Plus size={20} /> Register Instance
                    </button>
                </RoleGuard>
            </div>

            <div className="glass" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <Search size={20} color="var(--text-secondary)" />
                <input
                    type="text"
                    placeholder="Search by Job name..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ background: 'transparent', border: 'none', outline: 'none', width: '100%' }}
                />
            </div>

            {/* Hierarchical Table */}
            <div className="glass" style={{ overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--glass-border)' }}>
                            <th style={{ width: '40px' }}></th>
                            <th style={{ textAlign: 'left', padding: '1rem' }}>Job Source / Instance</th>
                            <th style={{ textAlign: 'left', padding: '1rem' }}>Team</th>
                            <th style={{ textAlign: 'left', padding: '1rem' }}>Schedule</th>
                            <th style={{ textAlign: 'left', padding: '1rem' }}>Status</th>
                            <th style={{ textAlign: 'left', padding: '1rem' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredDefinitions.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-tertiary)' }}>
                                    No jobs found for this team. Check your metadata.yaml sync.
                                </td>
                            </tr>
                        ) : filteredDefinitions.map(job => {
                            const jobInstances = instances.filter(i => i.job_definition_id === job.id);
                            const isExpanded = expandedJobs.has(job.id);

                            return (
                                <React.Fragment key={job.id}>
                                    {/* Parent Row: Job Definition */}
                                    <tr style={{
                                        borderBottom: isExpanded ? 'none' : '1px solid var(--glass-border)',
                                        background: 'rgba(255,255,255,0.01)',
                                        transition: 'background 0.2s'
                                    }}>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                                            {jobInstances.length > 0 && (
                                                <button onClick={() => toggleJobExpansion(job.id)} style={{ color: 'var(--text-secondary)' }}>
                                                    {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                                </button>
                                            )}
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <div style={{ color: 'var(--accent-primary)' }}><FileCode size={18} /></div>
                                                <div>
                                                    <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{job.job_nm}</div>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: '0.2rem' }}>{job.description || 'No description provided'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ fontSize: '0.85rem' }}>
                                                <span style={{ fontWeight: 600 }}>{job.team_nm}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                                {job.asset_selection?.slice(0, 2).map((a: string) => (
                                                    <span key={a} className="badge" style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', opacity: 0.7 }}>{a}</span>
                                                ))}
                                                {job.asset_selection?.length > 2 && <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>+{job.asset_selection.length - 2} more</span>}
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <span className="status-badge" style={{ opacity: 0.6 }}>DEFINITION</span>
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button className="btn-secondary" style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }} onClick={() => setViewingDefinition(job)}>
                                                    View YAML
                                                </button>
                                                <RoleGuard requiredRole="DPE_DEVELOPER">
                                                    <button className="btn-primary" style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }} onClick={() => handleCreateInstance(job.id)}>
                                                        Add Instance
                                                    </button>
                                                </RoleGuard>
                                            </div>
                                        </td>
                                    </tr>

                                    {/* Sub-Rows: Job Instances */}
                                    {isExpanded && jobInstances.map(inst => (
                                        <tr key={inst.id} style={{
                                            background: 'rgba(255,255,255,0.03)',
                                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                                            fontSize: '0.9rem'
                                        }}>
                                            <td></td>
                                            <td style={{ padding: '0.75rem 1rem 0.75rem 3rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-secondary)' }}></div>
                                                    <a href={`/pipelines/${inst.id}`} style={{ fontWeight: 600, color: 'var(--accent-secondary)', textDecoration: 'none' }}>
                                                        {inst.instance_id}
                                                    </a>
                                                </div>
                                            </td>
                                            <td style={{ padding: '0.75rem 1rem', color: 'var(--text-tertiary)' }}>
                                                —
                                            </td>
                                            <td style={{ padding: '0.75rem 1rem' }}>
                                                <code style={{ fontSize: '0.8rem', background: 'var(--glass-bg)', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>
                                                    {inst.schedule_display}
                                                </code>
                                            </td>
                                            <td style={{ padding: '0.75rem 1rem' }}>
                                                <span className={inst.actv_ind ? 'status-success' : 'status-error'} style={{ fontSize: '0.75rem' }}>
                                                    {inst.actv_ind ? 'Active' : 'Paused'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '0.75rem 1rem' }}>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <RoleGuard requiredRole="DPE_DEVELOPER">
                                                        <button onClick={() => handleEditInstance(inst)} style={{ color: 'var(--accent-primary)', opacity: 0.8 }} title="Edit Instance">
                                                            <Play size={14} style={{ transform: 'rotate(90deg)' }} />
                                                        </button>
                                                    </RoleGuard>
                                                    <RoleGuard requiredRole="DPE_PLATFORM_ADMIN">
                                                        <button onClick={() => handleDeleteInstance(inst)} style={{ color: 'var(--error)', opacity: 0.6 }} title="Delete Instance">
                                                            <X size={14} />
                                                        </button>
                                                    </RoleGuard>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Modals */}
            {viewingDefinition && (
                <JobDefinitionModal
                    definition={viewingDefinition}
                    onClose={() => setViewingDefinition(null)}
                />
            )}

            {showInstanceModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="glass" style={{ width: '600px', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                            <h3>{editingInstance ? 'Edit Instance' : 'New Job Instance'}</h3>
                            <button onClick={() => setShowInstanceModal(false)}><X /></button>
                        </div>

                        <form onSubmit={handleSubmitInstance} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                    Parent Job Definition *
                                </label>
                                <select
                                    disabled={!!editingInstance}
                                    required
                                    value={formData.job_definition_id}
                                    onChange={(e) => setFormData({ ...formData, job_definition_id: parseInt(e.target.value) })}
                                >
                                    <option value={0} disabled>-- Select a Job --</option>
                                    {definitions.map(d => (
                                        <option key={d.id} value={d.id}>{d.job_nm} ({d.team_nm})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                    Instance ID *
                                </label>
                                <input
                                    required
                                    value={formData.instance_id}
                                    onChange={(e) => setFormData({ ...formData, instance_id: e.target.value })}
                                    placeholder="e.g. PROD_DAILY_01"
                                />
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                    Environment or deployment specific identifier
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                    Description (Optional)
                                </label>
                                <input
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="e.g. Daily production load for North America"
                                />
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
                            </div>

                            {isCreatingSchedule && !useCustomCron && (
                                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px' }}>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <input placeholder="Slug" value={newScheduleData.slug} onChange={e => setNewScheduleData({ ...newScheduleData, slug: e.target.value })} />
                                        <input placeholder="Cron" value={newScheduleData.cron} onChange={e => setNewScheduleData({ ...newScheduleData, cron: e.target.value })} />
                                    </div>
                                    <button type="button" onClick={handleCreateSchedule} className="btn-primary" style={{ marginTop: '0.5rem', width: '100%', fontSize: '0.8rem' }}>Create Schedule</button>
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
                                    />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1.75rem' }}>
                                    <input type="checkbox" id="actv_ind" checked={formData.actv_ind} onChange={e => setFormData({ ...formData, actv_ind: e.target.checked })} />
                                    <label htmlFor="actv_ind">Active</label>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                                <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                                    {editingInstance ? 'Update Instance' : 'Create Instance'}
                                </button>
                                <button type="button" onClick={() => setShowInstanceModal(false)} className="btn-secondary">Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
