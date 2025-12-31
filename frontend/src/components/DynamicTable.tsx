import React from 'react';
import { Link } from 'react-router-dom';
import { Edit, Trash2, Copy, Play, FileText } from 'lucide-react';
import { ColumnMetadata } from '../services/api';
import { RoleName, useAuth } from '../contexts/AuthContext';
import { RoleGuard } from './RoleGuard';

interface DynamicTableProps {
    metadata: ColumnMetadata[];
    data: any[];
    onEdit?: (row: any) => void;
    onDelete?: (row: any) => void;
    onTest?: (row: any) => void;
    onView?: (row: any) => void;
    onLinkClick?: (row: any) => void;
    linkColumn?: string | string[];
    linkPath?: (row: any) => string;
    primaryKey: string;
    editRole?: RoleName;
    deleteRole?: RoleName;
    testRole?: RoleName;
    viewRole?: RoleName;
    emptyMessage?: string;
}

export const DynamicTable: React.FC<DynamicTableProps> = ({
    metadata,
    data,
    onEdit,
    onDelete,
    onTest,
    onView,
    onLinkClick,
    linkColumn,
    linkPath,
    primaryKey,
    editRole,
    deleteRole,
    testRole,
    viewRole,
    emptyMessage = "No records found"
}) => {
    const { hasPermission } = useAuth();
    const visibleColumns = metadata.filter(col => col.visible);

    const getPermissionForRole = (role?: RoleName) => {
        if (role === 'DPE_PLATFORM_ADMIN') return 'PLATFORM_ADMIN';
        if (role === 'DPE_DEVELOPER') return 'CAN_EDIT_PIPELINES';
        return 'CAN_VIEW_LOGS';
    };

    const isActionsVisible = (
        (onEdit && hasPermission(getPermissionForRole(editRole || 'DPE_DEVELOPER'))) ||
        (onDelete && hasPermission(getPermissionForRole(deleteRole || 'DPE_PLATFORM_ADMIN'))) ||
        (onTest && hasPermission(getPermissionForRole(testRole || 'DPE_DATA_ANALYST'))) ||
        (onView && hasPermission(getPermissionForRole(viewRole || 'DPE_DATA_ANALYST')))
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
        if (col.render_hint === 'link') {
            const isLinkCol = !linkColumn || linkColumn === col.name || (Array.isArray(linkColumn) && linkColumn.includes(col.name));
            if (isLinkCol) {
                const linkText = col.name === 'yaml_def' ? 'View YAML' : value;
                if (onLinkClick) {
                    return (
                        <button
                            onClick={() => onLinkClick(row)}
                            style={{ color: 'var(--accent-primary)', fontWeight: 600, padding: 0, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                            {linkText}
                        </button>
                    );
                }
                if (linkPath) {
                    return (
                        <Link
                            to={linkPath(row)}
                            style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 600 }}
                        >
                            {linkText}
                        </Link>
                    );
                }
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
            // Array of items (Multi-badge)
            if (Array.isArray(value)) {
                return (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {value.map((item: any, i: number) => (
                            <span key={i} className="status-badge" style={{ fontSize: '0.75rem', padding: '0.1rem 0.5rem' }}>
                                {item}
                            </span>
                        ))}
                    </div>
                );
            }
            // Default badge
            return <span className="status-badge">{value}</span>;
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

        // Default rendering with safety check
        if (typeof value === 'object') {
            return JSON.stringify(value);
        }
        return value;
    };

    return (
        <div className="glass" style={{ overflowX: 'auto' }}>
            <table style={{ minWidth: '1000px' }}>
                <thead>
                    <tr>
                        {visibleColumns.map(col => (
                            <th key={col.name} style={{ width: col.width || 'auto' }}>
                                {col.label}
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
                                <td key={col.name}>
                                    {renderCell(row, col)}
                                </td>
                            ))}
                            {isActionsVisible && (
                                <td>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        {onView && (
                                            <RoleGuard requiredRole={viewRole || 'DPE_DATA_ANALYST'}>
                                                <button onClick={() => onView(row)} style={{ color: 'var(--text-secondary)' }} title="View Definition">
                                                    <FileText size={16} />
                                                </button>
                                            </RoleGuard>
                                        )}
                                        {onTest && (
                                            <RoleGuard requiredRole={testRole || 'DPE_DATA_ANALYST'}>
                                                <button onClick={() => onTest(row)} style={{ color: 'var(--accent-secondary)' }} title="Test Connection">
                                                    <Play size={16} />
                                                </button>
                                            </RoleGuard>
                                        )}
                                        {onEdit && (
                                            <RoleGuard requiredRole={editRole || 'DPE_DEVELOPER'}>
                                                <button onClick={() => onEdit(row)} style={{ color: 'var(--accent-primary)' }} title="Edit">
                                                    <Edit size={16} />
                                                </button>
                                            </RoleGuard>
                                        )}
                                        {onDelete && (
                                            <RoleGuard requiredRole={deleteRole || 'DPE_PLATFORM_ADMIN'}>
                                                <button onClick={() => onDelete(row)} style={{ color: 'var(--error)' }} title="Delete">
                                                    <Trash2 size={16} />
                                                </button>
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
    );
};
