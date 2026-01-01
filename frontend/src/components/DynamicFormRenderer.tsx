import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { GenericSchemaForm } from './GenericSchemaForm';
import { useAuth } from '../contexts/AuthContext';
import { Wand2, Code2, Save, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DynamicFormRendererProps {
    pipelineId: number;
    onSubmit?: (params: any) => void;
    readOnly?: boolean;
}

/**
 * Core component that renders forms dynamically from JSON Schema for Pipelines.
 * Now supports a "Dual Mode" view: Interactive Form vs Raw JSON.
 */
export const DynamicFormRenderer: React.FC<DynamicFormRendererProps> = ({
    pipelineId,
    onSubmit,
    readOnly
}) => {
    const { hasPermission } = useAuth();
    const canEdit = hasPermission('CAN_EDIT_PIPELINES');
    const [schema, setSchema] = useState<any>(null);
    const [formData, setFormData] = useState<any>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'visual' | 'code'>('visual');

    useEffect(() => {
        const fetchSchemaAndParams = async () => {
            try {
                setLoading(true);
                const schemaRes = await api.pipelines.getSchema(pipelineId);
                setSchema(schemaRes.data.json_schema);

                try {
                    const paramsRes = await api.pipelines.getParams(pipelineId);
                    setFormData(paramsRes.data.config_json || {});
                } catch (err) {
                    setFormData({});
                }
                setError(null);
            } catch (err: any) {
                setError(err.response?.data?.detail || 'Failed to load schema');
            } finally {
                setLoading(false);
            }
        };
        fetchSchemaAndParams();
    }, [pipelineId]);

    const handleSubmit = async (data: any) => {
        try {
            const payload = typeof data === 'string' ? JSON.parse(data) : data;
            await api.pipelines.updateParams(pipelineId, payload);
            setFormData(payload);
            if (onSubmit) onSubmit(payload);
            alert('Configuration updated successfully!');
        } catch (err: any) {
            alert(`Failed to save: ${err.message}`);
        }
    };

    if (loading) return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>Fetching template schema...</div>;
    if (error) return <div style={{ padding: '2rem', color: 'var(--error)', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.1)' }}>Error: {error}</div>;
    if (!schema) return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-tertiary)', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>No configuration schema registered for this pipeline.</div>;

    return (
        <div className="dynamic-config-engine">
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '2.5rem',
                gap: '1rem'
            }}>
                <div className="pill-toggle-container">
                    <button
                        onClick={() => setViewMode('visual')}
                        className={`pill-btn ${viewMode === 'visual' ? 'active' : ''}`}
                    >
                        <Wand2 size={14} /> Visual
                    </button>
                    <button
                        onClick={() => setViewMode('code')}
                        className={`pill-btn ${viewMode === 'code' ? 'active' : ''}`}
                    >
                        <Code2 size={14} /> Code
                    </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <Info size={14} style={{ opacity: 0.5 }} />
                    {viewMode === 'visual' ? 'Guided UI Designer' : 'Direct Source Editor'}
                </div>
            </div>

            <AnimatePresence mode="wait">
                {viewMode === 'visual' ? (
                    <motion.div
                        key="visual"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                    >
                        <GenericSchemaForm
                            schema={schema}
                            formData={formData}
                            onSubmit={handleSubmit}
                            onChange={(data: any) => setFormData(data)}
                            readOnly={readOnly || !canEdit}
                        />
                    </motion.div>
                ) : (
                    <motion.div
                        key="code"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                    >
                        <div style={{ position: 'relative' }}>
                            <textarea
                                className="terminal"
                                style={{
                                    width: '100%',
                                    height: '500px',
                                    resize: 'none',
                                    padding: '1.5rem',
                                    outline: 'none',
                                    border: '1px solid var(--glass-border)',
                                    fontSize: '0.9rem'
                                }}
                                value={JSON.stringify(formData, null, 4)}
                                readOnly={readOnly || !canEdit}
                                onChange={(e) => {
                                    try {
                                        const parsed = JSON.parse(e.target.value);
                                        setFormData(parsed);
                                    } catch (err) {
                                        // Silent error
                                    }
                                }}
                            />
                            {!readOnly && canEdit && (
                                <button
                                    onClick={() => handleSubmit(formData)}
                                    className="btn-primary"
                                    style={{
                                        position: 'absolute',
                                        bottom: '1.5rem',
                                        right: '1.5rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        padding: '0.6rem 1.25rem',
                                        fontSize: '0.85rem'
                                    }}
                                >
                                    <Save size={16} /> Save Changes
                                </button>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <style>{`
                .pill-toggle-container {
                    display: flex;
                    background: rgba(255,255,255,0.03);
                    padding: 4px;
                    border-radius: 10px;
                    border: 1px solid var(--glass-border);
                    gap: 2px;
                }
                .pill-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 6px 16px;
                    border-radius: 7px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: var(--text-secondary);
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .pill-btn:hover:not(.active) {
                    background: rgba(255,255,255,0.05);
                    color: var(--text-primary);
                }
                .pill-btn.active {
                    background: var(--accent-primary);
                    color: white;
                    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
                }
            `}</style>
        </div>
    );
};
