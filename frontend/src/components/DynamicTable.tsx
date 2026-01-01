import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Edit, Trash2, Copy, Play, Lock, Puzzle, Settings, Check } from 'lucide-react';
import { ColumnMetadata } from '../services/api';
import { RoleName, useAuth } from '../contexts/AuthContext';
import { RoleGuard } from './RoleGuard';

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
    emptyMessage = "No records found"
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
            if (col.width) {
                initial[col.name] = parseInt(col.width);
            } else {
                initial[col.name] = 150; // Default
            }
        });
        return initial;
    });

    const [showSettings, setShowSettings] = useState(false);
    const settingsRef = useRef<HTMLDivElement>(null);
    const resizingColumn = useRef<string | null>(null);
    const startX = useRef<number>(0);
    const startWidth = useRef<number>(0);

    const visibleColumns = metadata.filter(col => columnVisibility[col.name]);

    // Handle clicks outside settings menu
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
                setShowSettings(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Column Resizing Logic
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

        setWidths(prev => ({
            ...prev,
            [resizingColumn.current!]: newWidth
        }));
    };

    const handleResizeEnd = () => {
        resizingColumn.current = null;
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
        document.body.style.cursor = 'default';
    };

    const toggleColumn = (colName: string) => {
        setColumnVisibility(prev => ({
            ...prev,
            [colName]: !prev[colName]
        }));
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
        alert('Copied!');
    };

    const renderCell = (row: any, col: ColumnMetadata) => {
        const value = row[col.name];

        if (value === null || value === undefined) {
            return <span style={{ color: 'var(--text-secondary)' }}>—</span>;
        }

        // Link rendering
        if (col.render_hint === 'link' && linkColumn === col.name) {
            if (onLinkClick) {
                return (
                    <button
                        onClick={() => onLinkClick(row)}
                        style={{ color: 'var(--accent-primary)', fontWeight: 600, padding: 0, textAlign: 'left' }}
                    >
                        {value}
                    </button>
                );
            }
            if (linkPath) {
                return (
                    <Link
                        to={linkPath(row)}
                        style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                        {col.name === 'job_nm' && row.source_type === 'static' && <Lock size={14} style={{ opacity: 0.7 }} />}
                        {col.name === 'job_nm' && row.source_type === 'instance' && <Puzzle size={14} style={{ opacity: 0.7 }} />}
                        {value}
                    </Link>
                );
            }
        }

        // External link rendering
        if (col.render_hint === 'external_link' && value) {
            return (
                <a
                    href={value}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                        color: 'var(--accent-primary)',
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                    }}
                >
                    {value}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                    </svg>
                </a>
            );
        }

        // Code rendering
        if (col.render_hint === 'code') {
            return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <code
                        style={{
                            fontFamily: 'monospace',
                            fontSize: '0.85rem',
                            background: 'var(--glass-bg)',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            flex: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }}
                        title={value}
                    >
                        {value}
                    </code>
                    {col.name === 'run_id' && (
                        <button
                            onClick={() => copyToClipboard(value)}
                            style={{ padding: '0.25rem', opacity: 0.6 }}
                            title="Copy full value"
                        >
                            <Copy size={14} />
                        </button>
                    )}
                </div>
            );
        }

        // Badge rendering
        if (col.render_hint === 'badge') {
            if (col.data_type === 'boolean') {
                return (
                    <span className={value ? 'status-success' : 'status-error'}>
                        {value ? 'Active' : 'Inactive'}
                    </span>
                );
            }
            // Status codes
            if (col.name === 'btch_sts_cd') {
                const statusMap: any = {
                    'R': { label: 'Running', className: 'status-running' },
                    'C': { label: 'Success', className: 'status-success' },
                    'A': { label: 'Failed', className: 'status-error' },
                };
                const status = statusMap[value] || { label: value, className: 'status-badge' };
                return <span className={status.className}>{status.label}</span>;
            }
            // Default badge
            return (
                <span className="status-badge" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    {col.name === 'source' ? (
                        <span style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.2rem 0.6rem',
                            borderRadius: '100px',
                            background: row.creat_by_nm === 'ParamsDagsterFactory.Sync' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(148, 163, 184, 0.1)',
                            border: `1px solid ${row.creat_by_nm === 'ParamsDagsterFactory.Sync' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.2)'}`
                        }}>
                            <div style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: row.creat_by_nm === 'ParamsDagsterFactory.Sync' ? 'var(--success)' : '#94a3b8',
                                boxShadow: row.creat_by_nm === 'ParamsDagsterFactory.Sync' ? '0 0 8px rgba(16, 185, 129, 0.4)' : 'none'
                            }} />
                            <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                                {row.creat_by_nm === 'ParamsDagsterFactory.Sync' ? 'GIT' : 'PORTAL'}
                            </span>
                        </span>
                    ) : (
                        <>
                            {col.name === 'source_type' && value === 'static' && <Lock size={12} />}
                            {col.name === 'source_type' && value === 'instance' && <Puzzle size={12} />}
                            {value && typeof value === 'string' && value.length > 0 && (
                                <span>{value.charAt(0).toUpperCase() + value.slice(1)}</span>
                            )}
                        </>
                    )}
                </span>
            );
        }

        // DateTime rendering
        if (col.render_hint === 'datetime' || col.data_type === 'datetime') {
            return (
                <span style={{ fontSize: '0.85rem' }}>
                    {new Date(value).toLocaleDateString()}
                </span>
            );
        }

        // Integer with special formatting
        if (col.data_type === 'integer') {
            if (col.name === 'schedule_id' && value) {
                return `Schedule #${value}`;
            }
            if (col.name === 'btch_nbr') {
                return <span style={{ fontWeight: 600 }}>#{value}</span>;
            }
            return value;
        }

        // Default string rendering
        return value;
    };

    return (
        <div className="glass" style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '1rem' }}>
                <div ref={settingsRef} style={{ position: 'relative' }}>
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className="btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem' }}
                        title="Column Settings"
                    >
                        <Settings size={18} />
                    </button>

                    {showSettings && (
                        <div className="glass" style={{
                            position: 'absolute',
                            top: 'calc(100% + 10px)',
                            right: 0,
                            zIndex: 1000,
                            padding: '1.25rem',
                            minWidth: '220px',
                            background: '#1a1f2e', // Solid dark background for clarity
                            boxShadow: '0 15px 35px rgba(0,0,0,0.8), 0 5px 15px rgba(0,0,0,0.5)',
                            border: '1px solid var(--accent-primary)',
                            borderRadius: '12px',
                            backdropFilter: 'none' // Remove blur for maximum clarity in dropdown
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem' }}>
                                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>Visible Columns</h4>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                                {metadata.map(col => (
                                    <label
                                        key={col.name}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.85rem',
                                            cursor: 'pointer',
                                            fontSize: '0.85rem',
                                            padding: '0.4rem 0.5rem',
                                            borderRadius: '6px',
                                            transition: 'background 0.2s',
                                            background: 'rgba(255,255,255,0.03)'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                                    >
                                        <div style={{
                                            width: '20px',
                                            height: '20px',
                                            borderRadius: '5px',
                                            border: `1px solid ${columnVisibility[col.name] ? 'var(--accent-primary)' : 'var(--glass-border)'}`,
                                            background: columnVisibility[col.name] ? 'var(--accent-primary)' : 'transparent',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'all 0.2s'
                                        }}>
                                            {columnVisibility[col.name] && <Check size={14} color="white" strokeWidth={3} />}
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={columnVisibility[col.name]}
                                            onChange={() => toggleColumn(col.name)}
                                            style={{ display: 'none' }}
                                        />
                                        <span style={{ color: columnVisibility[col.name] ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                            {col.label}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
                <table style={{ minWidth: '1000px', tableLayout: 'fixed' }}>
                    <thead>
                        <tr>
                            {visibleColumns.map(col => (
                                <th
                                    key={col.name}
                                    style={{
                                        width: `${widths[col.name] || 150}px`,
                                        position: 'relative'
                                    }}
                                >
                                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {col.label}
                                    </div>
                                    <div
                                        onMouseDown={(e) => handleResizeStart(e, col.name)}
                                        style={{
                                            position: 'absolute',
                                            right: 0,
                                            top: 0,
                                            bottom: 0,
                                            width: '4px',
                                            cursor: 'col-resize',
                                            zIndex: 10
                                        }}
                                        className="resize-handle"
                                    />
                                </th>
                            ))}
                            {isActionsVisible && <th style={{ width: '120px' }}>Actions</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {data.length === 0 ? (
                            <tr>
                                <td colSpan={visibleColumns.length + (isActionsVisible ? 1 : 0)} style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-tertiary)' }}>
                                    {emptyMessage}
                                </td>
                            </tr>
                        ) : data.map((row) => (
                            <tr key={row[primaryKey]}>
                                {visibleColumns.map(col => (
                                    <td key={col.name} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={String(row[col.name] || '')}>
                                        {renderCell(row, col)}
                                    </td>
                                ))}
                                {isActionsVisible && (
                                    <td>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            {onTest && (
                                                <RoleGuard requiredRole={testRole || 'DPE_DATA_ANALYST'}>
                                                    <button onClick={() => onTest(row)} style={{ color: 'var(--accent-secondary)' }} title="Test Connection">
                                                        <Play size={16} />
                                                    </button>
                                                </RoleGuard>
                                            )}
                                            {onEdit && (
                                                <RoleGuard requiredRole={editRole || 'DPE_DEVELOPER'}>
                                                    {row._readonly || row.source_type === 'static' ? (
                                                        <button style={{ color: 'var(--text-secondary)', opacity: 0.3, cursor: 'not-allowed' }} title="This item is managed in code and cannot be edited via Portal">
                                                            <Edit size={16} />
                                                        </button>
                                                    ) : (
                                                        <button onClick={() => onEdit(row)} style={{ color: 'var(--accent-primary)' }} title="Edit">
                                                            <Edit size={16} />
                                                        </button>
                                                    )}
                                                </RoleGuard>
                                            )}
                                            {onDelete && (
                                                <RoleGuard requiredRole={deleteRole || 'DPE_PLATFORM_ADMIN'}>
                                                    {row._readonly || row.source_type === 'static' ? (
                                                        <button style={{ color: 'var(--text-secondary)', opacity: 0.3, cursor: 'not-allowed' }} title="This item is managed in code and cannot be deleted via Portal">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    ) : (
                                                        <button onClick={() => onDelete(row)} style={{ color: 'var(--error)' }} title="Delete">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </RoleGuard>
                                            )}
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
