import React, { useState, useEffect } from 'react';
import { api, TableMetadata } from '../services/api';
import { DynamicTable } from '../components/DynamicTable';
import { Plus, X } from 'lucide-react';
import { RoleGuard } from '../components/RoleGuard';
import { useAuth } from '../contexts/AuthContext';

export const CodeLocationManagement: React.FC = () => {
    const { currentTeamId } = useAuth();
    const [metadata, setMetadata] = useState<TableMetadata | null>(null);
    const [repositories, setRepositories] = useState<any[]>([]);
    const [teams, setTeams] = useState<any[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [editingRepo, setEditingRepo] = useState<any>(null);
    const [formData, setFormData] = useState({
        location_nm: '',
        repo_url: '',
        team_id: 0
    });
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');

    useEffect(() => {
        const fetchMetadata = async () => {
            try {
                const res = await api.metadata.repositories();
                setMetadata(res.data);
            } catch (err: any) {
                console.error('Failed to fetch metadata', err);
                if (err.response?.status === 403) {
                    setError("You do not have permission to view repositories.");
                } else {
                    setError("Failed to load repository metadata.");
                }
            }
        };
        fetchMetadata();
    }, []);

    const fetchRepositories = async () => {
        try {
            const res = await api.repositories.list();
            setRepositories(res.data);
        } catch (err) {
            console.error('Failed to fetch repositories', err);
        }
    };

    useEffect(() => {
        fetchRepositories();
    }, [currentTeamId]);

    const filteredRepositories = repositories.filter(repo =>
        repo.location_nm?.toLowerCase().includes(search.toLowerCase()) ||
        repo.repo_url?.toLowerCase().includes(search.toLowerCase())
    );

    useEffect(() => {
        const fetchTeams = async () => {
            try {
                const res = await api.management.listTeams();
                setTeams(res.data);
                if (res.data.length > 0 && !formData.team_id) {
                    setFormData(prev => ({ ...prev, team_id: res.data[0].id }));
                }
            } catch (err) {
                console.error('Failed to fetch teams', err);
            }
        };
        fetchTeams();
    }, []);

    const handleCreate = () => {
        setEditingRepo(null);
        setFormData({
            location_nm: '',
            repo_url: '',
            team_id: teams.length > 0 ? teams[0].id : 0
        });
        setShowModal(true);
    };

    const handleEdit = (repo: any) => {
        setEditingRepo(repo);
        setFormData({
            location_nm: repo.location_nm,
            repo_url: repo.repo_url || '',
            team_id: repo.team_id
        });
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingRepo) {
                await api.repositories.update(editingRepo.id, {
                    location_nm: formData.location_nm,
                    repo_url: formData.repo_url || null
                });
            } else {
                await api.repositories.create(formData);
            }
            setShowModal(false);
            fetchRepositories();
        } catch (err: any) {
            const errorData = err.response?.data?.detail;
            let errorMessage = '';

            if (Array.isArray(errorData)) {
                errorMessage = errorData.map((e: any) => `${e.loc.join('.')}: ${e.msg}`).join(', ');
            } else if (typeof errorData === 'string') {
                errorMessage = errorData;
            } else {
                errorMessage = err.message;
            }

            alert(`Error: ${errorMessage}`);
        }
    };

    const handleDelete = async (repo: any) => {
        if (!window.confirm(`Delete repository "${repo.location_nm}"? This cannot be undone.`)) {
            return;
        }

        try {
            await api.repositories.delete(repo.id);
            fetchRepositories();
        } catch (err: any) {
            const errorMessage = err.response?.data?.detail || err.message;
            alert(`Error deleting repository: ${errorMessage}`);
        }
    };

    if (error) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--error)' }}>
                {error}
            </div>
        );
    }

    if (!metadata) {
        return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
    }

    return (
        <div className="admin-page">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>Code Locations</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Register and manage Dagster repositories for Enterprise Data Services
                    </p>
                </div>
                <RoleGuard requiredPermission="CAN_EDIT_PIPELINES">
                    <button className="btn-primary" onClick={handleCreate} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Plus size={20} /> Register Repository
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
                        placeholder="Search repositories..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="premium-input"
                        style={{ padding: '0.6rem 2.5rem 0.6rem 1rem', width: '100%', fontSize: '0.9rem' }}
                    />
                </div>
            </div>

            <DynamicTable
                metadata={metadata.columns}
                data={filteredRepositories}
                primaryKey="id"
                onEdit={handleEdit}
                onDelete={handleDelete}
            />

            {showModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="glass" style={{ width: '500px', padding: '2.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                                {editingRepo ? 'Edit Repository' : 'Register Repository'}
                            </h3>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X /></button>
                        </div>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div className="form-group">
                                <label>Location Name (Unique within team)</label>
                                <input
                                    required
                                    value={formData.location_nm}
                                    onChange={e => setFormData({ ...formData, location_nm: e.target.value })}
                                    placeholder="e.g. example-pipelines"
                                />
                            </div>

                            <div className="form-group">
                                <label>Repository URL / Source</label>
                                <input
                                    value={formData.repo_url}
                                    onChange={e => setFormData({ ...formData, repo_url: e.target.value })}
                                    placeholder="e.g. https://github.com/org/repo"
                                />
                            </div>

                            {!editingRepo && (
                                <div className="form-group">
                                    <label>Owning Team</label>
                                    <select
                                        required
                                        value={formData.team_id}
                                        onChange={e => setFormData({ ...formData, team_id: parseInt(e.target.value) })}
                                    >
                                        {teams.map(t => (
                                            <option key={t.id} value={t.id}>{t.team_nm}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                                <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                                    {editingRepo ? 'Update' : 'Register'}
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
