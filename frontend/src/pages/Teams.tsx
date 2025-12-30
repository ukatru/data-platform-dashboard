import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Users, Plus, X, Info } from 'lucide-react';

export const TeamManagement: React.FC = () => {
    const [teams, setTeams] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        team_nm: '',
        description: ''
    });
    const [selectedTeam, setSelectedTeam] = useState<any | null>(null);
    const [teamMembers, setTeamMembers] = useState<any[]>([]);
    const [availableUsers, setAvailableUsers] = useState<any[]>([]);
    const [availableRoles, setAvailableRoles] = useState<any[]>([]);
    const [memberLoading, setMemberLoading] = useState(false);
    const [showMemberModal, setShowMemberModal] = useState(false);
    const [newMemberData, setNewMemberData] = useState({ user_id: '', role_id: '' });

    const { currentOrg } = useAuth();

    const fetchTeams = async () => {
        setLoading(true);
        try {
            const res = await api.management.listTeams();
            setTeams(res.data);
        } catch (err) {
            console.error('Failed to fetch teams', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchAllData = async () => {
        try {
            const [usersRes, rolesRes] = await Promise.all([
                api.users.list(),
                api.users.listRoles()
            ]);
            setAvailableUsers(usersRes.data);
            setAvailableRoles(rolesRes.data);
        } catch (err) {
            console.error('Failed to fetch users/roles', err);
        }
    };

    useEffect(() => {
        fetchTeams();
        fetchAllData();
    }, []);

    const fetchTeamMembers = async (teamId: number) => {
        setMemberLoading(true);
        try {
            const res = await api.management.listTeamMembers(teamId);
            setTeamMembers(res.data);
        } catch (err) {
            console.error('Failed to fetch team members', err);
        } finally {
            setMemberLoading(false);
        }
    };

    const handleManageTeam = (team: any) => {
        setSelectedTeam(team);
        setNewMemberData({ user_id: '', role_id: '' });
        fetchTeamMembers(team.id);
        setShowMemberModal(true);
    };

    const handleAddMember = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTeam) return;
        try {
            await api.management.addTeamMember(selectedTeam.id, {
                user_id: parseInt(newMemberData.user_id),
                team_id: selectedTeam.id,
                role_id: parseInt(newMemberData.role_id)
            });
            setNewMemberData({ user_id: '', role_id: '' });
            fetchTeamMembers(selectedTeam.id);
        } catch (err: any) {
            alert(`Error: ${err.response?.data?.detail || err.message}`);
        }
    };

    const handleRemoveMember = async (userId: number) => {
        if (!selectedTeam || !window.confirm('Are you sure you want to remove this member?')) return;
        try {
            await api.management.removeTeamMember(selectedTeam.id, userId);
            fetchTeamMembers(selectedTeam.id);
        } catch (err: any) {
            alert(`Error: ${err.response?.data?.detail || err.message}`);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.management.createTeam({
                ...formData,
                org_id: currentOrg?.id
            });
            setShowModal(false);
            setFormData({ team_nm: '', description: '' });
            fetchTeams();
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

    if (loading && teams.length === 0) {
        return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading teams...</div>;
    }

    // Filter roles for the selected team or global roles
    const teamSpecificRoles = availableRoles.filter(r => r.team_id === selectedTeam?.id);

    return (
        <div className="admin-page">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>Team Management</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Define organizational units within <strong>{currentOrg?.org_nm}</strong>
                    </p>
                </div>
                <button className="btn-primary" onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Plus size={20} /> Create Team
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
                {teams.map(team => (
                    <div key={team.id} className="glass" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{
                                width: 48,
                                height: 48,
                                borderRadius: '12px',
                                background: 'rgba(99, 102, 241, 0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--accent-primary)'
                            }}>
                                <Users size={24} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{team.team_nm}</h3>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                                    Team ID: {team.id}
                                </div>
                            </div>
                        </div>

                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', minHeight: '3em' }}>
                            {team.description || 'No description provided.'}
                        </p>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid var(--glass-border)' }}>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                                Created: {team.creat_dttm ? new Date(team.creat_dttm).toLocaleDateString() : 'N/A'}
                            </div>
                            <button
                                className="btn-secondary"
                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                                onClick={() => handleManageTeam(team)}
                            >
                                Manage Members
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Create Team Modal */}
            {showModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="glass" style={{ width: '450px', padding: '2.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 700 }}>New Team</h3>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X /></button>
                        </div>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div className="form-group">
                                <label>Team Name</label>
                                <input
                                    required
                                    value={formData.team_nm}
                                    onChange={e => setFormData({ ...formData, team_nm: e.target.value })}
                                    placeholder="e.g. Marketplace, Core Services"
                                />
                            </div>

                            <div className="form-group">
                                <label>Description (Optional)</label>
                                <textarea
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Briefly describe the team's purpose..."
                                    style={{
                                        background: 'rgba(0,0,0,0.2)',
                                        border: '1px solid var(--glass-border)',
                                        borderRadius: '8px',
                                        padding: '0.75rem',
                                        color: 'white',
                                        minHeight: '100px',
                                        resize: 'vertical'
                                    }}
                                />
                            </div>

                            <div style={{ padding: '1rem', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '8px', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                                <Info size={18} color="var(--accent-primary)" style={{ marginTop: '0.2rem' }} />
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    Teams allow you to group related pipelines and manage repository access separately.
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                                    Create Team
                                </button>
                                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary" style={{ flex: 1 }}>
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Member Management Sidebar/Modal */}
            {showMemberModal && selectedTeam && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', justifyContent: 'flex-end' }}>
                    <div className="glass" style={{ width: '500px', height: '100%', padding: '2.5rem', borderRadius: 0, borderLeft: '1px solid var(--glass-border)', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                            <div>
                                <h3 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{selectedTeam.team_nm} Members</h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Assign users to granular roles</p>
                            </div>
                            <button onClick={() => setShowMemberModal(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X /></button>
                        </div>

                        {/* Add Member Form */}
                        <form onSubmit={handleAddMember} style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <h4 style={{ fontSize: '1rem', fontWeight: 600 }}>Add New Member</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="form-group">
                                    <label>User</label>
                                    <select
                                        required
                                        value={newMemberData.user_id}
                                        onChange={e => setNewMemberData({ ...newMemberData, user_id: e.target.value })}
                                        style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'white' }}
                                    >
                                        <option value="">Select User</option>
                                        {availableUsers.map(u => (
                                            <option key={u.id} value={u.id}>{u.full_nm} ({u.username})</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Role</label>
                                    <select
                                        required
                                        value={newMemberData.role_id}
                                        onChange={e => setNewMemberData({ ...newMemberData, role_id: e.target.value })}
                                        style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'white' }}
                                    >
                                        <option value="">Select Role</option>
                                        {teamSpecificRoles.map(r => (
                                            <option key={r.id} value={r.id}>{r.role_nm}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <button type="submit" className="btn-primary" style={{ marginTop: '0.5rem' }}>Add Member</button>
                        </form>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <h4 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                                Active Members
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{teamMembers.length} Total</span>
                            </h4>

                            {memberLoading ? (
                                <p style={{ textAlign: 'center', padding: '2rem' }}>Loading members...</p>
                            ) : teamMembers.length === 0 ? (
                                <div style={{ padding: '2rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed var(--glass-border)' }}>
                                    <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>No members assigned to this team yet.</p>
                                </div>
                            ) : (
                                teamMembers.map(member => (
                                    <div key={member.id} className="glass" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.03)' }}>
                                        <div style={{
                                            width: 40,
                                            height: 40,
                                            borderRadius: '50%',
                                            background: 'var(--accent-primary)',
                                            color: 'white',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontWeight: 700,
                                            fontSize: '0.9rem'
                                        }}>
                                            {member.user?.full_nm.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>{member.user?.full_nm}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{member.role?.role_nm}</div>
                                        </div>
                                        <button
                                            onClick={() => handleRemoveMember(member.user_id)}
                                            style={{ background: 'none', border: 'none', color: 'var(--status-failed)', cursor: 'pointer', padding: '0.5rem' }}
                                            title="Remove Member"
                                        >
                                            <X size={18} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
