import React, { useState } from 'react';
import { X, ChevronRight, ChevronLeft, Rocket, Check, AlertCircle, Info, Layout, Settings, Activity, Calendar, Clock } from 'lucide-react';
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

    // Schedule Picker State
    const [scheduleType, setScheduleType] = useState<'manual' | 'daily' | 'weekly' | 'monthly'>('manual');
    const [scheduleTime, setScheduleTime] = useState('02:00');
    const [scheduleDay, setScheduleDay] = useState('1'); // Monday for weekly, 1st for monthly

    // Form State
    const [formData, setFormData] = useState({
        instance_id: '',
        team_id: blueprint.team_id || currentTeamId || (user?.team_memberships?.[0]?.team_id) || 0,
        description: '',
        config: {},
    });

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
        if (scheduleType === 'monthly') return `0 ${m} ${h} ${scheduleDay} * *`;
        return null;
    };

    const handleNext = () => {
        if (step === 'identity') {
            if (!formData.instance_id) {
                setError("Instance ID is required.");
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
                job_nm: blueprint.blueprint_nm,
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

    const userTeams = user?.team_memberships || [];

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
                                {blueprint.blueprint_nm} &gt; <span style={{ color: 'var(--accent-primary)' }}>Instance Draft</span>
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
                                        <input
                                            type="text"
                                            className="nexus-input"
                                            placeholder="e.g. sales-ingest-v1"
                                            value={formData.instance_id}
                                            onChange={(e) => setFormData({ ...formData, instance_id: e.target.value })}
                                        />
                                        <p className="field-hint">Used for runtime routing and identification.</p>
                                    </div>

                                    <div className="nexus-field-container">
                                        <label className="nexus-label">Assigned Team</label>
                                        <select
                                            className="nexus-select"
                                            value={formData.team_id}
                                            onChange={(e) => setFormData({ ...formData, team_id: parseInt(e.target.value) })}
                                        >
                                            {userTeams.map(tm => (
                                                <option key={tm.team_id} value={tm.team_id}>
                                                    {tm.team.team_nm} ({tm.role.role_nm})
                                                </option>
                                            ))}
                                        </select>
                                        <p className="field-hint">Which team owns this deployment?</p>
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
                                    <label className="nexus-label">Execution Schedule</label>
                                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                        {[
                                            { id: 'manual', label: 'Manual' },
                                            { id: 'daily', label: 'Daily' },
                                            { id: 'weekly', label: 'Weekly' },
                                            { id: 'monthly', label: 'Monthly' }
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
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                {opt.label}
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
                                            <div className="nexus-field-container">
                                                <label className="nexus-label">Day of Month</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="31"
                                                    className="nexus-input"
                                                    value={scheduleDay}
                                                    onChange={(e) => setScheduleDay(e.target.value)}
                                                />
                                            </div>
                                        )}
                                    </motion.div>
                                )}

                                <div className="glass" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(0,0,0,0.2)' }}>
                                    <Info size={16} color="var(--accent-primary)" />
                                    <span style={{ fontSize: '0.85rem' }}>
                                        Resulting Cron: <code style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{getCronString() || 'N/A (Ad-hoc)'}</code>
                                    </span>
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
                                        <div style={{ fontWeight: 600 }}>{blueprint.blueprint_nm}</div>
                                    </div>
                                    <div className="glass" style={{ padding: '1rem' }}>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Identity</div>
                                        <div style={{ fontWeight: 600 }}>{formData.instance_id}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Owned by {userTeams.find(t => t.team_id === formData.team_id)?.team.team_nm || 'Unknown'}</div>
                                    </div>
                                    <div className="glass" style={{ padding: '1rem' }}>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Schedule Strategy</div>
                                        <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <Calendar size={14} /> {scheduleType.toUpperCase()}
                                        </div>
                                        {scheduleType !== 'manual' && (
                                            <div style={{ fontSize: '0.75rem', color: 'var(--accent-primary)' }}>{getCronString()}</div>
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
                /* Custom scrollbar for better look */
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
            `}</style>
        </div>
    );
};
