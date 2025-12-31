import React, { useState, useEffect } from 'react';
import { api, TableMetadata } from '../../services/api';
import { Search } from 'lucide-react';
import { DynamicTable } from '../../components/DynamicTable';
import { useAuth } from '../../contexts/AuthContext';
import { JobDefinitionModal } from '../Pipelines/JobDefinitionModal';

export const BlueprintList: React.FC = () => {
    const { currentTeamId } = useAuth();
    const [metadata, setMetadata] = useState<TableMetadata | null>(null);
    const [blueprints, setBlueprints] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [viewingBlueprint, setViewingBlueprint] = useState<any | null>(null);

    useEffect(() => {
        const fetchMetadata = async () => {
            try {
                const metaRes = await api.metadata.blueprints();
                setMetadata(metaRes.data);
            } catch (err) {
                console.error('Failed to fetch metadata', err);
            }
        };
        fetchMetadata();
    }, []);

    const fetchBlueprints = async () => {
        try {
            const res = await api.blueprints.list();
            setBlueprints(res.data);
        } catch (err) {
            console.error('Failed to fetch blueprints', err);
        }
    };

    useEffect(() => {
        fetchBlueprints();
    }, [currentTeamId]);

    const handleView = (blueprint: any) => {
        setViewingBlueprint(blueprint);
    };

    if (!metadata) {
        return <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>Loading blueprints...</div>;
    }

    const filteredBlueprints = blueprints.filter(b =>
        b.template_nm.toLowerCase().includes(search.toLowerCase()) ||
        (b.description && b.description.toLowerCase().includes(search.toLowerCase()))
    );

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Blueprints</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Library of reusable pipeline patterns (Blueprints)</p>
                </div>
            </div>

            <div className="glass" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <Search size={20} color="var(--text-secondary)" />
                <input
                    type="text"
                    placeholder="Search blueprints..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ background: 'transparent', border: 'none', outline: 'none', width: '100%' }}
                />
            </div>

            <DynamicTable
                metadata={metadata.columns}
                data={filteredBlueprints}
                onLinkClick={handleView}
                linkColumn={['template_nm', 'yaml_def']}
                primaryKey="id"
                emptyMessage="No blueprints found for this team. Ensure your repositories have templates defined in YAML."
            />

            {viewingBlueprint && (
                <JobDefinitionModal
                    definition={viewingBlueprint}
                    onClose={() => setViewingBlueprint(null)}
                />
            )}
        </div>
    );
};
