import React from 'react';
import { X, FileCode, Layers, Info, ExternalLink } from 'lucide-react';
import jsYaml from 'js-yaml';

interface JobDefinitionModalProps {
    definition: any;
    onClose: () => void;
}

export const JobDefinitionModal: React.FC<JobDefinitionModalProps> = ({ definition, onClose }) => {
    // Convert JSON definition to YAML for display
    const yamlString = definition.yaml_def ? jsYaml.dump(definition.yaml_def) : '# No definition available';

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
            <div className="glass" style={{ width: '1000px', maxWidth: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
                {/* Header */}
                <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ padding: '0.75rem', background: 'var(--accent-primary-transparent)', borderRadius: '12px', color: 'var(--accent-primary)' }}>
                            <FileCode size={24} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{definition.job_nm}</h2>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Job Definition (Source of Truth)</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="btn-secondary" style={{ padding: '0.5rem' }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '2rem', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: '2rem' }}>
                    {/* Left: YAML View */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                            <FileCode size={18} />
                            Definition YAML
                        </div>
                        <div style={{
                            background: '#0d1117',
                            borderRadius: '12px',
                            padding: '1.5rem',
                            border: '1px solid #30363d',
                            fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
                            fontSize: '0.9rem',
                            lineHeight: 1.6,
                            color: '#e6edf3',
                            overflowX: 'auto',
                            position: 'relative'
                        }}>
                            <pre style={{ margin: 0 }}>{yamlString}</pre>
                        </div>
                    </div>

                    {/* Right: Metadata & Assets */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        {/* Info Section */}
                        <div style={{ background: 'var(--glass-bg)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontWeight: 600 }}>
                                <Info size={16} color="var(--accent-secondary)" />
                                Infrastructure
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Team</span>
                                    <span style={{ fontWeight: 600 }}>{definition.team_nm}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>GitLab / Source</span>
                                    {definition.repo_url ? (
                                        <a
                                            href={definition.repo_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                                fontWeight: 600,
                                                color: 'var(--accent-primary)',
                                                maxWidth: '180px',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                textDecoration: 'none',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.25rem'
                                            }}
                                            title={definition.repo_url}
                                        >
                                            {definition.repo_url.replace(/^https?:\/\//, '')}
                                            <ExternalLink size={12} />
                                        </a>
                                    ) : (
                                        <span style={{ fontWeight: 600, color: 'var(--text-tertiary)' }}>
                                            {definition.location_nm || 'N/A'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Assets Section */}
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontWeight: 600 }}>
                                <Layers size={16} color="var(--accent-primary)" />
                                Selected Assets
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                {definition.asset_selection?.map((asset: string) => (
                                    <span key={asset} className="status-badge" style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.2)', padding: '0.25rem 0.6rem' }}>
                                        {asset}
                                    </span>
                                )) || <span style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>Full selection</span>}
                            </div>
                        </div>

                        {/* Description */}
                        {definition.description && (
                            <div>
                                <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Description</div>
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                                    {definition.description}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div style={{ padding: '1rem 2rem', background: 'rgba(255,255,255,0.01)', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={onClose} className="btn-primary">Done</button>
                </div>
            </div>
        </div>
    );
};
