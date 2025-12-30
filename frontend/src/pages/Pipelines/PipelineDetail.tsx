import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../services/api';
import { DynamicFormRenderer } from '../../components/DynamicFormRenderer';
import { Activity, Database, Calendar, FileJson } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export const PipelineDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useAuth();
  const canViewConfig = hasPermission('CAN_VIEW_CONFIG');
  const [pipeline, setPipeline] = useState<any>(null);
  const [schema, setSchema] = useState<any>(null);
  const [runs, setRuns] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'parameters' | 'schema' | 'runs'>('overview');

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
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{pipeline.job_nm}</h1>
        <div style={{ display: 'flex', gap: '2rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          <span>Invocation: {pipeline.invok_id}</span>
          <span>Created: {new Date(pipeline.creat_dttm).toLocaleDateString()}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--glass-border)', marginBottom: '2rem' }}>
        <Tab value="overview" label="Overview" icon={Activity} />
        <Tab value="parameters" label="Parameters" icon={FileJson} />
        <Tab value="schema" label="Schema" icon={Database} />
        <Tab value="runs" label="Runs" icon={Calendar} />
      </div>

      <div className="glass" style={{ padding: '2rem' }}>
        {activeTab === 'overview' && (
          <div>
            <h3 style={{ marginBottom: '1.5rem' }}>Pipeline Configuration</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '1rem' }}>
              <div style={{ color: 'var(--text-secondary)' }}>Source Connection:</div>
              <div>{pipeline.source_conn_nm || 'Not configured'}</div>

              <div style={{ color: 'var(--text-secondary)' }}>Target Connection:</div>
              <div>{pipeline.target_conn_nm || 'Not configured'}</div>

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
            <DynamicFormRenderer pipelineId={Number(id)} />
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
