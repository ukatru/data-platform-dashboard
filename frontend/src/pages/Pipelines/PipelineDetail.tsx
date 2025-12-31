import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../services/api';
import { DynamicFormRenderer } from '../../components/DynamicFormRenderer';
import { Activity, Calendar, FileJson } from 'lucide-react';

export const PipelineDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [pipeline, setPipeline] = useState<any>(null);
  const [runs, setRuns] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'config' | 'runs'>('overview');

  useEffect(() => {
    const fetchPipeline = async () => {
      try {
        const res = await api.pipelines.get(id as any);
        setPipeline(res.data);

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
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  }

  const NavTab = ({ value, label, icon: Icon }: any) => (
    <button
      onClick={() => setActiveTab(value)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '1rem 1.5rem',
        borderBottom: activeTab === value ? '2px solid var(--accent-primary)' : '2px solid transparent',
        color: activeTab === value ? 'var(--accent-primary)' : 'var(--text-secondary)',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        fontSize: '1rem',
        transition: 'all 0.2s ease'
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
          <span>Instance: {pipeline.instance_id}</span>
          <span>Created: {new Date(pipeline.creat_dttm).toLocaleDateString()}</span>
        </div>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)', marginBottom: '2rem' }}>
        <NavTab value="overview" label="Overview" icon={Activity} />
        <NavTab value="config" label="Configuration" icon={FileJson} />
        <NavTab value="runs" label="Execution History" icon={Calendar} />
      </div>

      <div style={{ marginTop: '2rem' }}>
        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '2rem' }}>
            <div className="glass" style={{ padding: '2rem' }}>
              <h3 style={{ marginBottom: '1.5rem' }}>Pipeline Status</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Status</span>
                  <span className={`badge ${pipeline.actv_ind ? 'badge-success' : 'badge-danger'}`} style={{ padding: '0.4rem 1rem' }}>
                    {pipeline.actv_ind ? 'Active / Runnable' : 'Inactive'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Schedule</span>
                  <span style={{ fontWeight: 500 }}>{pipeline.schedule_display}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Owner Team</span>
                  <span>{pipeline.team_nm}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Source Blueprint</span>
                  <span className="badge" style={{ background: 'var(--accent-primary-20)', color: 'var(--accent-primary)' }}>
                    {pipeline.template_nm || 'Singleton'}
                  </span>
                </div>
              </div>

              <div style={{ marginTop: '2.5rem' }}>
                <h4 style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</h4>
                <p style={{ lineHeight: 1.6 }}>{pipeline.description || 'No description provided.'}</p>
              </div>
            </div>

            <div className="glass" style={{ padding: '2rem' }}>
              <h3 style={{ marginBottom: '1.5rem' }}>Underlying Logic (YAML)</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                {pipeline.is_singleton ? 'Self-contained Singleton definition' : `Inherited from: ${pipeline.template_nm}`}
              </p>
              <div style={{
                background: 'rgba(0,0,0,0.3)',
                padding: '1.5rem',
                borderRadius: 'var(--radius-md)',
                maxHeight: '400px',
                overflowY: 'auto',
                border: '1px solid var(--glass-border)'
              }}>
                <pre style={{ fontSize: '0.85rem', color: '#818cf8', fontFamily: 'monospace', margin: 0 }}>
                  {pipeline.yaml_def ? JSON.stringify(pipeline.yaml_def, null, 2) : '# No logic defined'}
                </pre>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'config' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h3>Runtime Configuration</h3>
              <span className="badge" style={{ background: 'var(--accent-primary-20)', color: 'var(--accent-primary)' }}>
                Powered by JSON Schema
              </span>
            </div>
            <div className="glass" style={{ padding: '2rem' }}>
              <DynamicFormRenderer pipelineId={id as any} />
            </div>
          </div>
        )}

        {activeTab === 'runs' && (
          <div>
            <h3 style={{ marginBottom: '2rem' }}>Execution History</h3>
            {runs.length > 0 ? (
              <div className="glass" style={{ padding: '1rem', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                      <th style={{ textAlign: 'left', padding: '1rem' }}>Batch #</th>
                      <th style={{ textAlign: 'left', padding: '1rem' }}>Run ID</th>
                      <th style={{ textAlign: 'left', padding: '1rem' }}>Status</th>
                      <th style={{ textAlign: 'left', padding: '1rem' }}>Mode</th>
                      <th style={{ textAlign: 'left', padding: '1rem' }}>Start Time</th>
                      <th style={{ textAlign: 'left', padding: '1rem' }}>Duration</th>
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
                        <tr key={run.btch_nbr} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                          <td style={{ padding: '1rem', fontWeight: 600 }}>#{run.btch_nbr}</td>
                          <td style={{ padding: '1rem', fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            {run.run_id.substring(0, 12)}...
                          </td>
                          <td style={{ padding: '1rem' }}>
                            <span className={`badge ${run.btch_sts_cd === 'C' ? 'badge-success' :
                              run.btch_sts_cd === 'A' ? 'badge-danger' :
                                'badge-warning'
                              }`}>
                              {run.btch_sts_cd === 'C' ? 'Success' : run.btch_sts_cd === 'A' ? 'Failed' : 'Running'}
                            </span>
                          </td>
                          <td style={{ padding: '1rem' }}>{run.run_mde_txt}</td>
                          <td style={{ padding: '1rem', fontSize: '0.85rem' }}>
                            {new Date(run.strt_dttm).toLocaleString()}
                          </td>
                          <td style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                            {mins}m {secs}s
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="glass" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                No execution history found for this pipeline
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
