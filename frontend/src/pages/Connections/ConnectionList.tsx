import React, { useState, useEffect } from 'react';
import { api, TableMetadata } from '../../services/api';
import { DynamicTable } from '../../components/DynamicTable';
import { GenericSchemaForm } from '../../components/GenericSchemaForm';
import { Plus, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { RoleGuard } from '../../components/RoleGuard';
import { useAuth } from '../../contexts/AuthContext';

export const ConnectionList: React.FC = () => {
    const { hasPermission } = useAuth();
    const canManage = hasPermission('CAN_MANAGE_CONNECTIONS');
    const [metadata, setMetadata] = useState<TableMetadata | null>(null);
    const [connections, setConnections] = useState<any[]>([]);
    const [connTypes, setConnTypes] = useState<any[]>([]);
    const [selectedTypeSchema, setSelectedTypeSchema] = useState<any>(null);
    const [showModal, setShowModal] = useState(false);
    const [editingConn, setEditingConn] = useState<any>(null);
    const [viewingConn, setViewingConn] = useState<any>(null);
    const [isTesting, setIsTesting] = useState(false);
    const [testLogs, setTestLogs] = useState<any[] | null>(null);
    const [showTestModal, setShowTestModal] = useState(false);

    const [formData, setFormData] = useState({
        conn_nm: '',
        conn_type: '',
        config_json: {} as any
    });
    const [isVerified, setIsVerified] = useState(false);

    // Reset verification when any field changes
    useEffect(() => {
        setIsVerified(false);
    }, [formData.conn_nm, formData.conn_type, JSON.stringify(formData.config_json)]);

    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const init = async () => {
            try {
                // Fetch table metadata
                const metaRes = await api.metadata.connections();
                setMetadata(metaRes.data);

                // Seed and fetch connection types
                try {
                    await api.connections.seed();
                } catch (e) {
                    console.warn('Seeding skipped or already done');
                }
                const typesRes = await api.connections.listTypes();
                setConnTypes(typesRes.data);
            } catch (err: any) {
                console.error('Initialization failed', err);
                if (err.response?.status === 403) {
                    setError("You do not have permission to manage connections.");
                } else {
                    setError("Failed to load connection metadata.");
                }
            }
        };
        init();
        fetchConnections();
    }, []);

    const fetchConnections = async () => {
        try {
            const res = await api.connections.list();
            setConnections(res.data);
        } catch (err) {
            console.error('Failed to fetch connections', err);
        }
    };

    const handleTypeChange = async (type: string) => {
        if (!type) {
            setFormData({ ...formData, conn_type: '', config_json: {} });
            setSelectedTypeSchema(null);
            return;
        }
        setFormData({ ...formData, conn_type: type, config_json: {} });
        setIsVerified(false);
        try {
            const res = await api.connections.getTypeSchema(type);
            setSelectedTypeSchema(res.data.json_schema);
        } catch (err) {
            console.error('Failed to fetch type schema', err);
            setSelectedTypeSchema(null);
        }
    };

    const handleCreate = () => {
        setEditingConn(null);
        setFormData({ conn_nm: '', conn_type: '', config_json: {} });
        setSelectedTypeSchema(null);
        setShowModal(true);
    };

    const handleEdit = async (conn: any) => {
        setEditingConn(conn);
        setFormData({
            conn_nm: conn.conn_nm,
            conn_type: conn.conn_type,
            config_json: conn.config_json || {}
        });

        // Ensure we have types list to populate dropdown
        if (connTypes.length === 0) {
            try {
                const typesRes = await api.connections.listTypes();
                setConnTypes(typesRes.data);
            } catch (err) {
                console.warn('Failed to refresh types during edit', err);
            }
        }

        try {
            const res = await api.connections.getTypeSchema(conn.conn_type);
            setSelectedTypeSchema(res.data.json_schema);
        } catch (err) {
            console.error('Failed to fetch type schema', err);
            setSelectedTypeSchema(null);
        }
        setShowModal(true);
    };

    const handleView = (conn: any) => {
        setViewingConn(conn);
    };

    const handleSubmit = async (configData: any) => {
        try {
            const payload = {
                ...formData,
                config_json: configData
            };

            if (editingConn) {
                await api.connections.update(editingConn.id, payload);
            } else {
                await api.connections.create(payload);
            }
            setShowModal(false);
            fetchConnections();
            alert(`Connection ${editingConn ? 'updated' : 'created'} successfully!`);
        } catch (err: any) {
            alert(`Failed to save connection: ${err.response?.data?.detail || err.message}`);
        }
    };

    const handleDelete = async (row: any) => {
        if (!confirm(`Delete connection "${row.conn_nm}"? This cannot be undone.`)) return;
        try {
            await api.connections.delete(row.id);
            fetchConnections();
        } catch (err: any) {
            alert(`Failed to delete: ${err.response?.data?.detail || err.message}`);
        }
    };

    const handleTest = async (row: any) => {
        setIsTesting(true);
        setIsVerified(false);
        setTestLogs([]);
        setShowTestModal(true);
        try {
            const res = await api.connections.test(row.id);
            setTestLogs(res.data.logs || []);
            if (res.data.status === 'success') setIsVerified(true);
        } catch (err: any) {
            setTestLogs(err.response?.data?.logs || [{
                step: 'Critical Error',
                status: 'error',
                message: err.response?.data?.detail || err.message,
                timestamp: new Date().toISOString()
            }]);
        } finally {
            setIsTesting(false);
        }
    };

    const handleStatelessTest = async (configData: any) => {
        setIsTesting(true);
        setIsVerified(false);
        setTestLogs([]);
        setShowTestModal(true);
        try {
            const payload = {
                ...formData,
                config_json: configData
            };
            const res = await api.connections.testRaw(payload);
            setTestLogs(res.data.logs || []);
            if (res.data.status === 'success') setIsVerified(true);
        } catch (err: any) {
            setTestLogs(err.response?.data?.logs || [{
                step: 'Critical Error',
                status: 'error',
                message: err.response?.data?.detail || err.message,
                timestamp: new Date().toISOString()
            }]);
        } finally {
            setIsTesting(false);
        }
    };

    if (error) {
        return (
            <div className="glass" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                {error}
            </div>
        );
    }

    if (!metadata) {
        return (
            <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <div style={{ marginBottom: '1rem', opacity: 0.5 }}>Initializing...</div>
            </div>
        );
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Connections</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Manage data source and target configurations</p>
                </div>
                <RoleGuard requiredPermission="CAN_MANAGE_CONNECTIONS">
                    <button className="btn-primary" onClick={handleCreate} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Plus size={20} /> New Connection
                    </button>
                </RoleGuard>
            </div>

            <DynamicTable
                metadata={metadata.columns}
                data={connections}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onTest={handleTest}
                editRole="DPE_PLATFORM_ADMIN"
                deleteRole="DPE_PLATFORM_ADMIN"
                testRole="DPE_PLATFORM_ADMIN"
                onLinkClick={handleView}
                linkColumn="conn_nm"
                primaryKey={metadata.primary_key}
                emptyMessage="No connections found for this team."
            />

            {/* Test Connection Action added via custom logic if DynamicTable supported it, 
                but let's just add it to the table if we can modify DynamicTable too.
                For now, let's just use the default actions and maybe add a Test button near them in a future step.
            */}

            {showModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="glass" style={{ width: '600px', padding: '2rem', maxHeight: '95vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                            <h3>{editingConn ? 'Edit Connection' : 'New Connection'}</h3>
                            <button onClick={() => setShowModal(false)}><X /></button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                    Connection Name *
                                </label>
                                <input
                                    required
                                    value={formData.conn_nm}
                                    onChange={(e) => setFormData({ ...formData, conn_nm: e.target.value })}
                                    placeholder="e.g. prod_postgres"
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                    Connection Type *
                                </label>
                                <select
                                    value={formData.conn_type || ""}
                                    onChange={(e) => handleTypeChange(e.target.value)}
                                    required
                                    disabled={!canManage}
                                    className="dark-select"
                                >
                                    <option value="">Select Type...</option>
                                    {connTypes.map(t => (
                                        <option key={t.conn_type} value={t.conn_type}>
                                            {t.conn_type}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {selectedTypeSchema ? (
                            <GenericSchemaForm
                                schema={selectedTypeSchema}
                                formData={formData.config_json}
                                onSubmit={handleSubmit}
                                readOnly={!canManage}
                                customActions={(configData) => (
                                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                                        <button
                                            type="button"
                                            onClick={() => handleStatelessTest(configData)}
                                            disabled={isTesting || !canManage}
                                            className="btn-secondary"
                                            style={{
                                                flex: 1,
                                                borderColor: isVerified ? 'var(--success)' : 'var(--accent-primary)',
                                                color: isVerified ? 'var(--success)' : 'var(--accent-primary)',
                                                display: canManage || isVerified ? 'flex' : 'none',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                        >
                                            {isTesting ? 'Testing...' : isVerified ? 'Verified ✓' : 'Test Connection'}
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isTesting || !isVerified || !canManage}
                                            className="btn-primary"
                                            style={{
                                                flex: 1,
                                                opacity: (!isVerified && !isTesting) || !isAdmin ? 0.5 : 1,
                                                cursor: (!isVerified && !isTesting) || !isAdmin ? 'not-allowed' : 'pointer',
                                                display: canManage ? 'block' : 'none'
                                            }}
                                        >
                                            {editingConn ? 'Update' : 'Register'}
                                        </button>
                                    </div>
                                )}
                            />
                        ) : formData.conn_type ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                Loading configuration schema...
                            </div>
                        ) : (
                            <div style={{ padding: '2rem', background: 'var(--glass-bg)', borderRadius: 'var(--radius-md)', textAlign: 'center', color: 'var(--text-secondary)', border: '1px dashed var(--glass-border)' }}>
                                Please select a connection type to configure details.
                            </div>
                        )}

                        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center' }}>
                            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary" style={{ width: '100px' }}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {viewingConn && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="glass" style={{ width: '600px', padding: '2rem', maxHeight: '95vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                            <h3 style={{ fontSize: '1.5rem' }}>Connection Details</h3>
                            <button onClick={() => setViewingConn(null)}><X /></button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Connection Information
                                </label>
                                <div className="glass" style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                    <div>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Name</p>
                                        <p style={{ fontWeight: 600 }}>{viewingConn.conn_nm}</p>
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Type</p>
                                        <span className="status-badge" style={{ background: 'var(--glass-bg)' }}>{viewingConn.conn_type}</span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Configuration JSON
                                </label>
                                <pre className="glass" style={{
                                    padding: '1.5rem',
                                    borderRadius: 'var(--radius-md)',
                                    fontSize: '0.9rem',
                                    overflowX: 'auto',
                                    background: 'rgba(0,0,0,0.2)',
                                    color: '#818cf8',
                                    border: '1px solid var(--glass-border)'
                                }}>
                                    {JSON.stringify(viewingConn.config_json, (key, value) => {
                                        if (['password', 'key', 'secret', 'token'].some(k => key.toLowerCase().includes(k))) {
                                            return '••••••••';
                                        }
                                        return value;
                                    }, 2)}
                                </pre>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                <button
                                    onClick={() => { setViewingConn(null); handleEdit(viewingConn); }}
                                    className="btn-primary"
                                    style={{ background: 'var(--accent-secondary)' }}
                                >
                                    Edit Configuration
                                </button>
                                <button onClick={() => setViewingConn(null)} className="btn-secondary">
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showTestModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="glass" style={{ width: '600px', padding: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ fontSize: '1.25rem' }}>Connection Diagnostic</h3>
                            {!isTesting && <button onClick={() => setShowTestModal(false)}><X /></button>}
                        </div>

                        <div className="terminal">
                            {testLogs && testLogs.length > 0 ? (
                                testLogs.map((log, idx) => (
                                    <div key={idx} className="log-step">
                                        <div className="log-header">
                                            {log.status === 'success' ? (
                                                <CheckCircle2 size={16} color="var(--success)" />
                                            ) : log.status === 'error' ? (
                                                <AlertCircle size={16} color="var(--error)" />
                                            ) : (
                                                <Loader2 size={16} className="animate-spin" color="var(--accent-primary)" />
                                            )}
                                            <span style={{ color: log.status === 'error' ? 'var(--error)' : 'inherit' }}>
                                                {log.step}
                                            </span>
                                            <span className="log-time">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                        </div>
                                        <div className="log-message">{log.message}</div>
                                    </div>
                                ))
                            ) : (
                                <div style={{ color: 'var(--text-tertiary)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Loader2 size={16} className="animate-spin" /> Initializing diagnostic trace...
                                </div>
                            )}
                            {isTesting && (
                                <div className="log-step" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '1rem', paddingTop: '1rem' }}>
                                    <div className="log-header">
                                        <Loader2 size={16} className="animate-spin" color="var(--accent-primary)" />
                                        <span style={{ color: 'var(--accent-primary)' }}>Analyzing network path...</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center' }}>
                            <button
                                onClick={() => setShowTestModal(false)}
                                className="btn-primary"
                                disabled={isTesting}
                                style={{ width: '120px' }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
