import React from 'react';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import { RJSFSchema, WidgetProps, FieldTemplateProps } from '@rjsf/utils';
import { motion } from 'framer-motion';

// --- Custom Premium Widgets ---

const CustomTextWidget = (props: WidgetProps) => {
    return (
        <input
            type="text"
            className="nexus-input"
            value={props.value || ''}
            required={props.required}
            disabled={props.disabled || props.readonly}
            onChange={(event) => props.onChange(event.target.value)}
            placeholder={props.placeholder}
        />
    );
};

const CustomSelectWidget = (props: WidgetProps) => {
    return (
        <select
            className="nexus-select"
            value={props.value}
            required={props.required}
            disabled={props.disabled || props.readonly}
            onChange={(event) => props.onChange(event.target.value)}
        >
            {!props.required && <option value="">Select...</option>}
            {props.options.enumOptions?.map((option: any, index: number) => (
                <option key={index} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    );
};

const CustomCheckboxWidget = (props: WidgetProps) => {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0' }}>
            <input
                type="checkbox"
                style={{ width: '1.25rem', height: '1.25rem', cursor: 'pointer' }}
                checked={!!props.value}
                disabled={props.disabled || props.readonly}
                onChange={(event) => props.onChange(event.target.checked)}
            />
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{props.label}</span>
        </div>
    );
};

// --- Custom Field Template for Layout ---

const CustomFieldTemplate = (props: FieldTemplateProps & { formContext?: any }) => {
    const { id, classNames, label, help, required, description, errors, children, schema, formContext } = props;
    const isCompact = formContext?.layout === 'compact';

    // Hide fieldsets for objects to keep it flat and clean
    if (schema.type === 'object' && !label) {
        return <div className={classNames}>{children}</div>;
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`${classNames} nexus-field-container ${isCompact ? 'compact' : ''}`}
            style={{ marginBottom: isCompact ? '0.75rem' : '1.5rem' }}
        >
            {label && (
                <label htmlFor={id} style={{
                    display: 'block',
                    marginBottom: isCompact ? '0.25rem' : '0.5rem',
                    fontSize: isCompact ? '0.75rem' : '0.85rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--accent-primary)'
                }}>
                    {label}{required ? '*' : ''}
                </label>
            )}
            {description && (
                <div style={{ fontSize: isCompact ? '0.7rem' : '0.8rem', color: 'var(--text-tertiary)', marginBottom: isCompact ? '0.5rem' : '0.75rem' }}>
                    {description}
                </div>
            )}
            {children}
            {errors}
            {help && <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', opacity: 0.6 }}>{help}</div>}
        </motion.div>
    );
};

interface GenericSchemaFormProps {
    schema: RJSFSchema;
    formData: any;
    onSubmit: (data: any) => void;
    onChange?: (data: any) => void;
    children?: React.ReactNode;
    customActions?: (formData: any) => React.ReactNode;
    readOnly?: boolean;
    layout?: 'default' | 'compact';
}

const customWidgets = {
    TextWidget: CustomTextWidget,
    SelectWidget: CustomSelectWidget,
    CheckboxWidget: CustomCheckboxWidget,
};

/**
 * A reusable wrapper around react-jsonschema-form with the dashboard's styling and validation.
 */
export const GenericSchemaForm: React.FC<GenericSchemaFormProps> = ({
    schema,
    formData: initialFormData,
    onSubmit,
    onChange,
    children,
    customActions,
    readOnly = false,
    layout = 'default'
}) => {
    const [localFormData, setLocalFormData] = React.useState(initialFormData);

    React.useEffect(() => {
        setLocalFormData(initialFormData);
    }, [initialFormData]);

    const handleChange = (data: any) => {
        setLocalFormData(data);
        if (onChange) onChange(data);
    };

    return (
        <div className={`dynamic-form nexus-theme ${layout === 'compact' ? 'compact' : ''}`}>
            <Form
                schema={schema}
                formData={localFormData}
                validator={validator}
                widgets={customWidgets}
                templates={{ FieldTemplate: CustomFieldTemplate }}
                formContext={{ layout }}
                onSubmit={({ formData }) => onSubmit(formData)}
                onChange={({ formData }) => handleChange(formData)}
                readonly={readOnly}
            >
                {readOnly ? (
                    <div />
                ) : (
                    children || customActions?.(localFormData) || (
                        <div style={{ marginTop: '2.5rem' }}>
                            <button type="submit" className="btn-primary" style={{
                                width: '100%',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '1rem'
                            }}>
                                Save Configuration
                            </button>
                        </div>
                    )
                )}
            </Form>

            <style>{`
                .nexus-theme .nexus-input, 
                .nexus-theme .nexus-select {
                    background: rgba(255, 255, 255, 0.03) !important;
                    border: 1px solid var(--glass-border) !important;
                    color: var(--text-primary) !important;
                    padding: 0.85rem 1rem !important;
                    border-radius: 8px !important;
                    font-size: 0.95rem !important;
                    width: 100% !important;
                    transition: all 0.2s ease !important;
                }

                .nexus-theme .nexus-input:focus, 
                .nexus-theme .nexus-select:focus {
                    background: rgba(99, 102, 241, 0.05) !important;
                    border-color: var(--accent-primary) !important;
                    box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.15) !important;
                    outline: none !important;
                }

                .nexus-theme .nexus-select option {
                    background-color: var(--bg-secondary);
                    color: var(--text-primary);
                }

                .nexus-theme .nexus-field-container {
                    background: rgba(255, 255, 255, 0.01);
                    padding: 1.25rem;
                    border-radius: 12px;
                    border: 1px solid transparent;
                    transition: all 0.2s ease;
                }

                .nexus-theme .nexus-field-container.compact {
                    padding: 0.85rem 1rem;
                }

                .nexus-theme .nexus-field-container:hover {
                    background: rgba(255, 255, 255, 0.03);
                    border-color: rgba(255, 255, 255, 0.05);
                }
            `}</style>
        </div>
    );
};
