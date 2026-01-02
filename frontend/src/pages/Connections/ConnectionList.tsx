import React, { useState, useEffect } from 'react';
import { api, TableMetadata } from '../../services/api';
import { DynamicTable } from '../../components/DynamicTable';
import { GenericSchemaForm } from '../../components/GenericSchemaForm';
import { Plus, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { RoleGuard } from '../../components/RoleGuard';
import { useAuth } from '../../contexts/AuthContext';

export const ConnectionList: React.FC = () => {
    const { hasPermission, currentTeamId } = useAuth();
    const canManage = hasPermission('CAN_MANAGE_CONNECTIONS');
    const canViewConfig = hasPermission('CAN_VIEW_CONFIG');
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
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        conn_nm: '',
        conn_type: '',
        config_json: {} as any
    });
    const [isVerified, setIsVerified] = useState(false);

    const [search, setSearch] = useState('');
    const [pageLimit, setPageLimit] = useState(25);
    const [pageOffset, setPageOffset] = useState(0);
    const [totalCount, setTotalCount] = useState(0);

    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setIsVerified(false);
    }, [formData.conn_nm, formData.conn_type, JSON.stringify(formData.config_json)]);

    useEffect(() => {
        const init = async () => {
            try {
                const metaRes = await api.metadata.connections();
                setMetadata(metaRes.data);

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
    }, [currentTeamId]);

    const fetchConnections = async () => {
        setLoading(true);
        try {
            const res = await api.connections.list(pageLimit, pageOffset, search);
            setConnections(res.data.items);
            setTotalCount(res.data.total_count);
        } catch (err) {
            console.error('Failed to fetch connections', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConnections();
    }, [currentTeamId, pageLimit, pageOffset, search]);

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
            const payload = { ...formData, config_json: configData };
            if (editingConn) {
                await api.connections.update(editingConn.id, payload);
            } else {
                await api.connections.create(payload);
            }
            setShowModal(false);
            fetchConnections();
        } catch (err: any) {
            alert(`Failed to save: ${err.response?.data?.detail || err.message}`);
        }
    };

    const handleDelete = async (row: any) => {
        if (!confirm(`Delete connection "${row.conn_nm}"?`)) return;
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
            setTestLogs(err.response?.data?.logs || [{ step: 'Error', status: 'error', message: err.message, timestamp: new Date().toISOString() }]);
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
            const payload = { ...formData, config_json: configData };
            const res = await api.connections.testRaw(payload);
            setTestLogs(res.data.logs || []);
            if (res.data.status === 'success') setIsVerified(true);
        } catch (err: any) {
            setTestLogs(err.response?.data?.logs || [{ step: 'Error', status: 'error', message: err.message, timestamp: new Date().toISOString() }]);
        } finally {
            setIsTesting(false);
        }
    };

    if (error) return <div style={{ padding: '4rem', textAlign: 'center' }}>{error}</div>;
    if (!metadata) return <div style={{ padding: '4rem', textAlign: 'center' }}>Initializing...</div>;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 800, background: 'linear-gradient(to right, #fff, rgba(255,255,255,0.5))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Connections</h1>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: '1.1rem' }}>Manage and monitor your data source ecosystem</p>
                </div>
                <RoleGuard requiredPermission="CAN_MANAGE_CONNECTIONS">
                    <button className="btn-primary" onClick={handleCreate} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                        <Plus size={18} /> New Connection
                    </button>
                </RoleGuard>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '2.5rem' }}>
                <div className="premium-search-container" style={{ position: 'relative', width: '400px' }}>
                    <X
                        size={18}
                        style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', opacity: search ? 1 : 0, transition: 'opacity 0.2s', zIndex: 10 }}
                        onClick={() => setSearch('')}
                    />
                    <input
                        type="text"
                        placeholder="Search connections..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPageOffset(0); }}
                        className="premium-input"
                        style={{ padding: '0.6rem 2.5rem 0.6rem 1rem', width: '100%', fontSize: '0.9rem' }}
                    />
                </div>
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
                emptyMessage="No connections found."
                totalCount={totalCount}
                limit={pageLimit}
                offset={pageOffset}
                onPageChange={setPageOffset}
                onLimitChange={(l) => { setPageLimit(l); setPageOffset(0); }}
                loading={loading}
            />

            {showModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="premium-glass" style={{ width: '640px', padding: '2.5rem', borderRadius: 'var(--radius-xl)', background: '#0f172a', maxHeight: '95vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{editingConn ? 'Edit Connection' : 'New Connection'}</h2>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}><X size={24} /></button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Connection Name *</label>
                                <input
                                    required
                                    className="premium-input"
                                    value={formData.conn_nm}
                                    onChange={(e) => setFormData({ ...formData, conn_nm: e.target.value })}
                                    placeholder="e.g. prod_postgres"
                                    style={{ padding: '0.8rem 1rem', width: '100%' }}
                                />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Connection Type *</label>
                                <select
                                    value={formData.conn_type || ""}
                                    onChange={(e) => handleTypeChange(e.target.value)}
                                    className="premium-input"
                                    style={{ padding: '0.8rem 1rem', width: '100%', cursor: 'pointer' }}
                                >
                                    <option value="">Select Type...</option>
                                    {connTypes.map(t => <option key={t.conn_type} value={t.conn_type}>{t.conn_type}</option>)}
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
                                            disabled={isTesting}
                                            className="btn-secondary"
                                            style={{ flex: 1, height: '48px', color: isVerified ? 'var(--success)' : 'inherit' }}
                                        >
                                            {isTesting ? 'Testing...' : isVerified ? 'Verified ✓' : 'Test Connection'}
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={!isVerified || !canManage}
                                            className="btn-primary"
                                            style={{ flex: 1, height: '48px', opacity: isVerified ? 1 : 0.5 }}
                                        >
                                            {editingConn ? 'Save' : 'Register'}
                                        </button>
                                    </div>
                                )}
                            />
                        ) : (
                            <div style={{ padding: '3rem', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '12px', color: 'var(--text-tertiary)' }}>
                                {formData.conn_type ? 'Loading schema...' : 'Select a connection type to configure details'}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {viewingConn && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="premium-glass" style={{ width: '600px', padding: '2.5rem', background: '#0f172a', borderRadius: 'var(--radius-xl)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Connection Details</h2>
                            <button onClick={() => setViewingConn(null)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}><X size={24} /></button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            <div className="glass" style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                <div><p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '0.25rem' }}>NAME</p><p style={{ fontWeight: 600 }}>{viewingConn.conn_nm}</p></div>
                                <div><p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '0.25rem' }}>TYPE</p><span className="badge">{viewingConn.conn_type}</span></div>
                            </div>
                            <div>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '1rem' }}>CONFIGURATION</p>
                                <pre className="glass" style={{ padding: '1.5rem', fontSize: '0.9rem', color: 'var(--accent-secondary)', overflowX: 'auto' }}>
                                    {canViewConfig ? JSON.stringify(viewingConn.config_json, (k, v) => ['pass', 'key', 'secret', 'token'].some(s => k.toLowerCase().includes(s)) ? '••••' : v, 2) : '[Redacted: Restricted Access]'}
                                </pre>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                {canManage && <button onClick={() => { setViewingConn(null); handleEdit(viewingConn); }} className="btn-primary">Edit</button>}
                                <button onClick={() => setViewingConn(null)} className="btn-secondary">Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showTestModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(12px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="premium-glass" style={{ width: '600px', padding: '2.5rem', background: '#000' }}>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Loader2 size={20} className={isTesting ? 'animate-spin' : ''} color="var(--accent-primary)" /> Connection Diagnostic
                        </h3>
                        <div className="terminal" style={{ minHeight: '300px', maxHeight: '500px', overflowY: 'auto' }}>
                            {testLogs?.map((log, idx) => (
                                <div key={idx} style={{ marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: log.status === 'error' ? 'var(--error)' : 'var(--success)' }}>
                                            {log.status === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />} {log.step}
                                        </div>
                                        <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>{new Date(log.timestamp).toLocaleTimeString()}</span>
                                    </div>
                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-tertiary)', paddingLeft: '1.5rem' }}>{log.message}</div>
                                </div>
                            ))}
                            {isTesting && <div style={{ color: 'var(--accent-primary)', fontSize: '0.9rem', animation: 'pulse 1.5s infinite', paddingLeft: '1.5rem' }}>Analyzing path...</div>}
                        </div>
                        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center' }}>
                            <button onClick={() => setShowTestModal(false)} className="btn-primary" disabled={isTesting} style={{ width: '120px' }}>Done</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
