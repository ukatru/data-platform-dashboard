import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { GitBranch, Plus, X, Globe, Shield } from 'lucide-react';

export const CodeLocationManagement: React.FC = () => {
    const [locations, setLocations] = useState<any[]>([]);
    const [teams, setTeams] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        location_nm: '',
        repo_url: '',
        team_id: 0
    });

    const { currentOrg } = useAuth();

    const fetchData = async () => {
        setLoading(true);
        try {
            const [locsRes, teamsRes] = await Promise.all([
                api.management.listCodeLocations(),
                api.management.listTeams()
            ]);
            setLocations(locsRes.data);
            setTeams(teamsRes.data);
            if (teamsRes.data.length > 0) {
                setFormData(prev => ({ ...prev, team_id: teamsRes.data[0].id }));
            }
        } catch (err) {
            console.error('Failed to fetch data', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.management.registerCodeLocation(formData);
            setShowModal(false);
            setFormData({ ...formData, location_nm: '', repo_url: '' });
            fetchData();
        } catch (err: any) {
            const errorData = err.response?.data?.detail;
            let errorMessage = '';

            if (Array.isArray(errorData)) {
                errorMessage = errorData.map(e => `${e.loc.join('.')}: ${e.msg}`).join(', ');
            } else if (typeof errorData === 'string') {
                errorMessage = errorData;
            } else {
                errorMessage = err.message;
            }

            alert(`Error: ${errorMessage}`);
        }
    };

    if (loading && locations.length === 0) {
        return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading repositories...</div>;
    }

    return (
        <div className="admin-page">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>Code Locations</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Register and manage Dagster repositories for <strong>{currentOrg?.org_nm}</strong>
                    </p>
                </div>
                <button className="btn-primary" onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Plus size={20} /> Register Repository
                </button>
            </div>

            <div className="glass" style={{ overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--glass-border)' }}>
                            <th style={{ padding: '1.25rem' }}>Repository</th>
                            <th style={{ padding: '1.25rem' }}>Team Owner</th>
                            <th style={{ padding: '1.25rem' }}>URL</th>
                            <th style={{ padding: '1.25rem' }}>Created</th>
                            <th style={{ padding: '1.25rem' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {locations.map(loc => (
                            <tr key={loc.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                <td style={{ padding: '1.25rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <div style={{ color: 'var(--accent-primary)' }}><GitBranch size={20} /></div>
                                        <div style={{ fontWeight: 600 }}>{loc.location_nm}</div>
                                    </div>
                                </td>
                                <td style={{ padding: '1.25rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Shield size={14} color="var(--text-tertiary)" />
                                        <span>{loc.team?.team_nm || 'Unassigned'}</span>
                                    </div>
                                </td>
                                <td style={{ padding: '1.25rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                        <Globe size={14} />
                                        <span style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {loc.repo_url}
                                        </span>
                                    </div>
                                </td>
                                <td style={{ padding: '1.25rem', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                                    {loc.creat_dttm ? new Date(loc.creat_dttm).toLocaleDateString() : 'N/A'}
                                </td>
                                <td style={{ padding: '1.25rem' }}>
                                    <button
                                        className="btn-secondary"
                                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                                        onClick={() => alert('Repository synchronization logs and Dagster deployment details will be integrated in Phase 4: Metadata Factory Integration.')}
                                    >
                                        Details
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="glass" style={{ width: '500px', padding: '2.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Register Repository</h3>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X /></button>
                        </div>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div className="form-group">
                                <label>Location Name (Unique within team)</label>
                                <input
                                    required
                                    value={formData.location_nm}
                                    onChange={e => setFormData({ ...formData, location_nm: e.target.value })}
                                    placeholder="e.g. core-pipelines-repo"
                                />
                            </div>

                            <div className="form-group">
                                <label>Repository URL / Source</label>
                                <input
                                    required
                                    value={formData.repo_url}
                                    onChange={e => setFormData({ ...formData, repo_url: e.target.value })}
                                    placeholder="e.g. https://github.com/org/repo"
                                />
                            </div>

                            <div className="form-group">
                                <label>Owning Team</label>
                                <select
                                    required
                                    value={formData.team_id}
                                    onChange={e => setFormData({ ...formData, team_id: parseInt(e.target.value) })}
                                    style={{
                                        background: 'rgba(0,0,0,0.2)',
                                        border: '1px solid var(--glass-border)',
                                        borderRadius: '8px',
                                        padding: '0.75rem',
                                        color: 'white'
                                    }}
                                >
                                    {teams.map(t => (
                                        <option key={t.id} value={t.id}>{t.team_nm}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                                <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                                    Register
                                </button>
                                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary" style={{ flex: 1 }}>
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
