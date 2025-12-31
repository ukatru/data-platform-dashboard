import React, { useState, useEffect } from 'react';
import { api, TableMetadata } from '../../services/api';
import { RoleGuard } from '../../components/RoleGuard';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Search, X } from 'lucide-react';
import { DynamicTable } from '../../components/DynamicTable';

export const PipelineList: React.FC = () => {
    const { currentTeamId } = useAuth();
    const [metadata, setMetadata] = useState<TableMetadata | null>(null);
    const [pipelines, setPipelines] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [showInstanceModal, setShowInstanceModal] = useState(false);
    const [editingPipeline, setEditingPipeline] = useState<any>(null);
    const [blueprints, setBlueprints] = useState<any[]>([]);
    const [schedules, setSchedules] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Form state for creating/editing a pipeline
    const [formData, setFormData] = useState<any>({
        job_nm: '',
        description: '',
        template_id: undefined,
        schedule_id: undefined,
        cron_schedule: '',
        partition_start_dt: '',
        params_json: {}
    });
    const [useCustomCron, setUseCustomCron] = useState(false);

    const fetchMetadata = async () => {
        try {
            const metaRes = await api.metadata.pipelines();
            setMetadata(metaRes.data);
        } catch (err: any) {
            console.error('Failed to fetch metadata', err);
            setError("Failed to load inventory metadata.");
        }
    };

    const fetchPipelines = async () => {
        try {
            const res = await api.pipelines.list();
            setPipelines(res.data);
        } catch (err) {
            console.error('Failed to fetch pipelines', err);
        }
    };

    const fetchReferenceData = async () => {
        try {
            const [schedRes, blueRes] = await Promise.all([
                api.schedules.list(),
                api.blueprints.list()
            ]);
            setSchedules(schedRes.data);
            setBlueprints(blueRes.data);
        } catch (err) {
            console.error('Failed to fetch reference data', err);
        }
    };

    useEffect(() => {
        fetchMetadata();
    }, []);

    useEffect(() => {
        fetchPipelines();
        fetchReferenceData();
    }, [currentTeamId]);

    const handleCreatePipeline = () => {
        setEditingPipeline(null);
        setFormData({
            template_id: undefined,
            job_nm: '',
            description: '',
            schedule_id: undefined,
            cron_schedule: '',
            partition_start_dt: '',
            actv_ind: true,
            params_json: {}
        });
        setUseCustomCron(false);
        setShowInstanceModal(true);
    };

    const handleEditPipeline = (pipeline: any) => {
        setEditingPipeline(pipeline);
        setFormData({
            template_id: pipeline.template_id,
            job_nm: pipeline.job_nm,
            description: pipeline.description || '',
            schedule_id: pipeline.schedule_id,
            cron_schedule: pipeline.cron_schedule || '',
            partition_start_dt: pipeline.partition_start_dt ? new Date(pipeline.partition_start_dt).toISOString().split('T')[0] : '',
            actv_ind: pipeline.actv_ind !== false,
            params_json: pipeline.params_json || {}
        });
        setUseCustomCron(!!pipeline.cron_schedule);
        setShowInstanceModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // Validate JSON before submission if it's a string
            let finalParams = formData.params_json;
            if (typeof finalParams === 'string') {
                try {
                    finalParams = JSON.parse(finalParams);
                } catch (err) {
                    alert("Invalid JSON in Parameters field");
                    return;
                }
            }

            // Validate YAML for singletons (Only if NO blueprint is selected)
            let finalYaml = formData.yaml_def;
            const isBlueprintInstance = !!formData.template_id;

            if (!isBlueprintInstance) {
                if (typeof finalYaml === 'string') {
                    try {
                        finalYaml = JSON.parse(finalYaml);
                    } catch (err) {
                        alert("Invalid JSON in YAML Definition field");
                        return;
                    }
                }
                if (!finalYaml || Object.keys(finalYaml).length === 0) {
                    alert("YAML Definition is required for singletons. If you want to use a Blueprint, please select one from the dropdown.");
                    return;
                }
            } else {
                // For instances, YAML comes from the template, so we ignore/clear it
                finalYaml = undefined;
            }

            const payload = {
                ...formData,
                params_json: finalParams,
                yaml_def: finalYaml,
                instance_id: formData.job_nm, // The name of the instance/singleton
                template_id: formData.template_id, // Ensure this is correctly named
                schedule_id: !useCustomCron && formData.schedule_id ? formData.schedule_id : undefined,
                cron_schedule: useCustomCron ? formData.cron_schedule : undefined,
                partition_start_dt: formData.partition_start_dt || undefined,
            };

            if (editingPipeline) {
                await api.pipelines.update(editingPipeline.id, payload);
            } else {
                await api.pipelines.create(payload);
            }
            setShowInstanceModal(false);
            fetchPipelines();
        } catch (err: any) {
            alert(`Failed to save pipeline: ${err.response?.data?.detail || err.message}`);
        }
    };

    const handleDelete = async (row: any) => {
        if (!confirm(`Delete pipeline "${row.job_nm}"? This cannot be undone.`)) return;
        try {
            await api.pipelines.delete(row.id);
            fetchPipelines();
        } catch (err: any) {
            alert(`Failed to delete: ${err.response?.data?.detail || err.message}`);
        }
    };

    if (error) {
        return <div className="glass" style={{ padding: '4rem', textAlign: 'center' }}>{error}</div>;
    }

    if (!metadata) {
        return <div style={{ padding: '4rem', textAlign: 'center', opacity: 0.5 }}>Initializing...</div>;
    }

    const filteredPipelines = pipelines.filter(p =>
        p.job_nm.toLowerCase().includes(search.toLowerCase()) ||
        (p.template_nm && p.template_nm.toLowerCase().includes(search.toLowerCase()))
    );

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Pipelines</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Inventory of all executable jobs (Singletons & Instances)</p>
                </div>
                <RoleGuard requiredRole="DPE_DEVELOPER">
                    <button className="btn-primary" onClick={handleCreatePipeline} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Plus size={20} /> Register Pipeline
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
                data={filteredPipelines}
                onLinkClick={(pipeline) => (window.location.href = `/pipelines/${pipeline.id}`)}
                onEdit={handleEditPipeline}
                onDelete={handleDelete}
                linkColumn="job_nm"
                primaryKey="id"
                emptyMessage="No pipelines found. Register a new one or instantiate a blueprint."
            />

            {showInstanceModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="glass" style={{ width: '600px', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                            <h3>{editingPipeline ? 'Edit Pipeline' : 'Register Pipeline'}</h3>
                            <button onClick={() => setShowInstanceModal(false)}><X /></button>
                        </div>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                    Blueprint (Optional for Singletons)
                                </label>
                                <select
                                    disabled={!!editingPipeline}
                                    value={formData.template_id || ''}
                                    onChange={(e) => {
                                        const selectedId = e.target.value ? parseInt(e.target.value) : undefined;
                                        const selectedBlueprint = blueprints.find(b => b.id === selectedId);

                                        // Generate template JSON from schema if available
                                        let initialParams: any = {};
                                        if (selectedBlueprint?.params_schema?.properties) {
                                            const props = selectedBlueprint.params_schema.properties as any;
                                            Object.keys(props).forEach(key => {
                                                initialParams[key] = props[key].default !== undefined ? props[key].default :
                                                    (props[key].type === 'string' ? '' :
                                                        (props[key].type === 'number' ? 0 :
                                                            (props[key].type === 'boolean' ? false : null)));
                                            });
                                        }

                                        setFormData({
                                            ...formData,
                                            template_id: selectedId,
                                            params_json: initialParams,
                                            // Clear YAML if blueprint is selected
                                            yaml_def: selectedId ? undefined : formData.yaml_def
                                        });
                                    }}
                                >
                                    <option value="">-- No Blueprint (Singleton) --</option>
                                    {blueprints.map(b => (
                                        <option key={b.id} value={b.id}>{b.template_nm}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                    Instance ID *
                                </label>
                                <input
                                    required
                                    value={formData.job_nm}
                                    onChange={(e) => setFormData({ ...formData, job_nm: e.target.value })}
                                    placeholder="e.g. prod_sftp_ingestion"
                                />
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                    The unique ID for this execution instance.
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                    Description
                                </label>
                                <input
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Brief summary of what this pipeline does"
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                    Parameters (JSON)
                                </label>
                                <textarea
                                    style={{
                                        width: '100%',
                                        height: '150px',
                                        fontFamily: 'monospace',
                                        fontSize: '0.85rem',
                                        background: 'var(--bg-primary)',
                                        color: '#818cf8',
                                        padding: '1rem',
                                        border: '1px solid var(--glass-border)',
                                        borderRadius: 'var(--radius-md)'
                                    }}
                                    value={typeof formData.params_json === 'string' ? formData.params_json : JSON.stringify(formData.params_json, null, 2)}
                                    onChange={(e) => {
                                        try {
                                            // Store as string while editing to allow incomplete JSON
                                            setFormData({ ...formData, params_json: e.target.value });
                                        } catch (err) { }
                                    }}
                                    onBlur={(e) => {
                                        try {
                                            // Try to parse on blur
                                            const parsed = JSON.parse(e.target.value);
                                            setFormData({ ...formData, params_json: parsed });
                                        } catch (err) {
                                            // Keep as string if invalid, handleSubmit will catch it
                                        }
                                    }}
                                    placeholder='{ "key": "value" }'
                                />
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                    Runtime parameters for the pipeline as a JSON object.
                                </div>
                            </div>

                            {!formData.template_id && (
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                        YAML Definition (Required for Singletons)
                                    </label>
                                    <textarea
                                        style={{
                                            width: '100%',
                                            height: '200px',
                                            fontFamily: 'monospace',
                                            fontSize: '0.85rem',
                                            background: 'var(--bg-primary)',
                                            color: '#fbbf24', // Different color for YAML
                                            padding: '1rem',
                                            border: '1px solid var(--glass-border)',
                                            borderRadius: 'var(--radius-md)'
                                        }}
                                        value={typeof formData.yaml_def === 'string' ? formData.yaml_def : JSON.stringify(formData.yaml_def, null, 2)}
                                        onChange={(e) => {
                                            setFormData({ ...formData, yaml_def: e.target.value });
                                        }}
                                        onBlur={(e) => {
                                            try {
                                                const parsed = JSON.parse(e.target.value);
                                                setFormData({ ...formData, yaml_def: parsed });
                                            } catch (err) { }
                                        }}
                                        placeholder='{ "jobs": [...] }'
                                    />
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                        The executable YAML definition for this singleton.
                                    </div>
                                </div>
                            )}

                            <div className="form-group">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                        Scheduling
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
                                    <select
                                        value={formData.schedule_id || ''}
                                        onChange={(e) => setFormData({ ...formData, schedule_id: e.target.value ? parseInt(e.target.value) : undefined })}
                                    >
                                        <option value="">-- Manual Execution --</option>
                                        {schedules.filter(s => s.actv_ind).map(sched => (
                                            <option key={sched.id} value={sched.id}>{sched.slug} ({sched.cron})</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        value={formData.cron_schedule}
                                        onChange={(e) => setFormData({ ...formData, cron_schedule: e.target.value })}
                                        placeholder="e.g. 0 0 * * *"
                                    />
                                )}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                        Partition Start
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.partition_start_dt}
                                        onChange={(e) => setFormData({ ...formData, partition_start_dt: e.target.value })}
                                    />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1.75rem' }}>
                                    <input type="checkbox" id="actv_ind" checked={formData.actv_ind} onChange={e => setFormData({ ...formData, actv_ind: e.target.checked })} />
                                    <label htmlFor="actv_ind">Active / Runnable</label>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                                <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                                    {editingPipeline ? 'Save Changes' : 'Register Pipeline'}
                                </button>
                                <button type="button" onClick={() => setShowInstanceModal(false)} className="btn-secondary">Cancel</button>
                            </div>
                        </form>
                    </div>
                </div >
            )}
        </div >
    );
};
