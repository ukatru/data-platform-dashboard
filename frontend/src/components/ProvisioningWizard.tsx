import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Rocket, Check, AlertCircle, Info, Layout, Settings, Activity, Calendar, Clock, ShieldCheck, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GenericSchemaForm } from './GenericSchemaForm';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface ProvisioningWizardProps {
    blueprint: any;
    onClose: () => void;
    onSuccess: (newInstanceId: number) => void;
}

type WizardStep = 'identity' | 'config' | 'lifecycle' | 'review';

export const ProvisioningWizard: React.FC<ProvisioningWizardProps> = ({
    blueprint,
    onClose,
    onSuccess
}) => {
    const { user, currentTeamId } = useAuth();
    const [step, setStep] = useState<WizardStep>('identity');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Identity State
    const [idValidating, setIdValidating] = useState(false);
    const [idAvailable, setIdAvailable] = useState<boolean | null>(null);

    // Schedule Picker State
    const [scheduleType, setScheduleType] = useState<'manual' | 'daily' | 'weekly' | 'monthly'>('manual');
    const [scheduleTime, setScheduleTime] = useState('02:00');
    const [scheduleDay, setScheduleDay] = useState('1'); // Monday for weekly, 1st for monthly
    const [monthlyMode, setMonthlyMode] = useState<'date' | 'day'>('date');
    const [monthlyOrdinal, setMonthlyOrdinal] = useState('1'); // 1st, 2nd, etc.
    const [isLastDayOfMonth, setIsLastDayOfMonth] = useState(false);

    // Teams State
    const [teams, setTeams] = useState<any[]>([]);
    const [teamsLoading, setTeamsLoading] = useState(true);

    // Form State
    const [formData, setFormData] = useState({
        instance_id: '',
        team_id: 0,
        description: '',
        config: {},
    });

    const isOrgAdmin = user?.permissions?.includes('PLATFORM_ADMIN');

    useEffect(() => {
        const loadTeams = async () => {
            setTeamsLoading(true);
            try {
                let availableTeams = [];
                if (isOrgAdmin) {
                    const res = await api.management.listTeams();
                    availableTeams = res.data;
                } else {
                    availableTeams = (user?.team_memberships || [])
                        .filter(tm => tm.role.role_nm !== 'Viewer')
                        .map(tm => ({
                            id: tm.team_id,
                            team_nm: tm.team.team_nm,
                            role_nm: tm.role.role_nm
                        }));
                }
                setTeams(availableTeams);

                if (availableTeams.length > 0) {
                    const initialTeamId = blueprint.team_id || currentTeamId || availableTeams[0].id;
                    const hasSelected = availableTeams.some((t: any) => t.id === initialTeamId);
                    setFormData(prev => ({
                        ...prev,
                        team_id: hasSelected ? initialTeamId : availableTeams[0].id
                    }));
                }
            } catch (err) {
                console.error("Failed to load teams", err);
                setError("Failed to load available teams. Please refresh.");
            } finally {
                setTeamsLoading(false);
            }
        };

        loadTeams();
    }, [user, isOrgAdmin, currentTeamId, blueprint.team_id]);

    // Instance ID Validation Debounce
    useEffect(() => {
        if (!formData.instance_id) {
            setIdAvailable(null);
            setError(null);
            return;
        }

        // Immediately reset availability while typing to avoid "sticky" green checkmarks
        setIdAvailable(null);

        const timer = setTimeout(async () => {
            setIdValidating(true);
            try {
                const res = await api.pipelines.validateId(formData.instance_id);
                setIdAvailable(res.data.available);
                if (!res.data.available) {
                    setError(`ID "${formData.instance_id}" is taken: ${res.data.reason}`);
                } else {
                    setError(null);
                }
            } catch (err) {
                console.error("Validation failed", err);
            } finally {
                setIdValidating(false);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [formData.instance_id]);

    const steps: { key: WizardStep; label: string; icon: any }[] = [
        { key: 'identity', label: 'Identity', icon: Layout },
        { key: 'config', label: 'Configuration', icon: Settings },
        { key: 'lifecycle', label: 'Lifecycle', icon: Calendar },
        { key: 'review', label: 'Review & Deploy', icon: Activity }
    ];

    const currentStepIndex = steps.findIndex(s => s.key === step);

    const getCronString = () => {
        if (scheduleType === 'manual') return null;
        const [hh, mm] = scheduleTime.split(':');
        const h = parseInt(hh, 10);
        const m = parseInt(mm, 10);

        if (scheduleType === 'daily') return `0 ${m} ${h} * * *`;
        if (scheduleType === 'weekly') return `0 ${m} ${h} * * ${scheduleDay}`;
        if (scheduleType === 'monthly') {
            if (monthlyMode === 'date') {
                const dayPart = isLastDayOfMonth ? 'L' : scheduleDay;
                return `0 ${m} ${h} ${dayPart} * *`;
            } else {
                // Ordinal support (e.g., 3rd Friday)
                // croniter supports "#" for ordinal: 5#3 is 3rd Friday
                // and "L" for last day of week: 5L is last Friday
                const dayOfWeekPart = monthlyOrdinal === 'L' ? `${scheduleDay}L` : `${scheduleDay}#${monthlyOrdinal}`;
                return `0 ${m} ${h} * * ${dayOfWeekPart}`;
            }
        }
        return null;
    };

    const handleNext = async () => {
        if (step === 'identity') {
            if (!formData.instance_id) {
                setError("Instance ID is required.");
                return;
            }
            if (!/^[a-z0-9_]+$/.test(formData.instance_id)) {
                setError("Instance ID can only contain lowercase letters, numbers, and underscores.");
                return;
            }
            if (idValidating) {
                setError("Validation in progress... please wait.");
                return;
            }
            if (idAvailable !== true) {
                setError("Please choose a unique Instance ID (must be validated).");
                return;
            }
            if (!formData.description || formData.description.length < 10) {
                setError("Description is mandatory (min 10 chars) for production traceability.");
                return;
            }
            if (!formData.team_id) {
                setError("Please select an owning team.");
                return;
            }
            setStep('config');
        } else if (step === 'config') {
            setStep('lifecycle');
        } else if (step === 'lifecycle') {
            setStep('review');
        }
        setError(null);
    };

    const handleBack = () => {
        if (step === 'config') setStep('identity');
        else if (step === 'lifecycle') setStep('config');
        else if (step === 'review') setStep('lifecycle');
        setError(null);
    };

    const handleDeploy = async () => {
        setLoading(true);
        setError(null);
        try {
            const instancePayload = {
                instance_id: formData.instance_id,
                job_nm: blueprint.job_nm,
                job_definition_id: blueprint.id,
                org_id: blueprint.org_id,
                team_id: formData.team_id,
                description: formData.description,
                cron_schedule: getCronString(),
                actv_ind: true
            };

            const instRes = await api.pipelines.create(instancePayload);
            const instId = instRes.data.id;
            await api.pipelines.updateParams(instId, formData.config);
            onSuccess(instId);
        } catch (err: any) {
            console.error("Failed to provision pipeline", err);
            setError(err.response?.data?.detail || "Failed to deploy pipeline. Please check your configuration.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <motion.div
                className="glass wizard-modal"
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: '940px',
                    maxWidth: '95vw',
                    height: 'auto',
                    minHeight: '640px',
                    maxHeight: '90vh',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    padding: 0
                }}
            >
                {/* Header & Stepper */}
                <div style={{
                    padding: '1.25rem 2rem',
                    borderBottom: '1px solid var(--glass-border)',
                    background: 'rgba(255,255,255,0.02)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                        <div>
                            <h2 style={{ fontSize: '1.35rem', fontWeight: 700 }}>Deploy Pattern</h2>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                {blueprint.job_nm} &gt; <span style={{ color: 'var(--accent-primary)' }}>Instance Draft</span>
                            </p>
                        </div>
                        <button onClick={onClose} style={{ color: 'var(--text-tertiary)' }} className="hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Stepper */}
                    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                        {steps.map((s, idx) => {
                            const Icon = s.icon;
                            const isActive = s.key === step;
                            const isCompleted = currentStepIndex > idx;
                            return (
                                <React.Fragment key={s.key}>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        opacity: isActive || isCompleted ? 1 : 0.4,
                                        transition: 'all 0.3s'
                                    }}>
                                        <div style={{
                                            width: '28px',
                                            height: '28px',
                                            borderRadius: '6px',
                                            background: isCompleted ? 'var(--success)' : (isActive ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)'),
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: 'white',
                                            boxShadow: isActive ? '0 0 10px rgba(99, 102, 241, 0.3)' : 'none'
                                        }}>
                                            {isCompleted ? <Check size={14} /> : <Icon size={14} />}
                                        </div>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: isActive ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                                            {s.label}
                                        </span>
                                    </div>
                                    {idx < steps.length - 1 && (
                                        <div style={{ width: '30px', height: '1px', background: 'var(--glass-border)' }} />
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>

                {/* Content Area */}
                <div style={{ flex: 1, overflow: 'auto', padding: '2rem' }}>
                    <AnimatePresence mode="wait">
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                style={{
                                    background: 'rgba(239, 68, 68, 0.1)',
                                    border: '1px solid rgba(239, 68, 68, 0.2)',
                                    padding: '0.75rem 1rem',
                                    borderRadius: '8px',
                                    color: '#f87171',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    marginBottom: '1.5rem',
                                    fontSize: '0.85rem'
                                }}
                            >
                                <AlertCircle size={16} />
                                {error}
                            </motion.div>
                        )}

                        {step === 'identity' && (
                            <motion.div
                                key="identity"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
                            >
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="nexus-field-container">
                                        <label className="nexus-label">Unique Instance ID *</label>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                type="text"
                                                className={`nexus-input ${idAvailable === false ? 'border-red-500' : ''}`}
                                                placeholder="e.g. sales__ingest_v1"
                                                value={formData.instance_id}
                                                onChange={(e) => setFormData({ ...formData, instance_id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                                            />
                                            <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }}>
                                                {idValidating && <div className="spinner-xs" />}
                                                {idAvailable === true && <ShieldCheck size={16} color="var(--success)" />}
                                                {idAvailable === false && <AlertCircle size={16} color="#f87171" />}
                                            </div>
                                        </div>
                                        <p className="field-hint">Used for runtime routing and identification. Only letters, numbers, and underscores allowed.</p>
                                    </div>

                                    <div className="nexus-field-container">
                                        <label className="nexus-label">Assigned Team</label>
                                        <select
                                            className="nexus-select"
                                            value={formData.team_id}
                                            onChange={(e) => setFormData({ ...formData, team_id: parseInt(e.target.value) })}
                                            disabled={teamsLoading}
                                        >
                                            {teamsLoading ? (
                                                <option value={0}>Loading teams...</option>
                                            ) : teams.length === 0 ? (
                                                <option value={0}>No eligible teams found</option>
                                            ) : (
                                                teams.map(t => (
                                                    <option key={t.id} value={t.id}>
                                                        {t.team_nm} {t.role_nm ? `(${t.role_nm})` : ''}
                                                    </option>
                                                ))
                                            )}
                                        </select>
                                        <p className="field-hint">
                                            {isOrgAdmin ? 'Select an owner team for this deployment.' : 'Only teams where you have Editor/Admin access are shown.'}
                                        </p>
                                    </div>
                                </div>

                                <div className="nexus-field-container">
                                    <label className="nexus-label">Description</label>
                                    <textarea
                                        className="nexus-input"
                                        style={{ minHeight: '80px', resize: 'vertical' }}
                                        placeholder="Business purpose of this instance..."
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    />
                                </div>
                            </motion.div>
                        )}

                        {step === 'config' && (
                            <motion.div
                                key="config"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="compact-config-scroll"
                            >
                                <GenericSchemaForm
                                    schema={blueprint.params_schema || {}}
                                    formData={formData.config}
                                    layout="compact"
                                    onChange={(data) => setFormData({ ...formData, config: data })}
                                    onSubmit={handleNext}
                                >
                                    <div style={{ display: 'none' }} />
                                </GenericSchemaForm>
                            </motion.div>
                        )}

                        {step === 'lifecycle' && (
                            <motion.div
                                key="lifecycle"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}
                            >
                                <div className="nexus-field-container">
                                    <label className="nexus-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        Execution Schedule <span title="Define when this pipeline should run automatically."><HelpCircle size={14} color="var(--text-tertiary)" className="cursor-help" /></span>
                                    </label>
                                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                        {[
                                            { id: 'manual', label: 'Manual', tip: 'Run on demand only' },
                                            { id: 'daily', label: 'Daily', tip: 'Once every day' },
                                            { id: 'weekly', label: 'Weekly', tip: 'Once every week' },
                                            { id: 'monthly', label: 'Monthly', tip: 'Once every month' }
                                        ].map(opt => (
                                            <button
                                                key={opt.id}
                                                onClick={() => setScheduleType(opt.id as any)}
                                                style={{
                                                    flex: 1,
                                                    padding: '1rem',
                                                    borderRadius: '12px',
                                                    background: scheduleType === opt.id ? 'var(--accent-primary)' : 'rgba(255,255,255,0.03)',
                                                    border: '1px solid',
                                                    borderColor: scheduleType === opt.id ? 'var(--accent-primary)' : 'var(--glass-border)',
                                                    color: scheduleType === opt.id ? 'white' : 'var(--text-secondary)',
                                                    fontWeight: 600,
                                                    transition: 'all 0.2s',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    gap: '0.25rem'
                                                }}
                                            >
                                                <span>{opt.label}</span>
                                                <span style={{ fontSize: '0.65rem', fontWeight: 400, opacity: 0.7 }}>{opt.tip}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {scheduleType !== 'manual' && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="glass"
                                        style={{ padding: '2rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', background: 'rgba(99, 102, 241, 0.05)' }}
                                    >
                                        <div className="nexus-field-container">
                                            <label className="nexus-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <Clock size={16} /> Run Time (UTC)
                                            </label>
                                            <input
                                                type="time"
                                                className="nexus-input"
                                                value={scheduleTime}
                                                onChange={(e) => setScheduleTime(e.target.value)}
                                            />
                                            <p className="field-hint" style={{ color: 'var(--accent-primary)', fontSize: '0.7rem' }}>
                                                Note: All times are in UTC to ensure global consistency.
                                            </p>
                                        </div>

                                        {scheduleType === 'weekly' && (
                                            <div className="nexus-field-container">
                                                <label className="nexus-label">Day of Week</label>
                                                <select className="nexus-select" value={scheduleDay} onChange={(e) => setScheduleDay(e.target.value)}>
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
                                            <div className="nexus-field-container" style={{ gridColumn: '1 / span 2' }}>
                                                <label className="nexus-label">Monthly strategy</label>
                                                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
                                                    {[
                                                        { id: 'date', label: 'Day of Month', icon: Calendar },
                                                        { id: 'day', label: 'Relative Day', icon: Clock }
                                                    ].map(strat => (
                                                        <button
                                                            key={strat.id}
                                                            onClick={() => setMonthlyMode(strat.id as any)}
                                                            style={{
                                                                padding: '0.6rem 1.25rem',
                                                                borderRadius: '8px',
                                                                background: monthlyMode === strat.id ? 'var(--accent-primary)' : 'rgba(255,255,255,0.03)',
                                                                border: '1px solid',
                                                                borderColor: monthlyMode === strat.id ? 'var(--accent-primary)' : 'var(--glass-border)',
                                                                color: monthlyMode === strat.id ? 'white' : 'var(--text-secondary)',
                                                                fontSize: '0.75rem',
                                                                fontWeight: 600,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '0.5rem',
                                                                transition: 'all 0.2s'
                                                            }}
                                                        >
                                                            <strat.icon size={14} />
                                                            {strat.label}
                                                        </button>
                                                    ))}
                                                </div>

                                                {monthlyMode === 'date' ? (
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                                                        <div className="nexus-field-container">
                                                            <label className="nexus-label">Day of Month</label>
                                                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    max="31"
                                                                    className="nexus-input"
                                                                    value={scheduleDay}
                                                                    onChange={(e) => {
                                                                        setScheduleDay(e.target.value);
                                                                        setIsLastDayOfMonth(false);
                                                                    }}
                                                                    disabled={isLastDayOfMonth}
                                                                    style={{ flex: 1 }}
                                                                />
                                                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isLastDayOfMonth}
                                                                        onChange={(e) => setIsLastDayOfMonth(e.target.checked)}
                                                                    />
                                                                    Last Day
                                                                </label>
                                                            </div>
                                                            <p className="field-hint">Useful for month-end reconciliation jobs.</p>
                                                        </div>
                                                        <div /> {/* Spacer */}
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                                                        <div className="nexus-field-container">
                                                            <label className="nexus-label">Occurrence</label>
                                                            <select className="nexus-select" value={monthlyOrdinal} onChange={(e) => setMonthlyOrdinal(e.target.value)}>
                                                                <option value="1">First</option>
                                                                <option value="2">Second</option>
                                                                <option value="3">Third</option>
                                                                <option value="4">Fourth</option>
                                                                <option value="L">Last</option>
                                                            </select>
                                                        </div>
                                                        <div className="nexus-field-container">
                                                            <label className="nexus-label">Day of Week</label>
                                                            <select className="nexus-select" value={scheduleDay} onChange={(e) => setScheduleDay(e.target.value)}>
                                                                <option value="1">Monday</option>
                                                                <option value="2">Tuesday</option>
                                                                <option value="3">Wednesday</option>
                                                                <option value="4">Thursday</option>
                                                                <option value="5">Friday</option>
                                                                <option value="6">Saturday</option>
                                                                <option value="0">Sunday</option>
                                                            </select>
                                                        </div>
                                                        <div style={{ gridColumn: '1 / span 2' }}>
                                                            <p className="field-hint" style={{ color: 'var(--accent-primary)', opacity: 0.9 }}>
                                                                Example: "The {
                                                                    monthlyOrdinal === 'L' ? 'Last' :
                                                                        ['1st', '2nd', '3rd', '4th'][parseInt(monthlyOrdinal) - 1]
                                                                } {
                                                                    ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][parseInt(scheduleDay)]
                                                                } of every month."
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </motion.div>
                                )}

                                <div className="glass" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(0,0,0,0.2)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <Info size={16} color="var(--accent-primary)" />
                                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                                            Scheduling Preview
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '2rem' }}>
                                        <div>
                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Technical Cron</div>
                                            <code style={{ color: 'var(--accent-primary)', fontWeight: 600, fontSize: '0.9rem' }}>{getCronString() || 'N/A (Ad-hoc)'}</code>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Next Execution</div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                {scheduleType === 'manual' ? 'Trigger manually via UI' : 'Calculated by engine'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {step === 'review' && (
                            <motion.div
                                key="review"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '2rem' }}
                            >
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div className="glass" style={{ padding: '1rem' }}>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Blueprint</div>
                                        <div style={{ fontWeight: 600 }}>{blueprint.job_nm}</div>
                                    </div>
                                    <div className="glass" style={{ padding: '1rem' }}>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Identity</div>
                                        <div style={{ fontWeight: 600 }}>{formData.instance_id}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Owned by {teams.find(t => t.id === formData.team_id)?.team_nm || 'Unknown'}</div>
                                    </div>
                                    <div className="glass" style={{ padding: '1rem' }}>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Schedule Strategy</div>
                                        <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <Calendar size={14} /> {scheduleType.toUpperCase()}
                                        </div>
                                        {scheduleType !== 'manual' && (
                                            <div style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', marginTop: '0.25rem' }}>
                                                {scheduleType === 'monthly' ? (
                                                    monthlyMode === 'date' ? (
                                                        isLastDayOfMonth ? 'Last day of every month' : `Day ${scheduleDay} of every month`
                                                    ) : (
                                                        `${monthlyOrdinal === 'L' ? 'Last' : ['First', 'Second', 'Third', 'Fourth'][parseInt(monthlyOrdinal) - 1]} ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][parseInt(scheduleDay)]} of every month`
                                                    )
                                                ) : scheduleType === 'weekly' ? (
                                                    `Every ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][parseInt(scheduleDay)]}`
                                                ) : (
                                                    'Every day'
                                                )}
                                                <span style={{ opacity: 0.6, marginLeft: '0.5rem' }}>({getCronString()})</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <h4 style={{ fontSize: '0.85rem', marginBottom: '1rem', fontWeight: 600, color: 'var(--text-tertiary)' }}>PARAMETER PREVIEW</h4>
                                    <pre className="terminal" style={{ fontSize: '0.75rem', height: '320px', overflow: 'auto' }}>
                                        {JSON.stringify(formData.config, null, 2)}
                                    </pre>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Footer Controls */}
                <div style={{
                    padding: '1.25rem 2.5rem',
                    borderTop: '1px solid var(--glass-border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'rgba(0,0,0,0.2)'
                }}>
                    <button
                        className="btn-secondary"
                        onClick={step === 'identity' ? onClose : handleBack}
                        disabled={loading}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}
                    >
                        {step === 'identity' ? 'Close' : <><ChevronLeft size={16} /> Back</>}
                    </button>

                    <div style={{ display: 'flex', gap: '1rem' }}>
                        {step !== 'review' ? (
                            <button
                                className="btn-primary"
                                onClick={handleNext}
                                disabled={step === 'identity' && (idAvailable !== true || idValidating)}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '100px', justifyContent: 'center', fontSize: '0.85rem' }}
                            >
                                Next <ChevronRight size={16} />
                            </button>
                        ) : (
                            <button
                                className="btn-primary"
                                onClick={handleDeploy}
                                disabled={loading}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    minWidth: '160px',
                                    justifyContent: 'center',
                                    background: 'var(--accent-primary)',
                                    boxShadow: '0 0 20px rgba(99, 102, 241, 0.4)',
                                    fontSize: '0.85rem'
                                }}
                            >
                                {loading ? 'Deploying...' : <><Rocket size={16} /> Finalize & Deploy</>}
                            </button>
                        )}
                    </div>
                </div>
            </motion.div>

            <style>{`
                .modal-overlay {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0, 0, 0, 0.85);
                    backdrop-filter: blur(12px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                    padding: 2rem;
                }
                .wizard-modal {
                    border: 1px solid var(--glass-border);
                    box-shadow: 0 40px 100px -20px rgba(0, 0, 0, 0.7);
                }
                .nexus-label {
                    display: block; 
                    margin-bottom: 0.5rem; 
                    font-size: 0.75rem; 
                    font-weight: 700; 
                    text-transform: uppercase; 
                    color: var(--accent-primary);
                    letter-spacing: 0.05em;
                }
                .field-hint {
                    font-size: 0.75rem; 
                    color: var(--text-tertiary); 
                    margin-top: 0.5rem;
                }
                .compact-config-scroll {
                    max-height: 450px;
                    overflow-y: auto;
                    padding-right: 1rem;
                }
                /* Custom scrollbar */
                .compact-config-scroll::-webkit-scrollbar {
                    width: 4px;
                }
                .compact-config-scroll::-webkit-scrollbar-track {
                    background: rgba(255, 255, 255, 0.02);
                }
                .compact-config-scroll::-webkit-scrollbar-thumb {
                    background: var(--accent-primary);
                    border-radius: 10px;
                }
                .grid { display: grid; }
                .grid-cols-2 { grid-template-columns: 1fr 1fr; }
                .gap-6 { gap: 1.5rem; }
                .spinner-xs {
                    width: 14px;
                    height: 14px;
                    border: 2px solid rgba(255,255,255,0.1);
                    border-top-color: var(--accent-primary);
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                .border-red-500 {
                    border-color: #f87171 !important;
                }
            `}</style>
        </div>
    );
};
