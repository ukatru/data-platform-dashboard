import React, { useState, useEffect } from 'react';
import { api, TableMetadata } from '../../services/api';
import { DynamicTable } from '../../components/DynamicTable';
import { X, Clock, HelpCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { ResourceDeleteModal } from '../../components/ResourceDeleteModal';
import { motion } from 'framer-motion';


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

    // Rich Scheduling State
    const [scheduleType, setScheduleType] = useState<'manual' | 'daily' | 'weekly' | 'monthly'>('manual');
    const [scheduleTime, setScheduleTime] = useState('02:00');
    const [scheduleDay, setScheduleDay] = useState('1');
    const [monthlyMode, setMonthlyMode] = useState<'date' | 'day'>('date');
    const [monthlyOrdinal, setMonthlyOrdinal] = useState('1');
    const [isLastDayOfMonth, setIsLastDayOfMonth] = useState(false);

    const getCronString = () => {
        if (scheduleType === 'manual') return null;
        const [hh, mm] = scheduleTime.split(':');
        const h = parseInt(hh, 10);
        const m = parseInt(mm, 10);

        if (scheduleType === 'daily') return `${m} ${h} * * *`;
        if (scheduleType === 'weekly') return `${m} ${h} * * ${scheduleDay}`;
        if (scheduleType === 'monthly') {
            if (monthlyMode === 'date') {
                const dayPart = isLastDayOfMonth ? 'L' : scheduleDay;
                return `${m} ${h} ${dayPart} * *`;
            } else {
                const dayOfWeekPart = monthlyOrdinal === 'L' ? `${scheduleDay}L` : `${scheduleDay}#${monthlyOrdinal}`;
                return `${m} ${h} * * ${dayOfWeekPart}`;
            }
        }
        return null;
    };

    const parseCronString = (cron: string) => {
        if (!cron) return { type: 'manual' as const };
        const parts = cron.split(' ');
        if (parts.length < 5) return { type: 'manual' as const };

        const m = parts[0].padStart(2, '0');
        const h = parts[1].padStart(2, '0');
        const time = `${h}:${m}`;

        const dom = parts[2];
        const mon = parts[3];
        const dow = parts[4];

        // Daily: m h * * *
        if (dom === '*' && mon === '*' && (dow === '*' || dow === undefined)) {
            return { type: 'daily' as const, time };
        }

        // Weekly: 0 m h * * dow
        if (dom === '*' && mon === '*' && dow !== '*' && !dow.includes('#') && !dow.includes('L')) {
            return { type: 'weekly' as const, time, day: dow };
        }

        // Monthly Date: 0 m h dom * *
        if (dom !== '*' && mon === '*' && (dow === '*' || dow === undefined)) {
            if (dom === 'L') {
                return { type: 'monthly' as const, mode: 'date' as const, lastDay: true, time };
            }
            return { type: 'monthly' as const, mode: 'date' as const, day: dom, time };
        }

        // Monthly Relative: 0 m h * * shift#ordinal or shiftL
        if (dom === '*' && mon === '*' && dow !== '*') {
            if (dow.includes('#')) {
                const [d, o] = dow.split('#');
                return { type: 'monthly' as const, mode: 'day' as const, day: d, ordinal: o, time };
            }
            if (dow.endsWith('L')) {
                const d = dow.slice(0, -1);
                return { type: 'monthly' as const, mode: 'day' as const, day: d, ordinal: 'L', time };
            }
        }

        return { type: 'manual' as const };
    };

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
        console.log('Editing Pipeline:', pipeline);

        // Populate rich scheduling state from cron
        if (!pipeline.schedule_id && pipeline.cron_schedule) {
            const parsed = parseCronString(pipeline.cron_schedule);
            setScheduleType(parsed.type);
            if ('time' in parsed) setScheduleTime(parsed.time as string);
            if ('day' in parsed) setScheduleDay(parsed.day as string);
            if ('mode' in parsed) setMonthlyMode(parsed.mode as any);
            if ('ordinal' in parsed) setMonthlyOrdinal(parsed.ordinal as string);
            if ('lastDay' in parsed) setIsLastDayOfMonth(parsed.lastDay as boolean);
        } else {
            setScheduleType('manual');
        }

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

        // Finalize custom cron if applicable
        const finalCron = (!formData.schedule_id && scheduleType !== 'manual')
            ? getCronString()
            : formData.cron_schedule;

        const payload = {
            ...formData,
            cron_schedule: finalCron || undefined,
            partition_start_dt: formData.partition_start_dt || undefined
        };

        try {
            if (editingPipeline) {
                // Strip fields that are not allowed in Update schema (JobUpdate)
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { job_nm, instance_id, ...updatePayload } = payload as any;
                await api.pipelines.update(editingPipeline.id, updatePayload);
            } else {
                await api.pipelines.create(payload);
            }
            setShowModal(false);
            fetchPipelines();
        } catch (err: any) {
            const detail = err.response?.data?.detail;
            const errorMsg = typeof detail === 'object' ? JSON.stringify(detail) : (detail || err.message);
            alert(`Failed to save: ${errorMsg}`);
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

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '2rem' }}>
                <div className="premium-search-container" style={{ position: 'relative', width: '400px' }}>
                    <X
                        size={18}
                        style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', opacity: search ? 1 : 0, transition: 'opacity 0.2s', zIndex: 10 }}
                        onClick={() => setSearch('')}
                    />
                    <input
                        type="text"
                        placeholder="Search pipelines..."
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPageOffset(0);
                        }}
                        className="premium-input"
                        style={{ padding: '0.6rem 2.5rem 0.6rem 1rem', width: '100%', fontSize: '0.9rem' }}
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
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    <div className="nexus-field-container">
                                        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            Execution Schedule <span title="Define when this pipeline should run automatically."><HelpCircle size={14} color="var(--text-tertiary)" style={{ cursor: 'help' }} /></span>
                                        </label>
                                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
                                            {[
                                                { id: 'manual', label: 'Manual' },
                                                { id: 'daily', label: 'Daily' },
                                                { id: 'weekly', label: 'Weekly' },
                                                { id: 'monthly', label: 'Monthly' }
                                            ].map(opt => (
                                                <button
                                                    key={opt.id}
                                                    type="button"
                                                    onClick={() => setScheduleType(opt.id as any)}
                                                    style={{
                                                        flex: 1,
                                                        padding: '0.75rem',
                                                        borderRadius: '8px',
                                                        background: scheduleType === opt.id ? 'var(--accent-primary)' : 'rgba(255,255,255,0.03)',
                                                        border: '1px solid',
                                                        borderColor: scheduleType === opt.id ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)',
                                                        color: scheduleType === opt.id ? 'white' : 'var(--text-secondary)',
                                                        fontWeight: 600,
                                                        transition: 'all 0.2s',
                                                        fontSize: '0.85rem'
                                                    }}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {scheduleType !== 'manual' && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            style={{ padding: '1.5rem', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.1)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}
                                        >
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                    <Clock size={14} /> Run Time (UTC)
                                                </label>
                                                <input
                                                    type="time"
                                                    className="premium-input"
                                                    value={scheduleTime}
                                                    onChange={(e) => setScheduleTime(e.target.value)}
                                                    style={{ width: '100%', padding: '0.5rem' }}
                                                />
                                            </div>

                                            {scheduleType === 'weekly' && (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Day of Week</label>
                                                    <select className="premium-input" value={scheduleDay} onChange={(e) => setScheduleDay(e.target.value)} style={{ width: '100%', padding: '0.5rem' }}>
                                                        <option value="1">Monday</option>
                                                        <option value="2">Tuesday</option>
                                                        <option value="3">Wednesday</option>
                                                        <option value="4">Thursday</option>
                                                        <option value="5">Friday</option>
                                                        <option value="6">Saturday</option>
                                                        <option value="0">Sunday</option>
                                                    </select>
                                                </div>
                                            )}

                                            {scheduleType === 'monthly' && (
                                                <div style={{ gridColumn: '1 / span 2', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                        <button
                                                            type="button"
                                                            onClick={() => setMonthlyMode('date')}
                                                            style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.7rem', background: monthlyMode === 'date' ? 'rgba(255,255,255,0.1)' : 'transparent', border: '1px solid rgba(255,255,255,0.1)' }}
                                                        >Day of Month</button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setMonthlyMode('day')}
                                                            style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.7rem', background: monthlyMode === 'day' ? 'rgba(255,255,255,0.1)' : 'transparent', border: '1px solid rgba(255,255,255,0.1)' }}
                                                        >Relative Day</button>
                                                    </div>

                                                    {monthlyMode === 'date' ? (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                            <input
                                                                type="number" min="1" max="31"
                                                                className="premium-input"
                                                                value={scheduleDay}
                                                                onChange={(e) => { setScheduleDay(e.target.value); setIsLastDayOfMonth(false); }}
                                                                disabled={isLastDayOfMonth}
                                                                style={{ width: '80px', padding: '0.5rem' }}
                                                            />
                                                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                                                                <input type="checkbox" checked={isLastDayOfMonth} onChange={(e) => setIsLastDayOfMonth(e.target.checked)} />
                                                                Last Day
                                                            </label>
                                                        </div>
                                                    ) : (
                                                        <div style={{ display: 'flex', gap: '1rem' }}>
                                                            <select className="premium-input" value={monthlyOrdinal} onChange={(e) => setMonthlyOrdinal(e.target.value)} style={{ flex: 1, padding: '0.5rem' }}>
                                                                <option value="1">First</option>
                                                                <option value="2">Second</option>
                                                                <option value="3">Third</option>
                                                                <option value="4">Fourth</option>
                                                                <option value="L">Last</option>
                                                            </select>
                                                            <select className="premium-input" value={scheduleDay} onChange={(e) => setScheduleDay(e.target.value)} style={{ flex: 1, padding: '0.5rem' }}>
                                                                <option value="1">Monday</option>
                                                                <option value="2">Tuesday</option>
                                                                <option value="3">Wednesday</option>
                                                                <option value="4">Thursday</option>
                                                                <option value="5">Friday</option>
                                                                <option value="6">Saturday</option>
                                                                <option value="0">Sunday</option>
                                                            </select>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </motion.div>
                                    )}
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
