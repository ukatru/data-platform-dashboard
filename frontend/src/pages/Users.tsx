import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { UserPlus, Shield, X, Download, CheckSquare, Square, Info, Users as UsersIcon } from 'lucide-react';

export const UserManagement: React.FC = () => {
    const [users, setUsers] = useState<any[]>([]);
    const [roles, setRoles] = useState<any[]>([]);
    const [teams, setTeams] = useState<any[]>([]);
    const [managingTeam, setManagingTeam] = useState<any | null>(null);
    const [managingTeamTab, setManagingTeamTab] = useState<'members' | 'settings'>('members');
    const [teamCodeLocations, setTeamCodeLocations] = useState<any[]>([]);
    const [editingTeamData, setEditingTeamData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'teams'>('users');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState<any>(null);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        full_nm: '',
        email: '',
        role_id: 0,
        actv_ind: true
    });
    const [newMembership, setNewMembership] = useState({ user_id: '', team_id: '', role_id: '' });
    const [membershipLoading, setMembershipLoading] = useState(false);
    const [showPermissionsModal, setShowPermissionsModal] = useState<any>(null);
    const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
    const [createTeamData, setCreateTeamData] = useState({
        team_nm: '',
        description: '',
        initial_code_location: '',
        initial_admin_id: ''
    });
    const [creatingTeam, setCreatingTeam] = useState(false);

    const { user: currentUser } = useAuth();

    const fetchData = async () => {
        setLoading(true);
        try {
            const [usersRes, rolesRes, teamsRes] = await Promise.all([
                api.users.list(),
                api.users.listRoles(),
                api.management.listTeams()
            ]);
            setUsers(usersRes.data);
            setRoles(rolesRes.data);
            setTeams(teamsRes.data);
            if (rolesRes.data.length > 0 && !editingUser) {
                // Set default role to Viewer (the least privileged template)
                const viewerRole = rolesRes.data.find((r: any) => r.role_nm === 'Viewer' || r.role_nm === 'DPE_DATA_ANALYST');
                if (viewerRole) {
                    setFormData(prev => ({ ...prev, role_id: viewerRole.id }));
                }
            }
        } catch (err) {
            console.error('Failed to fetch user data', err);
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
            if (editingUser) {
                // Remove password if empty (don't update)
                const payload = { ...formData };
                if (!payload.password) delete (payload as any).password;
                await api.users.update(editingUser.id, payload);
            } else {
                await api.users.create(formData);
            }
            setShowModal(false);
            fetchData();
        } catch (err: any) {
            alert(`Error: ${err.response?.data?.detail || err.message}`);
        }
    };

    const handleEdit = (user: any) => {
        setEditingUser(user);
        setFormData({
            username: user.username,
            password: '',
            full_nm: user.full_nm,
            email: user.email || '',
            role_id: user.role?.id || user.role_id,
            actv_ind: user.actv_ind
        });
        setShowModal(true);
    };

    const handleCreate = () => {
        setEditingUser(null);
        setNewMembership({ user_id: '', team_id: '', role_id: '' });
        const viewerRole = roles.find((r: any) => r.role_nm === 'Viewer' || r.role_nm === 'DPE_DATA_ANALYST');
        setFormData({
            username: '',
            password: '',
            full_nm: '',
            email: '',
            role_id: viewerRole?.id || roles[0]?.id || 0,
            actv_ind: true
        });
        setShowModal(true);
    };

    const handleAddMembership = async () => {
        if (!editingUser || !newMembership.team_id || !newMembership.role_id) return;
        setMembershipLoading(true);
        try {
            await api.management.addTeamMember(parseInt(newMembership.team_id), {
                user_id: editingUser.id,
                team_id: parseInt(newMembership.team_id),
                role_id: parseInt(newMembership.role_id)
            });
            setNewMembership({ user_id: '', team_id: '', role_id: '' });
            await fetchData();
            // Important: Update the editingUser reference to reflect new memberships in the modal
            const updatedUsers = await api.users.list();
            const refreshedEditingUser = updatedUsers.data.find((u: any) => u.id === editingUser.id);
            if (refreshedEditingUser) setEditingUser(refreshedEditingUser);
        } catch (err: any) {
            alert(`Error adding membership: ${err.response?.data?.detail || err.message}`);
        } finally {
            setMembershipLoading(false);
        }
    };

    const handleCreateTeam = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreatingTeam(true);
        try {
            await api.management.createTeam({
                ...createTeamData,
                initial_admin_id: createTeamData.initial_admin_id ? parseInt(createTeamData.initial_admin_id) : undefined
            } as any);
            setShowCreateTeamModal(false);
            setCreateTeamData({ team_nm: '', description: '', initial_code_location: '', initial_admin_id: '' });
            fetchData();
        } catch (err: any) {
            alert(`Error creating team: ${err.response?.data?.detail || err.message}`);
        } finally {
            setCreatingTeam(false);
        }
    };
    const handleRemoveMembership = async (teamId: number) => {
        if (!editingUser || !window.confirm('Remove user from this team?')) return;
        setMembershipLoading(true);
        try {
            await api.management.removeTeamMember(teamId, editingUser.id);
            await fetchData();
            // Important: Update the editingUser reference
            const updatedUsers = await api.users.list();
            const refreshedEditingUser = updatedUsers.data.find((u: any) => u.id === editingUser.id);
            if (refreshedEditingUser) setEditingUser(refreshedEditingUser);
        } catch (err: any) {
            alert(`Error removing membership: ${err.response?.data?.detail || err.message}`);
        } finally {
            setMembershipLoading(false);
        }
    };

    const exportToAccessMatrix = async () => {
        try {
            const response = await api.reports.accessMatrix();
            const data = response.data;

            const headers = ["Employee", "Username", "Email", "Scope Type", "Scope Name", "Assigned Role", "Effective Level"];
            const csvContent = [
                headers.join(','),
                ...data.map((r: any) => [
                    `"${r.Employee}"`,
                    `"${r.Username}"`,
                    `"${r.Email}"`,
                    `"${r['Scope Type']}"`,
                    `"${r['Scope Name']}"`,
                    `"${r['Assigned Role']}"`,
                    `"${r['Effective Level']}"`
                ].join(','))
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `access_matrix_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error('Export failed', err);
            alert('Failed to generate access matrix report');
        }
    };
    const handleBulkDeactivate = async () => {
        if (selectedUserIds.length === 0 || !window.confirm(`Deactivate ${selectedUserIds.length} users?`)) return;
        setLoading(true);
        try {
            await Promise.all(selectedUserIds.map(id => api.users.update(id, { actv_ind: false })));
            setSelectedUserIds([]);
            fetchData();
        } catch (err: any) {
            alert(`Bulk deactivation failed: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleBulkExport = () => {
        const selectedUsers = users.filter(u => selectedUserIds.includes(u.id));
        const headers = ['Name', 'Username', 'Email', 'Global Role', ...teams.map(t => t.team_nm)];
        const rows = selectedUsers.map(u => {
            const teamRoles = teams.map(t => {
                const membership = u.team_memberships?.find((tm: any) => tm.team_id === t.id);
                return membership ? membership.role?.role_nm.replace('DPE_', '') : '—';
            });
            return [u.full_nm, u.username, u.email || '', u.role?.role_nm.replace('DPE_', '') || '', ...teamRoles];
        });

        const csvContent = [headers.join(','), ...rows.map(r => r.map(cell => `"${cell}"`).join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.setAttribute('href', URL.createObjectURL(blob));
        link.setAttribute('download', `selected_users_${new Date().getTime()}.csv`);
        link.click();
    };

    const toggleUserSelection = (id: number) => {
        setSelectedUserIds(prev => prev.includes(id) ? prev.filter(uid => uid !== id) : [...prev, id]);
    };

    const filteredUsers = users.filter(u =>
        u.full_nm.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.team_memberships?.some((tm: any) => tm.team?.team_nm.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const filteredTeams = teams.filter(t =>
        t.team_nm.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleManageTeam = async (team: any) => {
        setManagingTeam(team);
        setManagingTeamTab('members');
        setEditingTeamData({ ...team });
        try {
            const locations = await api.management.listCodeLocations();
            setTeamCodeLocations(locations.data.filter((l: any) => l.team_id === team.id));
        } catch (err) {
            console.error('Failed to fetch team code locations', err);
        }
    };

    const handleUpdateTeam = async () => {
        if (!editingTeamData) return;
        setMembershipLoading(true);
        try {
            await api.management.patchTeam(editingTeamData.id, editingTeamData);
            await fetchData();
            setManagingTeam({ ...editingTeamData });
            alert('Team updated successfully');
        } catch (err: any) {
            alert(`Update failed: ${err.response?.data?.detail || err.message}`);
        } finally {
            setMembershipLoading(false);
        }
    };

    const handleDeleteTeam = async () => {
        if (!managingTeam || !window.confirm(`PERMANENTLY DELETE team "${managingTeam.team_nm}"? This will remove all members and code locations.`)) return;
        setMembershipLoading(true);
        try {
            await api.management.deleteTeam(managingTeam.id);
            setManagingTeam(null);
            await fetchData();
        } catch (err: any) {
            alert(`Deletion failed: ${err.response?.data?.detail || err.message}`);
        } finally {
            setMembershipLoading(false);
        }
    };

    const handleUpdateCodeLocation = async (locId: number, data: any) => {
        setMembershipLoading(true);
        try {
            await api.management.patchCodeLocation(locId, data);
            const locations = await api.management.listCodeLocations();
            setTeamCodeLocations(locations.data.filter((l: any) => l.team_id === managingTeam.id));
        } catch (err: any) {
            alert(`Update failed: ${err.response?.data?.detail || err.message}`);
        } finally {
            setMembershipLoading(false);
        }
    };

    const handleDeleteCodeLocation = async (locId: number) => {
        if (!window.confirm('Remove this code location?')) return;
        setMembershipLoading(true);
        try {
            await api.management.deleteCodeLocation(locId);
            const locations = await api.management.listCodeLocations();
            setTeamCodeLocations(locations.data.filter((l: any) => l.team_id === managingTeam.id));
        } catch (err: any) {
            alert(`Deletion failed: ${err.response?.data?.detail || err.message}`);
        } finally {
            setMembershipLoading(false);
        }
    };

    const filteredRoles = roles.filter(r =>
        r.role_nm.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    if (loading && users.length === 0) {
        return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading access hub...</div>;
    }

    return (
        <div className="admin-page">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>Access Management</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Centralized identity and permission control center</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    {activeTab === 'users' ? (
                        <>
                            <button className="btn-secondary" onClick={exportToAccessMatrix} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Download size={18} /> Export Access Matrix
                            </button>
                            <button className="btn-primary" onClick={handleCreate} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <UserPlus size={20} /> New Account
                            </button>
                        </>
                    ) : activeTab === 'teams' ? (
                        <button className="btn-primary" onClick={() => setShowCreateTeamModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <UsersIcon size={20} /> Create New Team
                        </button>
                    ) : null}
                </div>
            </div>

            {/* Hub Tabs */}
            <div style={{ display: 'flex', gap: '2rem', borderBottom: '1px solid var(--glass-border)', marginBottom: '2rem' }}>
                {(['users', 'roles', 'teams'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => { setActiveTab(tab); setSearchQuery(''); }}
                        style={{
                            background: 'none',
                            border: 'none',
                            padding: '1rem 0',
                            color: activeTab === tab ? 'var(--accent-primary)' : 'var(--text-secondary)',
                            fontWeight: 600,
                            fontSize: '1rem',
                            cursor: 'pointer',
                            position: 'relative',
                            textTransform: 'capitalize'
                        }}
                    >
                        {tab}
                        {activeTab === tab && (
                            <div style={{ position: 'absolute', bottom: -1, left: 0, right: 0, height: '2px', background: 'var(--accent-primary)' }} />
                        )}
                    </button>
                ))}
            </div>

            <div style={{ marginBottom: '2.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div className="premium-search-container" style={{ position: 'relative', width: '400px' }}>
                    <X
                        size={18}
                        style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', opacity: searchQuery ? 1 : 0, transition: 'opacity 0.2s', zIndex: 10 }}
                        onClick={() => setSearchQuery('')}
                    />
                    <input
                        type="text"
                        placeholder={activeTab === 'teams' ? "Search teams..." : "Filter by name or email..."}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="premium-input"
                        style={{ padding: '0.6rem 2.5rem 0.6rem 1rem', width: '100%', fontSize: '0.9rem' }}
                    />
                </div>
                {selectedUserIds.length > 0 && activeTab === 'users' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(99, 102, 241, 0.1)', padding: '0.5rem 1.5rem', borderRadius: '12px', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                        <span style={{ fontSize: '0.9rem', color: 'var(--accent-primary)', fontWeight: 600 }}>{selectedUserIds.length} Selected</span>
                        <select
                            className="dark-select"
                            style={{ padding: '0.4rem', border: 'none', background: 'none', color: 'white', fontSize: '0.9rem' }}
                            onChange={(e) => {
                                if (e.target.value === 'deactivate') handleBulkDeactivate();
                                if (e.target.value === 'export') handleBulkExport();
                                e.target.value = '';
                            }}
                        >
                            <option value="">Bulk Actions...</option>
                            <option value="deactivate">Deactivate Accounts</option>
                            <option value="export">Export Selected (CSV)</option>
                        </select>
                        <button onClick={() => setSelectedUserIds([])} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}><X size={16} /></button>
                    </div>
                )}
            </div>

            {activeTab === 'users' && (
                <div className="glass" style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1000px' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.02)' }}>
                                <th style={{ padding: '1.25rem' }}>
                                    <button
                                        onClick={() => setSelectedUserIds(selectedUserIds.length === filteredUsers.length ? [] : filteredUsers.map(u => u.id))}
                                        style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                                    >
                                        {selectedUserIds.length === filteredUsers.length && filteredUsers.length > 0 ? <CheckSquare size={20} color="var(--accent-primary)" /> : <Square size={20} />}
                                    </button>
                                </th>
                                <th style={{ padding: '1.25rem', minWidth: '250px' }}>Employee</th>
                                <th style={{ padding: '1.25rem' }}>Global Role</th>
                                {teams.map(t => (
                                    <th key={t.id} style={{ padding: '1.25rem', whiteSpace: 'nowrap', fontSize: '0.75rem', color: 'var(--text-tertiary)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        {t.team_nm}
                                    </th>
                                ))}
                                <th style={{ padding: '1.25rem', textAlign: 'right' }}>Management</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map(u => (
                                <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: selectedUserIds.includes(u.id) ? 'rgba(99, 102, 241, 0.05)' : 'transparent' }}>
                                    <td style={{ padding: '1.25rem' }}>
                                        <button
                                            onClick={() => toggleUserSelection(u.id)}
                                            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                                        >
                                            {selectedUserIds.includes(u.id) ? <CheckSquare size={20} color="var(--accent-primary)" /> : <Square size={20} />}
                                        </button>
                                    </td>
                                    <td style={{ padding: '1.25rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <div style={{
                                                width: 36,
                                                height: 36,
                                                borderRadius: '50%',
                                                background: u.actv_ind ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                                                opacity: 0.2,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '0.9rem',
                                                fontWeight: 700
                                            }}>
                                                {u.username[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{u.full_nm}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{u.email || `@${u.username}`}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '1.25rem' }}>
                                        <div className="status-badge" style={{ background: 'rgba(129, 140, 248, 0.1)', color: '#818cf8', padding: '0.2rem 0.6rem', fontSize: '0.7rem', fontWeight: 700, borderRadius: '6px', border: '1px solid rgba(129, 140, 248, 0.2)' }}>
                                            {(u.role?.role_nm || 'Developer').replace('DPE_', '').replace(/([A-Z])/g, ' $1').trim()}
                                        </div>
                                    </td>
                                    {teams.map(t => {
                                        const membership = u.team_memberships?.find((tm: any) => tm.team_id === t.id);
                                        return (
                                            <td key={t.id} style={{ padding: '1.25rem', textAlign: 'center' }}>
                                                {membership ? (
                                                    <span style={{
                                                        fontSize: '0.7rem',
                                                        fontWeight: 600,
                                                        color: 'var(--accent-secondary)',
                                                        padding: '0.25rem 0.5rem',
                                                        background: 'rgba(16, 185, 129, 0.05)',
                                                        borderRadius: '4px'
                                                    }}>
                                                        {membership.role?.role_nm.toUpperCase().includes('ADMIN') ? 'ADMIN' :
                                                            membership.role?.role_nm.replace('DPE_', '')}
                                                    </span>
                                                ) : (
                                                    <span style={{ color: 'var(--text-tertiary)', opacity: 0.3 }}>—</span>
                                                )}
                                            </td>
                                        );
                                    })}
                                    <td style={{ padding: '1.25rem', textAlign: 'right' }}>
                                        <button
                                            className="btn-secondary"
                                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                                            onClick={() => handleEdit(u)}
                                            disabled={u.username === currentUser?.username}
                                        >
                                            Edit
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === 'roles' && (
                <div className="glass" style={{ overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.02)' }}>
                                <th style={{ padding: '1.25rem' }}>Role Name</th>
                                <th style={{ padding: '1.25rem' }}>Scope</th>
                                <th style={{ padding: '1.25rem' }}>Description</th>
                                <th style={{ padding: '1.25rem' }}>Permissions</th>
                                <th style={{ padding: '1.25rem', textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRoles.map(role => (
                                <tr key={role.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                    <td style={{ padding: '1.25rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <div style={{ padding: '0.4rem', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '6px' }}>
                                                <Shield size={16} color="var(--accent-primary)" />
                                            </div>
                                            <span style={{ fontWeight: 600 }}>{role.role_nm.replace('DPE_', '').replace(/_/g, ' ')}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '1.25rem' }}>
                                        <span style={{
                                            fontSize: '0.7rem',
                                            background: role.team_id ? 'rgba(75, 85, 99, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                                            color: role.team_id ? 'var(--text-secondary)' : 'var(--accent-primary)',
                                            padding: '0.2rem 0.5rem',
                                            borderRadius: '4px',
                                            fontWeight: 600,
                                            textTransform: 'uppercase'
                                        }}>
                                            {role.team_id ? 'Team' : 'Global'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '1.25rem' }}>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {role.description || 'Standard platform access role.'}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1.25rem' }}>
                                        <button
                                            onClick={() => setShowPermissionsModal(role)}
                                            style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                                        >
                                            <Info size={14} /> View
                                        </button>
                                    </td>
                                    <td style={{ padding: '1.25rem', textAlign: 'right' }}>
                                        <button className="btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }} disabled>
                                            Edit
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === 'teams' && (
                <div className="glass" style={{ overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.02)' }}>
                                <th style={{ padding: '1.25rem' }}>Team Name</th>
                                <th style={{ padding: '1.25rem' }}>Members</th>
                                <th style={{ padding: '1.25rem', textAlign: 'center' }}>Admins</th>
                                <th style={{ padding: '1.25rem', textAlign: 'center' }}>Editors</th>
                                <th style={{ padding: '1.25rem', textAlign: 'center' }}>Viewers</th>
                                <th style={{ padding: '1.25rem', textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTeams.map(team => {
                                const teamMembers = users.filter(u => u.team_memberships?.some((tm: any) => tm.team_id === team.id));
                                return (
                                    <tr key={team.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                        <td style={{ padding: '1.25rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <div style={{ padding: '0.4rem', background: 'rgba(52, 211, 153, 0.1)', borderRadius: '6px' }}>
                                                    <UsersIcon size={16} color="#34d399" />
                                                </div>
                                                <span style={{ fontWeight: 600 }}>{team.team_nm}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '1.25rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                {teamMembers.slice(0, 4).map((m, i) => (
                                                    <div key={m.id} style={{
                                                        width: 24,
                                                        height: 24,
                                                        borderRadius: '50%',
                                                        background: 'var(--accent-primary)',
                                                        border: '2px solid var(--bg-primary)',
                                                        marginLeft: i > 0 ? -8 : 0,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '0.6rem',
                                                        fontWeight: 800
                                                    }}>
                                                        {m.username[0].toUpperCase()}
                                                    </div>
                                                ))}
                                                {teamMembers.length > 4 && (
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginLeft: '0.4rem' }}>+{teamMembers.length - 4}</div>
                                                )}
                                            </div>
                                        </td>
                                        {['TeamAdmin', 'Editor', 'Viewer'].map(roleType => (
                                            <td key={roleType} style={{ padding: '1.25rem', textAlign: 'center' }}>
                                                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                                                    {teamMembers.filter(m => m.team_memberships.some((tm: any) => tm.team_id === team.id && tm.role?.role_nm === roleType)).length}
                                                </span>
                                            </td>
                                        ))}
                                        <td style={{ padding: '1.25rem', textAlign: 'right' }}>
                                            <button
                                                className="btn-secondary"
                                                style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                                                onClick={() => handleManageTeam(team)}
                                            >
                                                Manage
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {showPermissionsModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="glass" style={{ width: '400px', padding: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ fontWeight: 700 }}>{showPermissionsModal.role_nm.replace('DPE_', '')} Permissions</h3>
                            <button onClick={() => setShowPermissionsModal(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X /></button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {['CAN_VIEW_LOGS', 'CAN_EXECUTE_PIPELINES', 'CAN_MANAGE_TEAMS', 'CAN_EDIT_CONNECTIONS'].filter(() => Math.random() > 0.3).map(p => (
                                <div key={p} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                                    <div style={{ width: 6, height: 6, background: 'var(--accent-primary)', borderRadius: '50%' }} />
                                    <code>{p}</code>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {showModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="glass" style={{ width: '800px', maxWidth: '90vw', maxHeight: '90vh', padding: '2.5rem', display: 'flex', gap: '2.5rem', overflowY: 'auto' }}>
                        <div style={{ flex: 1, minWidth: '350px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                                <h3 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{editingUser ? 'Account Profile' : 'New User account'}</h3>
                                {!editingUser && <button onClick={() => setShowModal(false)}><X /></button>}
                            </div>

                            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div className="form-group">
                                    <label>Full Name</label>
                                    <input
                                        required
                                        value={formData.full_nm}
                                        onChange={e => setFormData({ ...formData, full_nm: e.target.value })}
                                        placeholder="John Doe"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Username</label>
                                    <input
                                        required
                                        disabled={!!editingUser}
                                        value={formData.username}
                                        onChange={e => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                                        placeholder="jdoe"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Email Address</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="jdoe@example.com"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>{editingUser ? 'Reset Password (optional)' : 'Password'}</label>
                                    <input
                                        type="password"
                                        required={!editingUser}
                                        value={formData.password}
                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        placeholder="••••••••"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>System-Wide Role</label>
                                    <select
                                        value={formData.role_id}
                                        onChange={e => setFormData({ ...formData, role_id: parseInt(e.target.value) })}
                                    >
                                        {roles.map(r => (
                                            <option key={r.id} value={r.id}>{r.role_nm?.replace('DPE_', '') || r.role_nm}</option>
                                        ))}
                                    </select>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Account Status</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Toggle platform access</div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, actv_ind: !formData.actv_ind })}
                                        style={{
                                            width: '44px',
                                            height: '24px',
                                            borderRadius: '12px',
                                            background: formData.actv_ind ? 'var(--success)' : 'rgba(255,255,255,0.1)',
                                            position: 'relative',
                                            border: 'none',
                                            cursor: 'pointer',
                                            transition: 'all 0.3s'
                                        }}
                                    >
                                        <div style={{
                                            width: '18px',
                                            height: '18px',
                                            borderRadius: '50%',
                                            background: 'white',
                                            position: 'absolute',
                                            top: '3px',
                                            left: formData.actv_ind ? '23px' : '3px',
                                            transition: 'all 0.3s'
                                        }} />
                                    </button>
                                </div>

                                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                    <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                                        {editingUser ? 'Save Profile' : 'Create Account'}
                                    </button>
                                    <button type="button" onClick={() => setShowModal(false)} className="btn-secondary" style={{ flex: 1 }}>
                                        {editingUser ? 'Close' : 'Cancel'}
                                    </button>
                                </div>
                            </form>
                        </div>

                        {editingUser && (
                            <div style={{ flex: 1.2, borderLeft: '1px solid var(--glass-border)', paddingLeft: '2.5rem', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                                    <h3 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Team Access</h3>
                                    <button onClick={() => setShowModal(false)}><X /></button>
                                </div>

                                <div style={{ background: 'rgba(255,255,255,0.04)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--glass-border)', marginBottom: '2rem' }}>
                                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quick Team Assignment</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                                        <div className="form-group">
                                            <label style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>Target Team</label>
                                            <select
                                                value={newMembership.team_id}
                                                onChange={e => setNewMembership({ ...newMembership, team_id: e.target.value })}
                                                className="dark-select"
                                                style={{ fontSize: '0.85rem', padding: '0.6rem', width: '100%' }}
                                            >
                                                <option value="">Select Team...</option>
                                                {teams.filter(t => !editingUser.team_memberships?.some((tm: any) => tm.team_id === t.id)).map(t => (
                                                    <option key={t.id} value={t.id}>{t.team_nm}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>Team Role</label>
                                            <select
                                                value={newMembership.role_id}
                                                onChange={e => setNewMembership({ ...newMembership, role_id: e.target.value })}
                                                className="dark-select"
                                                style={{ fontSize: '0.85rem', padding: '0.6rem', width: '100%' }}
                                                disabled={!newMembership.team_id}
                                            >
                                                <option value="">Select Role...</option>
                                                {roles.filter(r => r.team_id === parseInt(newMembership.team_id) || r.team_id === null).map(r => (
                                                    <option key={r.id} value={r.id}>{r.role_nm.replace('DPE_', '').replace(/_/g, ' ')}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <button
                                        className="btn-primary"
                                        style={{ width: '100%', padding: '0.75rem', fontSize: '0.9rem', fontWeight: 600, borderRadius: '8px' }}
                                        onClick={handleAddMembership}
                                        disabled={!newMembership.team_id || !newMembership.role_id || membershipLoading}
                                    >
                                        {membershipLoading ? 'Assigning...' : 'Add Team Access'}
                                    </button>
                                </div>

                                <div style={{ flex: 1, overflowY: 'auto' }}>
                                    <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1rem' }}>Active Memberships</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {editingUser.team_memberships?.length > 0 ? editingUser.team_memberships.map((tm: any) => (
                                            <div key={tm.id} className="glass" style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(255,255,255,0.03)' }}>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{tm.team?.team_nm}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--accent-secondary)' }}>{tm.role?.role_nm.replace('DPE_', '').replace(/_/g, ' ')}</div>
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveMembership(tm.team_id)}
                                                    style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '0.3rem' }}
                                                    disabled={membershipLoading}
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        )) : (
                                            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)', fontSize: '0.85rem', border: '1px dashed var(--glass-border)', borderRadius: '12px' }}>
                                                User has no team-specific access.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Team Management Modal */}
            {showCreateTeamModal && (
                <div className="modal-overlay">
                    <div className="glass modal-content" style={{ maxWidth: '600px', width: '90%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Onboard New Team</h2>
                            <button onClick={() => setShowCreateTeamModal(false)} className="btn-icon"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleCreateTeam} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div className="form-group">
                                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Team Name</label>
                                <input
                                    required
                                    placeholder="e.g. Marketing Data"
                                    value={createTeamData.team_nm}
                                    onChange={e => setCreateTeamData({ ...createTeamData, team_nm: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Description</label>
                                <input
                                    placeholder="Brief purpose of the team..."
                                    value={createTeamData.description}
                                    onChange={e => setCreateTeamData({ ...createTeamData, description: e.target.value })}
                                />
                            </div>

                            <div style={{ padding: '1.25rem', background: 'rgba(52, 211, 153, 0.05)', borderRadius: '12px', border: '1px solid rgba(52, 211, 153, 0.1)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#34d399', fontWeight: 600, marginBottom: '1rem' }}>
                                    <Info size={16} /> Initial Onboarding (Optional)
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div className="form-group">
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Main Repository URL (Code Location)</label>
                                        <input
                                            placeholder="https://github.com/..."
                                            value={createTeamData.initial_code_location}
                                            onChange={e => setCreateTeamData({ ...createTeamData, initial_code_location: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                                <button type="button" onClick={() => setShowCreateTeamModal(false)} className="btn-secondary">Cancel</button>
                                <button type="submit" className="btn-primary" disabled={creatingTeam}>
                                    {creatingTeam ? 'Onboarding...' : 'Onboard Team'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {managingTeam && (
                <div className="modal-overlay" onClick={() => setManagingTeam(null)}>
                    <div className="glass modal-content" onClick={e => e.stopPropagation()} style={{ width: '800px', maxWidth: '90vw' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1.5rem' }}>
                            <div>
                                <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Manage {managingTeam.team_nm}</h2>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Team directory and configuration</p>
                            </div>
                            <button onClick={() => setManagingTeam(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X size={24} /></button>
                        </div>

                        {/* Modal Tabs */}
                        <div style={{ display: 'flex', gap: '2rem', borderBottom: '1px solid var(--glass-border)', marginBottom: '2rem' }}>
                            <button
                                onClick={() => setManagingTeamTab('members')}
                                style={{ background: 'none', border: 'none', padding: '1rem 0', color: managingTeamTab === 'members' ? 'var(--accent-primary)' : 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', borderBottom: managingTeamTab === 'members' ? '2px solid var(--accent-primary)' : 'none' }}>
                                Members
                            </button>
                            <button
                                onClick={() => setManagingTeamTab('settings')}
                                style={{ background: 'none', border: 'none', padding: '1rem 0', color: managingTeamTab === 'settings' ? 'var(--accent-primary)' : 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', borderBottom: managingTeamTab === 'settings' ? '2px solid var(--accent-primary)' : 'none' }}>
                                Settings
                            </button>
                        </div>

                        {managingTeamTab === 'members' ? (
                            <>
                                {/* Search & Add Section */}
                                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2.5rem', border: '1px solid var(--glass-border)' }}>
                                    <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-primary)', marginBottom: '1.25rem', fontWeight: 700 }}>Add New Member</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1rem', alignItems: 'flex-end' }}>
                                        <div className="form-group">
                                            <label style={{ fontSize: '0.75rem' }}>Select User</label>
                                            <select
                                                className="dark-select"
                                                style={{ fontSize: '0.85rem' }}
                                                value={newMembership.user_id}
                                                onChange={e => setNewMembership({ ...newMembership, user_id: e.target.value })}
                                            >
                                                <option value="">Search users...</option>
                                                {users.filter(u => !u.team_memberships?.some((tm: any) => tm.team_id === managingTeam.id)).map(u => (
                                                    <option key={u.id} value={u.id}>{u.full_nm} ({u.username})</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label style={{ fontSize: '0.75rem' }}>Assign Role</label>
                                            <select
                                                className="dark-select"
                                                style={{ fontSize: '0.85rem' }}
                                                value={newMembership.role_id}
                                                onChange={e => setNewMembership({ ...newMembership, role_id: e.target.value })}
                                            >
                                                <option value="">Select Role...</option>
                                                {roles.filter(r => r.team_id === null).map(r => (
                                                    <option key={r.id} value={r.id}>{r.role_nm.replace('DPE_', '').replace(/_/g, ' ')}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <button
                                            className="btn-primary"
                                            style={{ padding: '0.6rem 1.25rem', height: '42px' }}
                                            onClick={async () => {
                                                if (!newMembership.user_id || !newMembership.role_id) return;
                                                setMembershipLoading(true);
                                                try {
                                                    await api.management.addTeamMember(managingTeam.id, {
                                                        user_id: parseInt(newMembership.user_id),
                                                        team_id: managingTeam.id,
                                                        role_id: parseInt(newMembership.role_id)
                                                    });
                                                    setNewMembership({ ...newMembership, user_id: '', role_id: '' });
                                                    await fetchData();
                                                } finally {
                                                    setMembershipLoading(false);
                                                }
                                            }}
                                            disabled={!newMembership.user_id || !newMembership.role_id || membershipLoading}
                                        >
                                            Add Member
                                        </button>
                                    </div>
                                </div>

                                {/* Current Members List */}
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                        <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Current Members</h4>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.6rem', borderRadius: '4px' }}>
                                            {users.filter(u => u.team_memberships?.some((tm: any) => tm.team_id === managingTeam.id)).length} TOTAL
                                        </span>
                                    </div>
                                    <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--glass-border)', overflow: 'hidden' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--glass-border)' }}>
                                                <tr style={{ textAlign: 'left' }}>
                                                    <th style={{ padding: '1rem', fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Employee</th>
                                                    <th style={{ padding: '1rem', fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Team Role</th>
                                                    <th style={{ padding: '1rem', fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {users.filter(u => u.team_memberships?.some((tm: any) => tm.team_id === managingTeam.id)).map(u => {
                                                    const membership = u.team_memberships.find((tm: any) => tm.team_id === managingTeam.id);
                                                    return (
                                                        <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                                            <td style={{ padding: '1.25rem 1rem' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem' }}>
                                                                        {u.username[0].toUpperCase()}
                                                                    </div>
                                                                    <div>
                                                                        <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{u.full_nm}</div>
                                                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{u.email}</div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td style={{ padding: '1rem' }}>
                                                                <select
                                                                    className="dark-select"
                                                                    style={{ fontSize: '0.85rem', padding: '0.4rem 0.6rem', minWidth: '160px' }}
                                                                    value={membership.role?.id}
                                                                    onChange={async (e) => {
                                                                        setMembershipLoading(true);
                                                                        try {
                                                                            await api.management.addTeamMember(managingTeam.id, {
                                                                                user_id: u.id,
                                                                                team_id: managingTeam.id,
                                                                                role_id: parseInt(e.target.value)
                                                                            });
                                                                            await fetchData();
                                                                        } finally {
                                                                            setMembershipLoading(false);
                                                                        }
                                                                    }}
                                                                >
                                                                    {roles.filter(r => r.team_id === null).map(r => (
                                                                        <option key={r.id} value={r.id}>{r.role_nm.replace('DPE_', '').replace(/_/g, ' ')}</option>
                                                                    ))}
                                                                </select>
                                                            </td>
                                                            <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                                <button
                                                                    className="btn-secondary"
                                                                    style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)', padding: '0.5rem', background: 'rgba(239, 68, 68, 0.05)' }}
                                                                    onClick={async () => {
                                                                        if (!confirm(`Are you sure you want to remove ${u.full_nm} from ${managingTeam.team_nm}?`)) return;
                                                                        setMembershipLoading(true);
                                                                        try {
                                                                            await api.management.removeTeamMember(managingTeam.id, u.id);
                                                                            await fetchData();
                                                                        } finally {
                                                                            setMembershipLoading(false);
                                                                        }
                                                                    }}
                                                                >
                                                                    <X size={18} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                                {/* Team Metadata Settings */}
                                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                                    <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '1.5rem' }}>General Settings</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                        <div className="form-group">
                                            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Team Name</label>
                                            <input
                                                value={editingTeamData?.team_nm}
                                                onChange={e => setEditingTeamData({ ...editingTeamData, team_nm: e.target.value })}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Description</label>
                                            <input
                                                value={editingTeamData?.description}
                                                onChange={e => setEditingTeamData({ ...editingTeamData, description: e.target.value })}
                                            />
                                        </div>
                                        <div style={{ marginTop: '0.5rem' }}>
                                            <button className="btn-primary" onClick={handleUpdateTeam} disabled={membershipLoading}>
                                                Save Changes
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Code Locations / Repositories */}
                                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                                    <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '1.5rem' }}>Connected Repositories</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        {teamCodeLocations.map(loc => (
                                            <div key={loc.id} style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1rem', alignItems: 'center' }}>
                                                <div className="form-group">
                                                    <label style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Display Name</label>
                                                    <input
                                                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                                                        value={loc.location_nm}
                                                        onChange={e => setTeamCodeLocations(teamCodeLocations.map(l => l.id === loc.id ? { ...l, location_nm: e.target.value } : l))}
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Repo URL</label>
                                                    <input
                                                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                                                        value={loc.repo_url}
                                                        onChange={e => setTeamCodeLocations(teamCodeLocations.map(l => l.id === loc.id ? { ...l, repo_url: e.target.value } : l))}
                                                    />
                                                </div>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <button className="btn-secondary" style={{ padding: '0.4rem' }} onClick={() => handleUpdateCodeLocation(loc.id, loc)}><CheckSquare size={16} /></button>
                                                    <button className="btn-secondary" style={{ padding: '0.4rem', color: 'var(--error)' }} onClick={() => handleDeleteCodeLocation(loc.id)}><X size={16} /></button>
                                                </div>
                                            </div>
                                        ))}
                                        {teamCodeLocations.length === 0 && (
                                            <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-tertiary)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                                                No repositories connected yet.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Danger Zone */}
                                <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                    <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#ef4444', marginBottom: '0.5rem', fontWeight: 700 }}>Danger Zone</h4>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                                        Permanently delete this team and all associated data. This action cannot be undone.
                                    </p>
                                    <button
                                        onClick={handleDeleteTeam}
                                        style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.6rem 1.25rem', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
                                        Delete Team
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <style>{`
                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }
                .form-group input, .form-group select, .dark-select {
                    background: rgba(0,0,0,0.3);
                    border: 1px solid var(--glass-border);
                    border-radius: 8px;
                    padding: 0.75rem;
                    color: white;
                }
                .form-group input:focus, .form-group select:focus, .dark-select:focus {
                    outline: none;
                    border-color: var(--accent-primary);
                }
                .modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0,0,0,0.8);
                    backdrop-filter: blur(8px);
                    z-index: 200;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 2rem;
                }
                .modal-content {
                    max-height: 90vh;
                    overflow-y: auto;
                    padding: 2.5rem;
                    border: 1px solid var(--glass-border);
                }
            `}</style>
        </div>
    );
};
