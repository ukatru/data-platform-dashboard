import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { UserPlus, Shield, Mail, X } from 'lucide-react';

export const UserManagement: React.FC = () => {
    const [users, setUsers] = useState<any[]>([]);
    const [roles, setRoles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState<any>(null);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        full_nm: '',
        email: '',
        role_id: 3, // Default to Analyst (if sorted as such, but we'll fetch)
        actv_ind: true
    });

    const { user: currentUser } = useAuth();

    const fetchData = async () => {
        setLoading(true);
        try {
            const [usersRes, rolesRes] = await Promise.all([
                api.users.list(),
                api.users.listRoles()
            ]);
            setUsers(usersRes.data);
            setRoles(rolesRes.data);
            if (rolesRes.data.length > 0 && !editingUser) {
                // Set default role to the least privileged one (last in list usually)
                const analystRole = rolesRes.data.find((r: any) => r.role_nm === 'DPE_DATA_ANALYST');
                if (analystRole) {
                    setFormData(prev => ({ ...prev, role_id: analystRole.id }));
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
        const analystRole = roles.find((r: any) => r.role_nm === 'DPE_DATA_ANALYST');
        setFormData({
            username: '',
            password: '',
            full_nm: '',
            email: '',
            role_id: analystRole?.id || roles[0]?.id || 0,
            actv_ind: true
        });
        setShowModal(true);
    };

    if (loading && users.length === 0) {
        return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading user directory...</div>;
    }

    return (
        <div className="admin-page">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>User Management</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Manage platform access and assign roles</p>
                </div>
                <button className="btn-primary" onClick={handleCreate} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <UserPlus size={20} /> Add User
                </button>
            </div>

            <div className="glass" style={{ overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--glass-border)' }}>
                            <th style={{ padding: '1.25rem' }}>User</th>
                            <th style={{ padding: '1.25rem' }}>Identity</th>
                            <th style={{ padding: '1.25rem' }}>Access Level</th>
                            <th style={{ padding: '1.25rem' }}>Status</th>
                            <th style={{ padding: '1.25rem' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(u => (
                            <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                <td style={{ padding: '1.25rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <div style={{
                                            width: 40,
                                            height: 40,
                                            borderRadius: '50%',
                                            background: u.actv_ind ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                                            opacity: 0.2,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '1rem',
                                            fontWeight: 700,
                                            color: 'white'
                                        }}>
                                            {u.username[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600 }}>{u.full_nm}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>@{u.username}</div>
                                        </div>
                                    </div>
                                </td>
                                <td style={{ padding: '1.25rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                        <Mail size={14} />
                                        {u.email || 'No email set'}
                                    </div>
                                </td>
                                <td style={{ padding: '1.25rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Shield size={16} color="var(--accent-secondary)" />
                                        <span className="status-badge" style={{ background: 'rgba(129, 140, 248, 0.1)', color: '#818cf8', border: '1px solid rgba(129, 140, 248, 0.2)' }}>
                                            {(u.role?.role_nm || u.role_nm || 'Guest').replace('DPE_', '').replace('_', ' ')}
                                        </span>
                                    </div>
                                </td>
                                <td style={{ padding: '1.25rem' }}>
                                    <span className={u.actv_ind ? 'status-success' : 'status-error'}>
                                        {u.actv_ind ? 'Active' : 'Disabled'}
                                    </span>
                                </td>
                                <td style={{ padding: '1.25rem' }}>
                                    <button
                                        className="btn-secondary"
                                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                                        onClick={() => handleEdit(u)}
                                        disabled={u.username === currentUser?.username}
                                    >
                                        Manage
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="glass" style={{ width: '450px', padding: '2.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{editingUser ? 'Manage User' : 'New User Account'}</h3>
                            <button onClick={() => setShowModal(false)}><X /></button>
                        </div>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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
                                <label>Target Role</label>
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

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                                <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                                    {editingUser ? 'Update User' : 'Create User'}
                                </button>
                                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary" style={{ flex: 1 }}>
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }
                .form-group label {
                    font-size: 0.85rem;
                    color: var(--text-secondary);
                    font-weight: 500;
                }
                .form-group input, .form-group select {
                    background: rgba(0,0,0,0.2);
                    border: 1px solid var(--glass-border);
                    border-radius: 8px;
                    padding: 0.75rem;
                    color: white;
                }
                .form-group input:focus, .form-group select:focus {
                    outline: none;
                    border-color: var(--accent-primary);
                }
            `}</style>
        </div>
    );
};
