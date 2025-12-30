import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Shield, CheckCircle2, Info } from 'lucide-react';

export const RolesManagement: React.FC = () => {
    const [roles, setRoles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRoles = async () => {
            try {
                const res = await api.users.listRoles();
                setRoles(res.data);
            } catch (err) {
                console.error('Failed to fetch roles', err);
            } finally {
                setLoading(false);
            }
        };
        fetchRoles();
    }, []);

    const permissionMap: Record<string, string> = {
        'PLATFORM_ADMIN': 'Full system administrative access',
        'CAN_MANAGE_TEAMS': 'Create/delete teams and manage memberships',
        'CAN_MANAGE_USERS': 'Invite users and change global roles',
        'CAN_MANAGE_CONNECTIONS': 'Configure and test data sources',
        'CAN_EDIT_PIPELINES': 'Deploy and update YAML pipelines',
        'CAN_VIEW_LOGS': 'Access run history and operational stats'
    };

    const getPermissionsForRole = (roleNm: string) => {
        // This logic mimics the backend auth.py get_role_permissions mapping
        if (roleNm === "DPE_PLATFORM_ADMIN") return Object.keys(permissionMap);
        if (roleNm.includes("_LEAD")) return ['CAN_VIEW_LOGS', 'CAN_EDIT_PIPELINES', 'CAN_MANAGE_CONNECTIONS', 'CAN_MANAGE_USERS'];
        if (roleNm.includes("_RW") || roleNm === "DPE_DEVELOPER") return ['CAN_VIEW_LOGS', 'CAN_EDIT_PIPELINES'];
        return ['CAN_VIEW_LOGS'];
    };

    return (
        <div style={{ maxWidth: '1000px' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Roles & Permissions</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '3rem' }}>
                Operational RACI Matrix and standardized access tiers
            </p>

            <div style={{ display: 'grid', gap: '2rem' }}>
                <section>
                    <div className="glass" style={{ padding: '2rem' }}>
                        <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Shield size={24} color="var(--accent-primary)" />
                            System Permissions
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                            {Object.entries(permissionMap).map(([key, desc]) => (
                                <div key={key} style={{
                                    padding: '1rem',
                                    background: 'rgba(255,255,255,0.03)',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--glass-border)'
                                }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.25rem' }}>{key}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{desc}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section>
                    <h3 style={{ marginBottom: '1.5rem' }}>Defined Roles</h3>
                    <div style={{ display: 'grid', gap: '1rem' }}>
                        {loading ? (
                            <div className="glass" style={{ padding: '2rem', textAlign: 'center' }}>Loading roles...</div>
                        ) : roles.map(role => (
                            <div key={role.id} className="glass" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                        <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{role.role_nm}</div>
                                        {role.team_id && (
                                            <span style={{
                                                fontSize: '0.65rem',
                                                background: 'var(--accent-primary)',
                                                padding: '2px 6px',
                                                borderRadius: '4px',
                                                textTransform: 'uppercase'
                                            }}>Team Scoped</span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                        {role.description || "General platform access role"}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '400px' }}>
                                    {getPermissionsForRole(role.role_nm).map(perm => (
                                        <div key={perm} style={{
                                            fontSize: '0.7rem',
                                            padding: '4px 8px',
                                            background: 'rgba(99, 102, 241, 0.1)',
                                            border: '1px solid rgba(99, 102, 241, 0.2)',
                                            borderRadius: '12px',
                                            color: 'var(--accent-primary)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}>
                                            <CheckCircle2 size={10} />
                                            {perm}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            <div className="glass" style={{ marginTop: '3rem', padding: '1.5rem', borderLeft: '4px solid var(--accent-primary)' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <Info size={24} color="var(--accent-primary)" />
                    <div>
                        <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>About Aggregated Permissions</div>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
                            A user's effective permissions are the <strong>union</strong> of their global role and all their team roles.
                            If you are a Reader globally but a Lead in Team EDW, you will have Lead permissions for all EDW resources.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
