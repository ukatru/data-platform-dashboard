import React, { useState, useEffect } from 'react';
import { api, TableMetadata } from '../../services/api';
import { DynamicTable } from '../../components/DynamicTable';
import { Shield, Users, Plus, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export const VariablesPage: React.FC = () => {
    const { currentTeamId, user } = useAuth();
    const [teamMetadata, setTeamMetadata] = useState<TableMetadata | null>(null);
    const [orgMetadata, setOrgMetadata] = useState<TableMetadata | null>(null);
    const [teamVars, setTeamVars] = useState<any[]>([]);
    const [orgVars, setOrgVars] = useState<any[]>([]);

    const isPlatformAdmin = user?.permissions.includes('PLATFORM_ADMIN');
    const canManageGlobal = isPlatformAdmin;
    const canManageTeam = user?.permissions.includes('CAN_EDIT_PIPELINES') || isPlatformAdmin;

    const [activeTab, setActiveTab] = useState<'team' | 'org'>('team');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newVar, setNewVar] = useState({ var_nm: '', var_value: '', description: '' });
    const [editingVar, setEditingVar] = useState<any | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Default to Global Variables for Platform Admins in the "All Teams" view
    useEffect(() => {
        if (isPlatformAdmin && !currentTeamId) {
            setActiveTab('org');
        } else if (currentTeamId) {
            setActiveTab('team');
        }
    }, [isPlatformAdmin, currentTeamId]);

    useEffect(() => {
        const fetchMetadata = async () => {
            try {
                const teamMeta = await api.metadata.teamVariables();
                setTeamMetadata(teamMeta.data);

                const orgMeta = await api.metadata.orgVariables();
                setOrgMetadata(orgMeta.data);
            } catch (err) {
                console.error('Failed to fetch variables metadata', err);
            }
        };
        fetchMetadata();
    }, [isPlatformAdmin]);

    const fetchVars = async () => {
        try {
            const teamRes = await api.management.listTeamVariables();
            setTeamVars(teamRes.data);

            const orgRes = await api.management.listOrgVariables();
            setOrgVars(orgRes.data);
        } catch (err) {
            console.error('Failed to fetch variables', err);
        }
    };

    useEffect(() => {
        fetchVars();
    }, [isPlatformAdmin, currentTeamId]);

    const handleSave = async () => {
        if (!newVar.var_nm || !newVar.var_value) return;
        setSaving(true);
        setError(null);
        try {
            if (editingVar) {
                if (activeTab === 'team') {
                    await api.management.patchTeamVariable(editingVar.id, { var_value: newVar.var_value, description: newVar.description });
                } else {
                    await api.management.patchOrgVariable(editingVar.id, { var_value: newVar.var_value, description: newVar.description });
                }
            } else {
                if (activeTab === 'team') {
                    await api.management.createTeamVariable({ ...newVar, team_id: currentTeamId });
                } else {
                    await api.management.createOrgVariable({ ...newVar, org_id: user?.org_id });
                }
            }
            await fetchVars();
            closeModal();
        } catch (err: any) {
            setError(err.response?.data?.detail || "Failed to save variable");
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (row: any) => {
        setEditingVar(row);
        setNewVar({ var_nm: row.var_nm, var_value: row.var_value || '', description: row.description || '' });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingVar(null);
        setNewVar({ var_nm: '', var_value: '', description: '' });
        setError(null);
    };

    const handleDelete = async (row: any) => {
        if (!window.confirm(`Delete variable ${row.var_nm}?`)) return;
        try {
            if (activeTab === 'team') {
                await api.management.deleteTeamVariable(row.id);
            } else {
                await api.management.deleteOrgVariable(row.id);
            }
            await fetchVars();
        } catch (err) {
            alert("Failed to delete variable");
        }
    };

    if (!teamMetadata) return <div style={{ padding: '2rem' }}>Loading Variables System...</div>;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Variables</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Manage configuration settings and environment variables
                    </p>
                </div>
                {((activeTab === 'team' && canManageTeam) || (activeTab === 'org' && canManageGlobal)) && (
                    <button
                        className="btn-primary"
                        onClick={() => { closeModal(); setIsModalOpen(true); }}
                        disabled={activeTab === 'team' && !currentTeamId}
                        title={activeTab === 'team' && !currentTeamId ? "Please select a team in the sidebar first" : ""}
                    >
                        <Plus size={18} style={{ marginRight: '0.5rem' }} />
                        Add {activeTab === 'team' ? 'Team' : 'Global'} Variable
                    </button>
                )}
            </div>

            {activeTab === 'team' && !currentTeamId && !isPlatformAdmin && (
                <div style={{
                    padding: '1rem',
                    background: 'rgba(99, 102, 241, 0.1)',
                    border: '1px solid var(--accent-primary)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '1.5rem',
                    color: 'var(--text-secondary)',
                    fontSize: '0.9rem'
                }}>
                    <strong>Notice:</strong> You are currently in the <strong>All Teams</strong> view. To create or manage team-specific variables, please select a specific team from the workspace selector in the bottom-left corner of the sidebar.
                </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--glass-border)' }}>
                <button
                    onClick={() => setActiveTab('team')}
                    style={{
                        padding: '1rem',
                        background: 'none',
                        border: 'none',
                        color: activeTab === 'team' ? 'var(--primary)' : 'var(--text-secondary)',
                        borderBottom: activeTab === 'team' ? '2px solid var(--primary)' : 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    <Users size={18} />
                    Team Variables
                </button>
                <button
                    onClick={() => setActiveTab('org')}
                    style={{
                        padding: '1rem',
                        background: 'none',
                        border: 'none',
                        color: activeTab === 'org' ? 'var(--primary)' : 'var(--text-secondary)',
                        borderBottom: activeTab === 'org' ? '2px solid var(--primary)' : 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    <Shield size={18} />
                    Global Variables {!isPlatformAdmin && '(Read-Only)'}
                </button>
            </div>

            <div className="glass" style={{ padding: '0' }}>
                <DynamicTable
                    metadata={(activeTab === 'team' ? teamMetadata : orgMetadata)?.columns || []}
                    data={(activeTab === 'team' ? teamVars : orgVars).map(v => ({
                        ...v,
                        _readonly: activeTab === 'org' ? !canManageGlobal : !canManageTeam
                    }))}
                    primaryKey="id"
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    emptyMessage={`No ${activeTab === 'team' ? 'team' : 'global'} variables found.`}
                />
            </div>

            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content glass" style={{ maxWidth: '500px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                            <h2>{editingVar ? 'Edit' : 'Add'} {activeTab === 'team' ? 'Team' : 'Global'} Variable</h2>
                            <button onClick={closeModal} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                <X size={24} />
                            </button>
                        </div>

                        {error && (
                            <div style={{ padding: '1rem', background: 'rgba(255, 100, 100, 0.1)', color: 'var(--status-error)', borderRadius: '4px', marginBottom: '1rem' }}>
                                {error}
                            </div>
                        )}

                        <div className="form-group">
                            <label>Variable Name</label>
                            <input
                                type="text"
                                placeholder="E.g. DEFAULT_RETRIES"
                                value={newVar.var_nm}
                                onChange={(e) => setNewVar({ ...newVar, var_nm: e.target.value.toUpperCase() })}
                                disabled={!!editingVar}
                                style={editingVar ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                            />
                            {!editingVar && (
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                    Use uppercase with underscores.
                                </p>
                            )}
                        </div>

                        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                            <label>Value</label>
                            <textarea
                                placeholder="Variable value..."
                                value={newVar.var_value}
                                onChange={(e) => setNewVar({ ...newVar, var_value: e.target.value })}
                                style={{ minHeight: '100px' }}
                            />
                        </div>

                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label>Description</label>
                            <input
                                type="text"
                                placeholder="Briefly describe the purpose of this variable..."
                                value={newVar.description}
                                onChange={(e) => setNewVar({ ...newVar, description: e.target.value })}
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                            <button className="btn-secondary" onClick={closeModal}>Cancel</button>
                            <button className="btn-primary" onClick={handleSave} disabled={saving}>
                                {saving ? 'Saving...' : editingVar ? 'Update Variable' : 'Add Variable'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
