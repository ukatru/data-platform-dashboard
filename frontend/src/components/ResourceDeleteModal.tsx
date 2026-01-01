import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Trash2 } from 'lucide-react';

interface ResourceDeleteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    resourceName: string; // The specific string user must type (e.g. "my-pipeline-01")
    resourceType: string; // e.g. "pipeline", "team", "schedule"
    title?: string;
    description?: string;
    loading?: boolean;
}

export const ResourceDeleteModal: React.FC<ResourceDeleteModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    resourceName,
    resourceType,
    title = `Delete ${resourceType}`,
    description = `This action cannot be undone. This will permanently delete the ${resourceType} and all associated data.`,
    loading = false
}) => {
    const [inputValue, setInputValue] = useState('');
    const [isMatch, setIsMatch] = useState(false);

    useEffect(() => {
        setIsMatch(inputValue.trim() === resourceName.trim());
    }, [inputValue, resourceName]);

    useEffect(() => {
        if (isOpen) {
            setInputValue('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.85)',
                backdropFilter: 'blur(10px)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1rem'
            }}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="glass"
                    style={{
                        width: '100%',
                        maxWidth: '500px',
                        padding: '2.5rem',
                        border: '1px solid rgba(255, 71, 71, 0.3)',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '12px',
                            background: 'rgba(255, 71, 71, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--error)'
                        }}>
                            <AlertTriangle size={24} />
                        </div>
                        <button onClick={onClose} className="btn-icon" style={{ color: 'var(--text-tertiary)' }}>
                            <X size={20} />
                        </button>
                    </div>

                    <h3 style={{ fontSize: '1.5rem', marginBottom: '0.75rem', fontWeight: 700 }}>{title}</h3>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.95rem', lineHeight: '1.5' }}>
                        {description}
                    </p>

                    <div style={{
                        background: 'rgba(255, 71, 71, 0.05)',
                        border: '1px solid rgba(255, 71, 71, 0.1)',
                        padding: '1rem',
                        borderRadius: '8px',
                        marginBottom: '2rem'
                    }}>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                            Please type <strong style={{ color: 'white' }}>{resourceName}</strong> to confirm.
                        </p>
                        <input
                            type="text"
                            className="nexus-input"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder={resourceName}
                            autoFocus
                            style={{
                                width: '100%',
                                borderColor: inputValue && !isMatch ? 'var(--error)' : 'var(--glass-border)',
                                fontSize: '1rem'
                            }}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button
                            className="btn-secondary"
                            onClick={onClose}
                            style={{ flex: 1 }}
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={!isMatch || loading}
                            style={{
                                flex: 2,
                                background: isMatch ? 'var(--error)' : 'rgba(255, 71, 71, 0.1)',
                                color: isMatch ? 'white' : 'rgba(255, 71, 71, 0.5)',
                                border: 'none',
                                padding: '0.75rem 1.5rem',
                                borderRadius: '8px',
                                fontWeight: 600,
                                cursor: isMatch ? 'pointer' : 'not-allowed',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                transition: 'all 0.2s'
                            }}
                        >
                            {loading ? 'Deleting...' : <><Trash2 size={18} /> Delete {resourceType}</>}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
