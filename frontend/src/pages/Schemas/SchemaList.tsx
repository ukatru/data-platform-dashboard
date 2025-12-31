import React, { useState, useEffect } from 'react';
import { api, TableMetadata } from '../../services/api';
import { Plus, X } from 'lucide-react';
import { RoleGuard } from '../../components/RoleGuard';
import { useAuth } from '../../contexts/AuthContext';
import { DynamicTable } from '../../components/DynamicTable';

export const SchemaList: React.FC = () => {
    const { currentTeamId } = useAuth();
    const [metadata, setMetadata] = useState<TableMetadata | null>(null);
    const [schemas, setSchemas] = useState<any[]>([]);
    const [codeLocations, setCodeLocations] = useState<any[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [viewingSchema, setViewingSchema] = useState<any>(null);
    const [formData, setFormData] = useState({
        job_nm: '',
        description: '',
        code_location_id: '' as string | number,
        json_schema: '{\n  "type": "object",\n  "properties": {\n    \n  }\n}',
    });

    useEffect(() => {
        const fetchReferenceData = async () => {
            try {
                const [metaRes, locsRes] = await Promise.all([
                    api.metadata.schemas(),
                    api.management.listCodeLocations()
                ]);
                setMetadata(metaRes.data);
                setCodeLocations(locsRes.data);
            } catch (err) {
                console.error('Failed to fetch reference data', err);
            }
        };
        fetchReferenceData();
    }, [currentTeamId]);

    const fetchSchemas = async () => {
        try {
            const res = await api.schemas.list();
            setSchemas(res.data);
        } catch (err) {
            console.error('Failed to fetch schemas', err);
        }
    };

    useEffect(() => {
        fetchSchemas();
    }, [currentTeamId]);

    const handleCreate = () => {
        setFormData({
            job_nm: '',
            description: '',
            code_location_id: codeLocations[0]?.id || '',
            json_schema: '{\n  "type": "object",\n  "properties": {\n    \n  }\n}',
        });
        setShowModal(true);
    };

    const handleView = (schema: any) => {
        setViewingSchema(schema);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const parsedSchema = JSON.parse(formData.json_schema);
            await api.schemas.create({
                job_nm: formData.job_nm,
                description: formData.description,
                code_location_id: formData.code_location_id,
                json_schema: parsedSchema,
            });
            setShowModal(false);
            fetchSchemas();
        } catch (err: any) {
            if (err instanceof SyntaxError) {
                alert('Invalid JSON schema. Please check your syntax.');
            } else {
                alert(`Failed to save schema: ${err.response?.data?.detail || err.message}`);
            }
        }
    };

    if (!metadata) {
        return <div>Loading metadata...</div>;
    }

    // Add view action to metadata
    const enhancedMetadata = {
        ...metadata,
        columns: metadata.columns.map(col => ({
            ...col,
            visible: col.name !== 'json_schema' ? col.visible : false
        }))
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Schemas</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Manage JSON Schema registry for parameter validation</p>
                </div>
                <RoleGuard requiredRole="DPE_DEVELOPER">
                    <button className="btn-primary" onClick={handleCreate} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Plus size={20} /> Register Schema
                    </button>
                </RoleGuard>
            </div>

            <DynamicTable
                metadata={enhancedMetadata.columns}
                data={schemas}
                onLinkClick={handleView}
                linkColumn="job_nm"
                primaryKey="id"
                editRole="DPE_DEVELOPER"
                emptyMessage="No schemas found for this team."
            />

            {showModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="glass" style={{ width: '600px', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                            <h3>Register New Schema</h3>
                            <button onClick={() => setShowModal(false)}><X /></button>
                        </div>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                    Job Name *
                                </label>
                                <input
                                    required
                                    value={formData.job_nm}
                                    onChange={(e) => setFormData({ ...formData, job_nm: e.target.value })}
                                    placeholder="e.g. sales_daily_load"
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                    Repository (Code Location) *
                                </label>
                                <select
                                    required
                                    value={formData.code_location_id}
                                    onChange={(e) => setFormData({ ...formData, code_location_id: parseInt(e.target.value) })}
                                >
                                    <option value="">Select Repository...</option>
                                    {codeLocations.map(loc => (
                                        <option key={loc.id} value={loc.id}>
                                            {loc.location_nm}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                    Description
                                </label>
                                <input
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Brief description of this schema"
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                    JSON Schema *
                                </label>
                                <textarea
                                    required
                                    value={formData.json_schema}
                                    onChange={(e) => setFormData({ ...formData, json_schema: e.target.value })}
                                    style={{
                                        fontFamily: 'monospace',
                                        minHeight: '300px',
                                        fontSize: '0.85rem'
                                    }}
                                    placeholder='{"type": "object", "properties": {...}}'
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                                    Register
                                </button>
                                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {viewingSchema && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="glass" style={{ width: '700px', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                            <h3>{viewingSchema.job_nm}</h3>
                            <button onClick={() => setViewingSchema(null)}><X /></button>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Description</div>
                            <div>{viewingSchema.description || 'No description'}</div>
                        </div>

                        <div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Schema</div>
                            <pre style={{
                                background: 'var(--bg-primary)',
                                padding: '1rem',
                                borderRadius: 'var(--radius-md)',
                                overflow: 'auto',
                                fontSize: '0.85rem',
                                color: '#818cf8'
                            }}>
                                {JSON.stringify(viewingSchema.json_schema, null, 2)}
                            </pre>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
