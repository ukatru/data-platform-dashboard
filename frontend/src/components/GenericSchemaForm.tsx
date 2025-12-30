import React from 'react';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import { RJSFSchema } from '@rjsf/utils';

interface GenericSchemaFormProps {
    schema: RJSFSchema;
    formData: any;
    onSubmit: (data: any) => void;
    onChange?: (data: any) => void;
    children?: React.ReactNode;
    customActions?: (formData: any) => React.ReactNode;
}

/**
 * A reusable wrapper around react-jsonschema-form with the dashboard's styling and validation.
 */
export const GenericSchemaForm: React.FC<GenericSchemaFormProps> = ({
    schema,
    formData: initialFormData,
    onSubmit,
    onChange,
    children,
    customActions
}) => {
    const [localFormData, setLocalFormData] = React.useState(initialFormData);

    // Sync local state when external formData changes (e.g. when switching types or loading)
    React.useEffect(() => {
        setLocalFormData(initialFormData);
    }, [initialFormData]);

    const handleChange = (data: any) => {
        setLocalFormData(data);
        if (onChange) onChange(data);
    };

    return (
        <div className="dynamic-form">
            <Form
                schema={schema}
                formData={localFormData}
                validator={validator}
                onSubmit={({ formData }) => onSubmit(formData)}
                onChange={({ formData }) => handleChange(formData)}
            >
                {children || customActions?.(localFormData) || (
                    <div style={{ marginTop: '2rem' }}>
                        <button type="submit" className="btn-primary" style={{ width: '100%' }}>
                            Save Configuration
                        </button>
                    </div>
                )}
            </Form>
        </div>
    );
};
