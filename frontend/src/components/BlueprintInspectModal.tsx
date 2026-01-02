import React, { useState } from 'react';
import { X, Wand2, Code2, Info, Rocket, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface BlueprintInspectModalProps {
    blueprint: any;
    onClose: () => void;
    onUse?: (blueprint: any) => void;
}

export const BlueprintInspectModal: React.FC<BlueprintInspectModalProps> = ({
    blueprint,
    onClose,
    onUse
}) => {
    const [viewMode, setViewMode] = useState<'schema' | 'logic'>('schema');
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(JSON.stringify(blueprint.params_schema, null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <AnimatePresence>
            <div className="modal-overlay" onClick={onClose}>
                <motion.div
                    className="glass modal-content"
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        width: '900px',
                        maxWidth: '95vw',
                        height: 'auto',
                        maxHeight: '90vh',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        padding: 0,
                        border: '1px solid var(--glass-border)'
                    }}
                >
                    {/* Header */}
                    <div style={{
                        padding: '1.5rem 2rem',
                        borderBottom: '1px solid var(--glass-border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'rgba(255,255,255,0.02)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '10px',
                                background: 'rgba(99, 102, 241, 0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--accent-primary)'
                            }}>
                                <Info size={20} />
                            </div>
                            <div>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Blueprint Inspection</h2>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Discover the DNA of this clinical pattern</p>
                            </div>
                        </div>
                        <button onClick={onClose} style={{ color: 'var(--text-tertiary)' }} className="hover:text-white transition-colors">
                            <X size={24} />
                        </button>
                    </div>

                    {/* Main Body */}
                    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', flex: 1, overflow: 'hidden' }}>
                        {/* Sidebar */}
                        <div style={{
                            padding: '2rem',
                            background: 'rgba(0,0,0,0.1)',
                            borderRight: '1px solid var(--glass-border)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2rem'
                        }}>
                            <div>
                                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>{blueprint.job_nm}</h3>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                    {blueprint.description || 'No description provided for this blueprint template.'}
                                </p>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)' }}>Metadata</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                        <span style={{ color: 'var(--text-tertiary)' }}>Team</span>
                                        <span>{blueprint.team_nm}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                        <span style={{ color: 'var(--text-tertiary)' }}>Usage</span>
                                        <span>{blueprint.instance_count} Instances</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                        <span style={{ color: 'var(--text-tertiary)' }}>Created</span>
                                        <span>{new Date(blueprint.creat_dttm).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>

                            <div style={{ marginTop: 'auto' }}>
                                {onUse && (
                                    <button
                                        className="btn-primary"
                                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '0.85rem' }}
                                        onClick={() => onUse(blueprint)}
                                    >
                                        <Rocket size={18} /> Use Blueprint
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Content Area */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            {/* Tabs */}
                            <div style={{ padding: '1rem 2rem', display: 'flex', gap: '1.5rem', borderBottom: '1px solid var(--glass-border)' }}>
                                <button
                                    onClick={() => setViewMode('schema')}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        fontSize: '0.85rem',
                                        fontWeight: 600,
                                        color: viewMode === 'schema' ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                                        borderBottom: viewMode === 'schema' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                                        paddingBottom: '0.5rem'
                                    }}
                                >
                                    <Wand2 size={16} /> Parameters DNA
                                </button>
                                <button
                                    onClick={() => setViewMode('logic')}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        fontSize: '0.85rem',
                                        fontWeight: 600,
                                        color: viewMode === 'logic' ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                                        borderBottom: viewMode === 'logic' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                                        paddingBottom: '0.5rem'
                                    }}
                                >
                                    <Code2 size={16} /> Underlying Logic
                                </button>
                            </div>

                            {/* Panel Container */}
                            <div style={{ flex: 1, overflow: 'auto', padding: '2rem' }}>
                                <AnimatePresence mode="wait">
                                    {viewMode === 'schema' ? (
                                        <motion.div
                                            key="schema"
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 10 }}
                                            transition={{ duration: 0.2 }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>Expected Configuration</h4>
                                                <button
                                                    onClick={handleCopy}
                                                    className="btn-secondary"
                                                    style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                                >
                                                    {copied ? <Check size={14} /> : <Copy size={14} />}
                                                    {copied ? 'Copied' : 'Copy Schema'}
                                                </button>
                                            </div>

                                            {blueprint.params_schema && blueprint.params_schema.properties ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                    {Object.entries(blueprint.params_schema.properties).map(([key, value]: [string, any]) => (
                                                        <div key={key} style={{
                                                            padding: '1.25rem',
                                                            background: 'rgba(255,255,255,0.02)',
                                                            borderRadius: '12px',
                                                            border: '1px solid var(--glass-border)'
                                                        }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                                <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--accent-primary)' }}>{key}</span>
                                                                <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', color: 'var(--text-tertiary)' }}>
                                                                    {value.type} {blueprint.params_schema.required?.includes(key) && <span style={{ color: 'var(--error)' }}>*</span>}
                                                                </span>
                                                            </div>
                                                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{value.description || 'No description provided.'}</p>
                                                            {value.enum && (
                                                                <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                                    {value.enum.map((opt: string) => (
                                                                        <span key={opt} style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)' }}>{opt}</span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div style={{ textAlign: 'center', padding: '4rem', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px dashed var(--glass-border)' }}>
                                                    <p style={{ color: 'var(--text-tertiary)' }}>No parameter requirements defined for this blueprint.</p>
                                                </div>
                                            )}
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="logic"
                                            initial={{ opacity: 0, x: 10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -10 }}
                                            transition={{ duration: 0.2 }}
                                        >
                                            <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                <Info size={14} />
                                                Peeking at the underlying YAML definition from Source Control
                                            </div>
                                            <pre className="terminal" style={{ height: '500px', fontSize: '0.8rem', padding: '1.5rem' }}>
                                                {blueprint.yaml_content || '# Logic hidden in source control'}
                                            </pre>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>

            <style>{`
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.8);
                    backdrop-filter: blur(12px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                    padding: 2rem;
                }
            `}</style>
        </AnimatePresence>
    );
};
