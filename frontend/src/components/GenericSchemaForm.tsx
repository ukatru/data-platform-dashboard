import React from 'react';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import { RJSFSchema, WidgetProps, FieldTemplateProps } from '@rjsf/utils';

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
            style={{ width: '100%', display: 'block' }}
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
            style={{ width: '100%', display: 'block' }}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '1rem 0' }}>
            <input
                type="checkbox"
                style={{ width: '1.25rem', height: '1.25rem', cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
                checked={!!props.value}
                disabled={props.disabled || props.readonly}
                onChange={(event) => props.onChange(event.target.checked)}
            />
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{props.label}</span>
        </div>
    );
};

// --- Custom Field Template for Clean Layout ---

const CustomFieldTemplate = (props: FieldTemplateProps) => {
    const { id, classNames, label, help, required, description, errors, children, schema } = props;

    // Hide fieldsets for objects to keep it flat and clean
    if (schema.type === 'object' && !label) {
        return <div className="flat-object-container">{children}</div>;
    }

    return (
        <div className="nexus-field-container" style={{ marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {label && (
                <label
                    htmlFor={id}
                    className="nexus-label"
                    style={{
                        display: 'block',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: 'var(--text-secondary)',
                        opacity: 0.8
                    }}
                >
                    {label}{required ? '*' : ''}
                </label>
            )}

            {description && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '0.25rem', lineHeight: '1.5' }}>
                    {description}
                </div>
            )}

            <div className="field-content" style={{ width: '100%' }}>
                {children}
            </div>

            {errors && <div className="nexus-errors" style={{ marginTop: '0.25rem' }}>{errors}</div>}

            {help && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontStyle: 'italic', opacity: 0.6 }}>
                    {help}
                </div>
            )}
        </div>
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
                templates={{
                    FieldTemplate: CustomFieldTemplate,
                    ObjectFieldTemplate: (props) => <div>{props.properties.map(p => p.content)}</div>
                }}
                formContext={{ layout }}
                onSubmit={({ formData }) => onSubmit(formData)}
                onChange={({ formData }) => handleChange(formData)}
                readonly={readOnly}
            >
                {/* Always provide a child to prevent RJSF default button. Hide it if readOnly. */}
                {readOnly ? (
                    <div style={{ display: 'none' }} />
                ) : (
                    children || customActions?.(localFormData) || (
                        <div style={{ marginTop: '2.5rem' }}>
                            <button type="submit" className="btn-primary" style={{
                                width: '100%',
                                padding: '1rem',
                                fontSize: '0.95rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                            }}>
                                Save Configuration
                            </button>
                        </div>
                    )
                )}
            </Form>

            <style>{`
                /* Kill RJSF default styles that cause ghost borders and overlapping */
                .nexus-theme .form-group, 
                .nexus-theme .field,
                .nexus-theme fieldset {
                    border: none !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    box-shadow: none !important;
                    min-width: 0 !important;
                    position: static !important;
                }

                .nexus-theme legend {
                    display: none !important;
                }

                /* Premium Input Styling */
                .nexus-theme .nexus-input, 
                .nexus-theme .nexus-select {
                    background: rgba(0, 0, 0, 0.25) !important;
                    border: 1px solid rgba(255, 255, 255, 0.08) !important;
                    color: var(--text-primary) !important;
                    padding: 0.85rem 1.15rem !important;
                    border-radius: 10px !important;
                    font-size: 0.9rem !important;
                    width: 100% !important;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
                    outline: none !important;
                    display: block !important;
                }

                .nexus-theme .nexus-input:focus, 
                .nexus-theme .nexus-select:focus {
                    border-color: var(--accent-primary) !important;
                    box-shadow: 0 0 0 4px var(--accent-glow) !important;
                    background: rgba(0, 0, 0, 0.4) !important;
                }

                .nexus-theme .nexus-input:disabled,
                .nexus-theme .nexus-select:disabled {
                    opacity: 0.5 !important;
                    cursor: not-allowed !important;
                    background: rgba(255, 255, 255, 0.02) !important;
                }

                /* Error Styling */
                .nexus-theme .nexus-errors {
                    color: var(--error);
                    font-size: 0.75rem;
                    list-style: none;
                    margin-top: 0.5rem;
                }
                
                .nexus-theme .nexus-errors li {
                    display: flex;
                    align-items: center;
                    gap: 0.4rem;
                }
            `}</style>
        </div>
    );
};
