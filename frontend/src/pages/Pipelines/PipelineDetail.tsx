import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../services/api';
import { DynamicFormRenderer } from '../../components/DynamicFormRenderer';
import { Activity, Database, Calendar, FileJson, Lock, Puzzle, FileCode } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export const PipelineDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useAuth();
  const canViewConfig = hasPermission('CAN_VIEW_CONFIG');
  const [pipeline, setPipeline] = useState<any>(null);
  const [schema, setSchema] = useState<any>(null);
  const [runs, setRuns] = useState<any[]>([]);
  const [invocations, setInvocations] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'parameters' | 'schema' | 'runs' | 'invocations' | 'definition'>('overview');

  useEffect(() => {
    const fetchPipeline = async () => {
      try {
        const res = await api.pipelines.get(Number(id));
        setPipeline(res.data);

        // Fetch schema
        try {
          const schemaRes = await api.pipelines.getSchema(Number(id));
          setSchema(schemaRes.data);
        } catch (err) {
          console.log('No schema found for this pipeline');
        }

        // Fetch recent runs
        try {
          const runsRes = await api.status.jobs({ job_nm: res.data.job_nm, limit: 20 });
          setRuns(runsRes.data);
        } catch (err) {
          console.log('No runs found for this pipeline');
        }

        // Fetch instances if blueprint
        if (res.data.source_type === 'blueprint') {
          try {
            const instRes = await api.pipelines.list(); // Filter in-frontend for now or add explicit endpoint
            setInvocations(instRes.data.filter((i: any) => i.job_nm === res.data.job_nm && i.source_type === 'instance'));
          } catch (err) {
            console.log('Failed to fetch invocations');
          }
        }
      } catch (err) {
        console.error('Failed to fetch pipeline', err);
      }
    };
    fetchPipeline();
  }, [id]);

  if (!pipeline) {
    return <div>Loading...</div>;
  }

  const Tab = ({ value, label, icon: Icon }: any) => (
    <button
      onClick={() => setActiveTab(value)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '1rem 1.5rem',
        borderBottom: activeTab === value ? '2px solid var(--accent-primary)' : '2px solid transparent',
        color: activeTab === value ? 'var(--accent-primary)' : 'var(--text-secondary)',
        fontWeight: activeTab === value ? 600 : 400,
      }}
    >
      <Icon size={18} />
      {label}
    </button>
  );

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {pipeline.source_type === 'static' ? <Lock size={24} color="var(--text-secondary)" /> : <Puzzle size={24} color="var(--accent-primary)" />}
          {pipeline.job_nm}
        </h1>
        <div style={{ display: 'flex', gap: '2rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          <span>Instance ID: {pipeline.instance_id}</span>
          <span className="status-badge" style={{ fontSize: '0.75rem' }}>Source: {pipeline.source_type}</span>
          <span>Created: {new Date(pipeline.creat_dttm).toLocaleDateString()}</span>
        </div>
      </div>

      {pipeline.source_type === 'static' && (
        <div style={{
          background: 'rgba(255, 184, 0, 0.1)',
          border: '1px solid rgba(255, 184, 0, 0.3)',
          padding: '1rem',
          borderRadius: 'var(--radius-md)',
          marginBottom: '2rem',
          color: '#fbbf24',
          fontSize: '0.9rem'
        }}>
          <strong>Code-Owned:</strong> This pipeline is defined in Git. Parameters can be overridden here, but fundamental logic is managed via PR.
        </div>
      )}

      <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--glass-border)', marginBottom: '2rem' }}>
        <Tab value="overview" label="Overview" icon={Activity} />
        <Tab value="parameters" label="Parameters" icon={FileJson} />
        <Tab value="schema" label="Schema" icon={Database} />
        <Tab value="definition" label="Definition" icon={FileCode} />
        {pipeline.source_type === 'blueprint' && <Tab value="invocations" label="Invocations" icon={Puzzle} />}
        <Tab value="runs" label="Runs" icon={Calendar} />
      </div>

      <div className="glass" style={{ padding: '2rem' }}>
        {activeTab === 'overview' && (
          <div>
            <h3 style={{ marginBottom: '1.5rem' }}>Pipeline Configuration</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '1rem' }}>
              <div style={{ color: 'var(--text-secondary)' }}>Schedule:</div>
              <div>{pipeline.schedule_id ? `Schedule #${pipeline.schedule_id}` : pipeline.cron_schedule || 'Manual execution'}</div>

              <div style={{ color: 'var(--text-secondary)' }}>Active:</div>
              <div>
                <span className={pipeline.actv_ind ? 'status-success' : 'status-error'}>
                  {pipeline.actv_ind ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'parameters' && (
          <div>
            <h3 style={{ marginBottom: '1.5rem' }}>Runtime Parameters</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
              Parameters are validated against the registered JSON Schema
            </p>
            <DynamicFormRenderer
              pipelineId={Number(id)}
              readOnly={pipeline.source_type === 'static'}
            />
          </div>
        )}

        {activeTab === 'schema' && (
          <div>
            <h3 style={{ marginBottom: '1.5rem' }}>JSON Schema</h3>
            {schema ? (
              <div>
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Description</div>
                  <div>{schema.description || 'No description'}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Schema Definition</div>
                  <pre style={{
                    background: 'var(--bg-primary)',
                    padding: '1rem',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'auto',
                    fontSize: '0.85rem',
                    color: '#818cf8',
                    fontStyle: canViewConfig ? 'normal' : 'italic',
                    opacity: canViewConfig ? 1 : 0.7
                  }}>
                    {canViewConfig ? JSON.stringify(schema.json_schema, null, 2) : '[Redacted: Requires Elevated Configuration Access]'}
                  </pre>
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--text-secondary)' }}>
                No schema registered for this pipeline. Register one in the Schemas page.
              </p>
            )}
          </div>
        )}

        {activeTab === 'invocations' && (
          <div>
            <h3 style={{ marginBottom: '1.5rem' }}>Active Invocations</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
              Individual instances generated from this blueprint
            </p>
            {invocations.length > 0 ? (
              <table style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Instance ID</th>
                    <th>Team</th>
                    <th>Schedule</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invocations.map(inv => (
                    <tr key={inv.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{inv.instance_id}</td>
                      <td>{inv.team_nm}</td>
                      <td>{inv.schedule}</td>
                      <td>
                        <span className={inv.actv_ind ? 'status-success' : 'status-error'}>
                          {inv.actv_ind ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <a href={`/pipelines/${inv.id}`} className="badge" style={{ textDecoration: 'none' }}>View Details</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ color: 'var(--text-secondary)' }}>No active invocations found for this blueprint.</p>
            )}
          </div>
        )}

        {activeTab === 'definition' && (
          <div>
            <h3 style={{ marginBottom: '1.5rem' }}>YAML Definition</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
              Base definition from Git repository
            </p>
            <pre style={{
              background: 'var(--bg-primary)',
              padding: '1.5rem',
              borderRadius: 'var(--radius-md)',
              overflow: 'auto',
              fontSize: '0.85rem',
              color: '#d1d5db',
              border: '1px solid var(--glass-border)',
              lineHeight: '1.5'
            }}>
              {pipeline.yaml_content || 'No YAML definition found on disk'}
            </pre>
          </div>
        )}

        {activeTab === 'runs' && (
          <div>
            <h3 style={{ marginBottom: '1.5rem' }}>Execution History</h3>
            {runs.length > 0 ? (
              <table style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Batch #</th>
                    <th>Run ID</th>
                    <th>Status</th>
                    <th>Mode</th>
                    <th>Start Time</th>
                    <th>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => {
                    const duration = run.end_dttm
                      ? Math.floor((new Date(run.end_dttm).getTime() - new Date(run.strt_dttm).getTime()) / 1000)
                      : Math.floor((new Date().getTime() - new Date(run.strt_dttm).getTime()) / 1000);
                    const mins = Math.floor(duration / 60);
                    const secs = duration % 60;

                    return (
                      <tr key={run.btch_nbr}>
                        <td style={{ fontWeight: 600 }}>#{run.btch_nbr}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                          {run.run_id.substring(0, 12)}...
                        </td>
                        <td>
                          <span className={
                            run.btch_sts_cd === 'C' ? 'status-success' :
                              run.btch_sts_cd === 'A' ? 'status-error' :
                                'status-running'
                          }>
                            {run.btch_sts_cd === 'C' ? 'Success' : run.btch_sts_cd === 'A' ? 'Failed' : 'Running'}
                          </span>
                        </td>
                        <td>{run.run_mde_txt}</td>
                        <td style={{ fontSize: '0.85rem' }}>
                          {new Date(run.strt_dttm).toLocaleString()}
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                          {mins}m {secs}s
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p style={{ color: 'var(--text-secondary)' }}>
                No execution history found for this pipeline
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
