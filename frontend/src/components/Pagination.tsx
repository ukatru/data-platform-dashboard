import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
    totalCount: number;
    limit: number;
    offset: number;
    onPageChange: (newOffset: number) => void;
    onLimitChange: (newLimit: number) => void;
    pageSizeOptions?: number[];
}

export const Pagination: React.FC<PaginationProps> = ({
    totalCount,
    limit,
    offset,
    onPageChange,
    onLimitChange,
    pageSizeOptions = [10, 25, 50, 100]
}) => {
    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(totalCount / limit) || 1;

    const handleFirstPage = () => onPageChange(0);
    const handlePrevPage = () => onPageChange(Math.max(0, offset - limit));
    const handleNextPage = () => onPageChange(Math.min((totalPages - 1) * limit, offset + limit));
    const handleLastPage = () => onPageChange((totalPages - 1) * limit);

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 1.5rem',
            background: 'rgba(0,0,0,0.1)',
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
            fontSize: '0.85rem',
            color: 'var(--text-tertiary)'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontWeight: 500, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rows per page</span>
                    <select
                        value={limit}
                        onChange={(e) => onLimitChange(parseInt(e.target.value))}
                        className="premium-input"
                        style={{
                            width: '70px',
                            padding: '0.2rem 0.4rem',
                            fontSize: '0.8rem',
                            background: 'rgba(0,0,0,0.3)',
                            border: '1px solid rgba(255,255,255,0.05)',
                            borderRadius: '4px',
                            color: 'var(--text-primary)',
                            outline: 'none',
                            cursor: 'pointer'
                        }}
                    >
                        {pageSizeOptions.map(option => (
                            <option key={option} value={option}>{option}</option>
                        ))}
                    </select>
                </div>
                <div style={{
                    height: '16px',
                    width: '1px',
                    background: 'rgba(255,255,255,0.05)'
                }} />
                <div>
                    Showing <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{Math.min(offset + 1, totalCount)}</span> – <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{Math.min(offset + limit, totalCount)}</span> of <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{totalCount}</span>
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ fontWeight: 500 }}>
                    Page <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{currentPage}</span> of <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{totalPages}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button
                        className="hover-elevate"
                        onClick={handleFirstPage}
                        disabled={currentPage === 1}
                        style={{ padding: '0.3rem', borderRadius: '4px', opacity: currentPage === 1 ? 0.3 : 1 }}
                    >
                        <ChevronsLeft size={16} />
                    </button>
                    <button
                        className="hover-elevate"
                        onClick={handlePrevPage}
                        disabled={currentPage === 1}
                        style={{ padding: '0.3rem', borderRadius: '4px', opacity: currentPage === 1 ? 0.3 : 1 }}
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <button
                        className="hover-elevate"
                        onClick={handleNextPage}
                        disabled={currentPage === totalPages}
                        style={{ padding: '0.3rem', borderRadius: '4px', opacity: currentPage === totalPages ? 0.3 : 1 }}
                    >
                        <ChevronRight size={16} />
                    </button>
                    <button
                        className="hover-elevate"
                        onClick={handleLastPage}
                        disabled={currentPage === totalPages}
                        style={{ padding: '0.3rem', borderRadius: '4px', opacity: currentPage === totalPages ? 0.3 : 1 }}
                    >
                        <ChevronsRight size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};
