import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, TableMetadata } from '../../services/api';
import { DynamicTable } from '../../components/DynamicTable';
import { Search, Puzzle, Rocket, Info, Workflow } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Pagination } from '../../components/Pagination';
import { RoleGuard } from '../../components/RoleGuard';
import { BlueprintInspectModal } from '../../components/BlueprintInspectModal';
import { ProvisioningWizard } from '../../components/ProvisioningWizard';
import { useNavigate } from 'react-router-dom';

export const BlueprintList: React.FC = () => {
    const navigate = useNavigate();
    const { currentTeamId } = useAuth();
    const [metadata, setMetadata] = useState<TableMetadata | null>(null);
    const [blueprints, setBlueprints] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
    const [selectedBlueprint, setSelectedBlueprint] = useState<any>(null);
    const [wizardBlueprint, setWizardBlueprint] = useState<any>(null);

    const [pageLimit, setPageLimit] = useState(25);
    const [pageOffset, setPageOffset] = useState(0);
    const [totalCount, setTotalCount] = useState(0);

    useEffect(() => {
        const fetchMetadata = async () => {
            try {
                const res = await api.metadata.blueprints();
                setMetadata(res.data);
            } catch (err) {
                console.error('Failed to fetch blueprint metadata', err);
            }
        };
        fetchMetadata();
    }, []);

    const fetchBlueprints = async () => {
        try {
            const res = await api.pipelines.listBlueprints(pageLimit, pageOffset, search);
            setBlueprints(res.data.items);
            setTotalCount(res.data.total_count);
        } catch (err) {
            console.error('Failed to fetch blueprints', err);
            setError("Failed to load blueprint catalog.");
        }
    };

    useEffect(() => {
        fetchBlueprints();
    }, [currentTeamId, pageLimit, pageOffset, search]);

    const filtered = blueprints; // Filtering handled server-side

    const handleInstantiate = (blueprint: any) => {
        setSelectedBlueprint(null);
        setWizardBlueprint(blueprint);
    };

    const handleProvisionSuccess = (instId: number) => {
        setWizardBlueprint(null);
        // Navigate to the new pipeline details
        navigate(`/pipelines/${instId}`);
    };

    if (error) {
        return <div className="glass" style={{ padding: '4rem', textAlign: 'center' }}>{error}</div>;
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Blueprint Gallery</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Discover and instantiate clinical data patterns</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--glass-bg)', padding: '0.25rem', borderRadius: 'var(--radius-md)' }}>
                    <button
                        onClick={() => setViewMode('grid')}
                        style={{
                            padding: '0.5rem 0.75rem',
                            borderRadius: 'var(--radius-sm)',
                            background: viewMode === 'grid' ? 'var(--accent-primary)' : 'transparent',
                            color: viewMode === 'grid' ? 'white' : 'var(--text-secondary)'
                        }}
                    >
                        Grid
                    </button>
                    <button
                        onClick={() => setViewMode('table')}
                        style={{
                            padding: '0.5rem 0.75rem',
                            borderRadius: 'var(--radius-sm)',
                            background: viewMode === 'table' ? 'var(--accent-primary)' : 'transparent',
                            color: viewMode === 'table' ? 'white' : 'var(--text-secondary)'
                        }}
                    >
                        Table
                    </button>
                </div>
            </div>

            <div className="glass premium-glass" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.3)' }}>
                <Search size={20} color="var(--accent-primary)" />
                <input
                    type="text"
                    placeholder="Search blueprints (e.g. sftp, showcase)..."
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        setPageOffset(0);
                    }}
                    className="premium-input"
                    style={{ background: 'transparent', border: 'none', outline: 'none', width: '100%', boxShadow: 'none' }}
                />
            </div>

            <div className="premium-glass" style={{
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                boxShadow: '0 20px 50px -20px rgba(0,0,0,0.5)',
                animation: 'fadeIn 0.5s ease-out'
            }}>
                {viewMode === 'grid' ? (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                        gap: '1.5rem',
                        padding: '1.5rem'
                    }}>
                        {filtered.map(b => (
                            <div key={b.id} className="glass hover-elevate" style={{
                                padding: '1.5rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '1rem',
                                cursor: 'default',
                                background: 'rgba(255,255,255,0.03)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{
                                        width: '48px',
                                        height: '48px',
                                        borderRadius: '12px',
                                        background: 'rgba(99, 102, 241, 0.1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'var(--accent-primary)'
                                    }}>
                                        <Puzzle size={24} />
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <span style={{
                                            fontSize: '0.7rem',
                                            background: 'rgba(255,255,255,0.05)',
                                            padding: '0.25rem 0.6rem',
                                            borderRadius: '100px',
                                            color: 'var(--text-tertiary)',
                                            fontWeight: 600,
                                            border: '1px solid rgba(255,255,255,0.1)'
                                        }}>
                                            {b.team_nm}
                                        </span>
                                        <Link
                                            to={`/pipelines?blueprint=${b.job_nm}`}
                                            style={{
                                                fontSize: '0.7rem',
                                                padding: '0.25rem 0.6rem',
                                                borderRadius: '6px',
                                                fontWeight: 600,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                textDecoration: 'none',
                                                transition: 'all 0.2s',
                                                cursor: b.instance_count > 0 ? 'pointer' : 'default',
                                                pointerEvents: b.instance_count > 0 ? 'auto' : 'none',
                                                background: b.instance_count > 0 ? 'rgba(79, 70, 229, 0.15)' : 'rgba(255,255,255,0.05)',
                                                color: b.instance_count > 0 ? '#a5b4fc' : 'var(--text-tertiary)',
                                                border: b.instance_count > 0 ? '1px solid rgba(79, 70, 229, 0.3)' : '1px solid rgba(255,255,255,0.1)',
                                            }}
                                            className={b.instance_count > 0 ? "hover:bg-indigo-500/20 hover:border-indigo-500/50" : ""}
                                            title={b.instance_count > 0 ? `Click to see all ${b.instance_count} instances.` : "No instances yet."}
                                        >
                                            <Workflow size={12} />
                                            {b.instance_count} {b.instance_count === 1 ? 'Instance' : 'Instances'}
                                        </Link>
                                    </div>
                                </div>

                                <div>
                                    <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', fontWeight: 700 }}>{b.job_nm}</h3>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, height: '3rem', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                        {b.description || 'No description provided for this clinical pattern.'}
                                    </p>
                                </div>

                                <div style={{ marginTop: 'auto', display: 'flex', gap: '0.75rem' }}>
                                    <RoleGuard requiredPermission="CAN_EDIT_PIPELINES">
                                        <button
                                            className="btn-primary"
                                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.85rem' }}
                                            onClick={() => handleInstantiate(b)}
                                        >
                                            <Rocket size={16} /> Use Blueprint
                                        </button>
                                    </RoleGuard>
                                    <button
                                        className="btn-secondary"
                                        style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        title="View Details"
                                        onClick={() => setSelectedBlueprint(b)}
                                    >
                                        <Info size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    metadata && (
                        <DynamicTable
                            metadata={metadata.columns}
                            data={filtered}
                            linkColumn="job_nm"
                            linkPath={() => `#`}
                            primaryKey={metadata.primary_key}
                            emptyMessage="No blueprints found."
                        />
                    )
                )}
            </div>

            {totalCount > pageLimit && (
                <Pagination
                    totalCount={totalCount}
                    limit={pageLimit}
                    offset={pageOffset}
                    onPageChange={(newOffset) => setPageOffset(newOffset)}
                    onLimitChange={(newLimit) => {
                        setPageLimit(newLimit);
                        setPageOffset(0);
                    }}
                />
            )}

            {filtered.length === 0 && (
                <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-tertiary)' }}>
                    <Puzzle size={48} style={{ marginBottom: '1rem', opacity: 0.2 }} />
                    <p>No blueprints found matching your search.</p>
                </div>
            )}

            {/* Inspection Modal */}
            {selectedBlueprint && (
                <BlueprintInspectModal
                    blueprint={selectedBlueprint}
                    onClose={() => setSelectedBlueprint(null)}
                    onUse={handleInstantiate}
                />
            )}

            {/* Provisioning Wizard */}
            {wizardBlueprint && (
                <ProvisioningWizard
                    blueprint={wizardBlueprint}
                    onClose={() => setWizardBlueprint(null)}
                    onSuccess={handleProvisionSuccess}
                />
            )}
        </div>
    );
};
