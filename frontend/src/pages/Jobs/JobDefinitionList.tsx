import React, { useState, useEffect } from 'react';
import { api, TableMetadata } from '../../services/api';
import { Search } from 'lucide-react';
import { DynamicTable } from '../../components/DynamicTable';
import { useAuth } from '../../contexts/AuthContext';
import { JobDefinitionModal } from '../Pipelines/JobDefinitionModal';

export const JobDefinitionList: React.FC = () => {
    const { currentTeamId } = useAuth();
    const [metadata, setMetadata] = useState<TableMetadata | null>(null);
    const [definitions, setDefinitions] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [viewingDefinition, setViewingDefinition] = useState<any | null>(null);

    useEffect(() => {
        const fetchMetadata = async () => {
            try {
                const metaRes = await api.metadata.jobs();
                setMetadata(metaRes.data);
            } catch (err) {
                console.error('Failed to fetch metadata', err);
            }
        };
        fetchMetadata();
    }, []);

    const fetchDefinitions = async () => {
        try {
            const res = await api.jobs.list();
            setDefinitions(res.data);
        } catch (err) {
            console.error('Failed to fetch definitions', err);
        }
    };

    useEffect(() => {
        fetchDefinitions();
    }, [currentTeamId]);

    const handleView = (definition: any) => {
        setViewingDefinition(definition);
    };

    if (!metadata) {
        return <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>Loading job definitions...</div>;
    }

    const filteredDefinitions = definitions.filter(d =>
        d.job_nm.toLowerCase().includes(search.toLowerCase()) ||
        (d.description && d.description.toLowerCase().includes(search.toLowerCase()))
    );

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Job Definitions</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>All discovered jobs from repository metadata (YAML Source)</p>
                </div>
            </div>

            <div className="glass" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <Search size={20} color="var(--text-secondary)" />
                <input
                    type="text"
                    placeholder="Search jobs..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ background: 'transparent', border: 'none', outline: 'none', width: '100%' }}
                />
            </div>

            <DynamicTable
                metadata={metadata.columns}
                data={filteredDefinitions}
                onLinkClick={handleView}
                linkColumn={['job_nm', 'yaml_def']}
                primaryKey="id"
                emptyMessage="No job definitions found for this team. Ensure your repositories have metadata.yaml files and are synced."
            />

            {viewingDefinition && (
                <JobDefinitionModal
                    definition={viewingDefinition}
                    onClose={() => setViewingDefinition(null)}
                />
            )}
        </div>
    );
};
