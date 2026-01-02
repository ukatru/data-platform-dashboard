import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Edit, Trash2, Copy, Play, Lock, Puzzle, Settings } from 'lucide-react';
import { ColumnMetadata } from '../services/api';
import { RoleName, useAuth } from '../contexts/AuthContext';
import { RoleGuard } from './RoleGuard';

import { Pagination } from './Pagination';

interface DynamicTableProps {
    metadata: ColumnMetadata[];
    data: any[];
    onEdit?: (row: any) => void;
    onDelete?: (row: any) => void;
    onTest?: (row: any) => void;
    onLinkClick?: (row: any) => void;
    linkColumn?: string;
    linkPath?: (row: any) => string;
    primaryKey: string;
    editRole?: RoleName;
    deleteRole?: RoleName;
    testRole?: RoleName;
    emptyMessage?: string;
    // Pagination Props
    totalCount?: number;
    limit?: number;
    offset?: number;
    onPageChange?: (newOffset: number) => void;
    onLimitChange?: (newLimit: number) => void;
    loading?: boolean;
}

export const DynamicTable: React.FC<DynamicTableProps> = ({
    metadata,
    data,
    onEdit,
    onDelete,
    onTest,
    onLinkClick,
    linkColumn,
    linkPath,
    primaryKey,
    editRole,
    deleteRole,
    testRole,
    emptyMessage = "No records found",
    totalCount,
    limit,
    offset,
    onPageChange,
    onLimitChange,
    loading = false
}) => {
    const { hasPermission } = useAuth();

    // Column Visibility State
    const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() => {
        const initial: Record<string, boolean> = {};
        metadata.forEach(col => {
            initial[col.name] = col.visible !== false;
        });
        return initial;
    });

    // Column Widths State
    const [widths, setWidths] = useState<Record<string, number>>(() => {
        const initial: Record<string, number> = {};
        metadata.forEach(col => {
            initial[col.name] = col.width ? parseInt(col.width) : 150;
        });
        return initial;
    });

    const [showSettings, setShowSettings] = useState(false);
    const settingsRef = useRef<HTMLDivElement>(null);
    const resizingColumn = useRef<string | null>(null);
    const startX = useRef<number>(0);
    const startWidth = useRef<number>(0);

    const visibleColumns = metadata.filter(col => columnVisibility[col.name]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
                setShowSettings(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleResizeStart = (e: React.MouseEvent, colName: string) => {
        e.preventDefault();
        resizingColumn.current = colName;
        startX.current = e.pageX;
        startWidth.current = widths[colName] || 150;

        document.addEventListener('mousemove', handleResizeMove);
        document.addEventListener('mouseup', handleResizeEnd);
        document.body.style.cursor = 'col-resize';
    };

    const handleResizeMove = (e: MouseEvent) => {
        if (!resizingColumn.current) return;
        const diff = e.pageX - startX.current;
        const newWidth = Math.max(50, startWidth.current + diff);
        setWidths(prev => ({ ...prev, [resizingColumn.current!]: newWidth }));
    };

    const handleResizeEnd = () => {
        resizingColumn.current = null;
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
        document.body.style.cursor = 'default';
    };

    const toggleColumn = (colName: string) => {
        setColumnVisibility(prev => ({ ...prev, [colName]: !prev[colName] }));
    };

    const getPermissionForRole = (role?: RoleName) => {
        if (role === 'DPE_PLATFORM_ADMIN') return 'PLATFORM_ADMIN';
        if (role === 'DPE_DEVELOPER') return 'CAN_EDIT_PIPELINES';
        return 'CAN_VIEW_LOGS';
    };

    const isActionsVisible = (
        (onEdit && hasPermission(getPermissionForRole(editRole || 'DPE_DEVELOPER'))) ||
        (onDelete && hasPermission(getPermissionForRole(deleteRole || 'DPE_PLATFORM_ADMIN'))) ||
        (onTest && hasPermission(getPermissionForRole(testRole || 'DPE_DATA_ANALYST')))
    );

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    const renderCell = (row: any, col: ColumnMetadata) => {
        const value = row[col.name];
        if (value === null || value === undefined) return <span className="data-cell-secondary">—</span>;

        if (col.render_hint === 'link' && linkColumn === col.name) {
            const icon = (
                <span style={{ display: 'flex', flexShrink: 0 }}>
                    {col.name === 'job_nm' && (!row.instance_id || row.source_type === 'static' || row.instance_id === 'STATIC') && <Lock size={14} style={{ opacity: 0.7 }} />}
                    {col.name === 'job_nm' && (row.source_type === 'instance' || (row.instance_id && row.instance_id !== 'STATIC')) && <Puzzle size={14} style={{ opacity: 0.7 }} />}
                </span>
            );

            if (onLinkClick) return <button onClick={() => onLinkClick(row)} className="data-cell-primary" style={{ padding: 0, color: 'var(--accent-primary)', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>{icon}{value}</button>;
            if (linkPath) return <Link to={linkPath(row)} className="data-cell-primary" style={{ color: 'var(--accent-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>{icon}{value}</Link>;
        }

        if (col.render_hint === 'external_link' && value) {
            return <a href={value} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}>{value} <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></a>;
        }

        if (col.render_hint === 'code') {
            return <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><code style={{ fontFamily: 'monospace', fontSize: '0.8rem', background: 'rgba(0,0,0,0.2)', padding: '0.2rem 0.4rem', borderRadius: '4px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={value}>{value}</code>{col.name === 'run_id' && <button onClick={() => copyToClipboard(value)} style={{ padding: '0.25rem', opacity: 0.5 }} title="Copy"><Copy size={12} /></button>}</div>;
        }

        if (col.render_hint === 'badge') {
            if (col.data_type === 'boolean') return <span className={value ? 'status-success' : 'status-error'} style={{ fontSize: '0.7rem' }}>{value ? 'Active' : 'Inactive'}</span>;
            if (col.name === 'btch_sts_cd') {
                const statusMap: any = { 'R': { label: 'Running', className: 'status-running' }, 'C': { label: 'Success', className: 'status-success' }, 'A': { label: 'Failed', className: 'status-error' } };
                const status = statusMap[value] || { label: value, className: 'status-badge' };
                return <span className={status.className} style={{ fontSize: '0.7rem' }}>{status.label}</span>;
            }
            return <span className="status-badge" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.7rem' }}>{col.name === 'source_type' && value === 'static' && <Lock size={10} />}{col.name === 'source_type' && value === 'instance' && <Puzzle size={10} />}{value && typeof value === 'string' && value.length > 0 && <span>{value.charAt(0).toUpperCase() + value.slice(1)}</span>}</span>;
        }

        if (col.render_hint === 'datetime' || col.data_type === 'datetime') return <span className="data-cell-secondary">{new Date(value).toLocaleDateString()}</span>;
        if (col.data_type === 'integer') return <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{col.name === 'btch_nbr' ? `#${value}` : value}</span>;
        return <span className="data-cell-primary" style={{ fontSize: '0.9rem' }}>{value}</span>;
    };

    return (
        <div className="premium-glass" style={{
            borderRadius: 'var(--radius-lg)',
            overflow: 'visible',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            boxShadow: 'var(--shadow-lg)',
            animation: 'fadeIn 0.5s ease-out',
            background: 'rgba(15, 23, 42, 0.4)',
            position: 'relative'
        }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <div ref={settingsRef} style={{ position: 'relative' }}>
                    <button onClick={() => setShowSettings(!showSettings)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.25rem', opacity: 0.6 }} title="Column Settings"><Settings size={18} /></button>
                    {showSettings && (
                        <div className="premium-glass" style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, zIndex: 1000, padding: '1.25rem', minWidth: '220px', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)' }}>
                            <div style={{ marginBottom: '1rem', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Visibility</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '300px', overflowY: 'auto' }}>
                                {metadata.map(col => (
                                    <label key={col.name} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                                        <input type="checkbox" checked={columnVisibility[col.name]} onChange={() => toggleColumn(col.name)} style={{ width: '1.1rem', height: '1.1rem' }} />
                                        <span style={{ color: columnVisibility[col.name] ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: columnVisibility[col.name] ? 600 : 400 }}>{col.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                    <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.015)' }}>
                            {visibleColumns.map(col => (
                                <th key={col.name} style={{ width: `${widths[col.name] || 150}px`, position: 'relative' }}>
                                    {col.label}
                                    <div onMouseDown={(e) => handleResizeStart(e, col.name)} style={{ position: 'absolute', right: 0, top: '25%', bottom: '25%', width: '1px', background: 'rgba(255,255,255,0.1)', cursor: 'col-resize', zIndex: 10 }} />
                                </th>
                            ))}
                            {isActionsVisible && <th style={{ width: '120px', textAlign: 'right' }}>Actions</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i}>
                                    <td colSpan={visibleColumns.length + (isActionsVisible ? 1 : 0)} className="skeleton" style={{ height: '60px' }} />
                                </tr>
                            ))
                        ) : data.length === 0 ? (
                            <tr>
                                <td colSpan={visibleColumns.length + (isActionsVisible ? 1 : 0)} style={{ textAlign: 'center', padding: '6rem', color: 'var(--text-secondary)', fontSize: '1rem', fontWeight: 500 }}>{emptyMessage}</td>
                            </tr>
                        ) : data.map((row) => (
                            <tr key={row[primaryKey]} className="table-row-premium">
                                {visibleColumns.map(col => (
                                    <td key={col.name} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {renderCell(row, col)}
                                    </td>
                                ))}
                                {isActionsVisible && (
                                    <td>
                                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                            {onTest && <RoleGuard requiredRole={testRole || 'DPE_DATA_ANALYST'}><button onClick={() => onTest(row)} style={{ color: 'var(--accent-secondary)', opacity: 0.8 }} title="Test diagnostic"><Play size={16} /></button></RoleGuard>}
                                            {onEdit && <RoleGuard requiredRole={editRole || 'DPE_DEVELOPER'}>{row._readonly || row.source_type === 'static' ? <button style={{ opacity: 0.2, cursor: 'not-allowed' }} title="Read-only system resource"><Edit size={16} /></button> : <button onClick={() => onEdit(row)} style={{ color: 'var(--accent-primary)' }} title="Edit"><Edit size={16} /></button>}</RoleGuard>}
                                            {onDelete && <RoleGuard requiredRole={deleteRole || 'DPE_PLATFORM_ADMIN'}>{row._readonly || row.source_type === 'static' ? <button style={{ opacity: 0.2, cursor: 'not-allowed' }} title="Protected resource"><Trash2 size={16} /></button> : <button onClick={() => onDelete(row)} style={{ color: 'var(--error)' }} title="Delete"><Trash2 size={16} /></button>}</RoleGuard>}
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {totalCount !== undefined && limit !== undefined && offset !== undefined && onPageChange && onLimitChange && (
                <div className="sticky-pagination">
                    <Pagination
                        totalCount={totalCount}
                        limit={limit}
                        offset={offset}
                        onPageChange={onPageChange}
                        onLimitChange={onLimitChange}
                    />
                </div>
            )}
        </div>
    );
};
