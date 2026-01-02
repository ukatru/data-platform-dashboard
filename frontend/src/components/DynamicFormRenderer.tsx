import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { GenericSchemaForm } from './GenericSchemaForm';
import { useAuth } from '../contexts/AuthContext';
import { Info } from 'lucide-react';


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
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <Info size={14} style={{ opacity: 0.5 }} />
                    Guided Configuration Designer
                </div>
            </div>

            <GenericSchemaForm
                schema={schema}
                formData={formData}
                onSubmit={handleSubmit}
                onChange={(data: any) => setFormData(data)}
                readOnly={readOnly || !canEdit}
            />

        </div>
    );
};
