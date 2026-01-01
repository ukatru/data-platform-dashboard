import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { GenericSchemaForm } from './GenericSchemaForm';
import { useAuth } from '../contexts/AuthContext';

interface DynamicFormRendererProps {
    pipelineId: number;
    onSubmit?: (params: any) => void;
    readOnly?: boolean;
}

/**
 * Core component that renders forms dynamically from JSON Schema for Pipelines.
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

                // Fetch JSON Schema
                const schemaRes = await api.pipelines.getSchema(pipelineId);
                setSchema(schemaRes.data.json_schema);

                // Fetch current parameter values
                try {
                    const paramsRes = await api.pipelines.getParams(pipelineId);
                    setFormData(paramsRes.data.config_json);
                } catch (err) {
                    // No params yet, use empty object
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
            await api.pipelines.updateParams(pipelineId, data);
            if (onSubmit) onSubmit(data);
            alert('Parameters updated successfully!');
        } catch (err: any) {
            alert(`Failed to update parameters: ${err.response?.data?.detail || err.message}`);
        }
    };

    if (loading) {
        return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading schema...</div>;
    }

    if (error) {
        return (
            <div style={{ padding: '2rem', color: 'var(--error)' }}>
                Error: {error}
            </div>
        );
    }

    if (!schema) {
        return (
            <div style={{ padding: '2rem', color: 'var(--text-secondary)' }}>
                No schema defined for this pipeline
            </div>
        );
    }

    return (
        <GenericSchemaForm
            schema={schema}
            formData={formData}
            onSubmit={handleSubmit}
            onChange={(data: any) => setFormData(data)}
            readOnly={readOnly || !canEdit}
        />
    );
};
