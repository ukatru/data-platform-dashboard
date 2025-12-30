import axios from 'axios';

const API_BASE = '/api/v1';

export const api = {
    // Metadata
    metadata: {
        pipelines: () => axios.get(`${API_BASE}/metadata/pipelines`),
        schedules: () => axios.get(`${API_BASE}/metadata/schedules`),
        connections: () => axios.get(`${API_BASE}/metadata/connections`),
        status: () => axios.get(`${API_BASE}/metadata/status`),
        schemas: () => axios.get(`${API_BASE}/metadata/schemas`),
    },

    // Connections
    connections: {
        list: () => axios.get(`${API_BASE}/connections/`),
        get: (id: number) => axios.get(`${API_BASE}/connections/${id}`),
        create: (data: any) => axios.post(`${API_BASE}/connections/`, data),
        update: (id: number, data: any) => axios.put(`${API_BASE}/connections/${id}`, data),
        delete: (id: number) => axios.delete(`${API_BASE}/connections/${id}`),
        test: (id: number) => axios.post(`${API_BASE}/connections/${id}/test`),
        testRaw: (data: any) => axios.post(`${API_BASE}/connections/test-raw`, data),
        seed: () => axios.post(`${API_BASE}/metadata/connections/seed`),
        listTypes: () => axios.get(`${API_BASE}/metadata/connections/types`),
        getTypeSchema: (type: string) => axios.get(`${API_BASE}/metadata/connections/types/${type}`),
    },

    // Schedules
    schedules: {
        list: () => axios.get(`${API_BASE}/schedules/`),
        get: (id: number) => axios.get(`${API_BASE}/schedules/${id}`),
        create: (data: any) => axios.post(`${API_BASE}/schedules/`, data),
        update: (id: number, data: any) => axios.put(`${API_BASE}/schedules/${id}`, data),
        delete: (id: number) => axios.delete(`${API_BASE}/schedules/${id}`),
    },

    // Schemas
    schemas: {
        list: () => axios.get(`${API_BASE}/schemas/`),
        get: (id: number) => axios.get(`${API_BASE}/schemas/${id}`),
        getByJob: (jobName: string) => axios.get(`${API_BASE}/schemas/by-job/${jobName}`),
        create: (data: any) => axios.post(`${API_BASE}/schemas/`, data),
    },

    // Pipelines
    pipelines: {
        list: () => axios.get(`${API_BASE}/pipelines/`),
        get: (id: number) => axios.get(`${API_BASE}/pipelines/${id}`),
        create: (data: any) => axios.post(`${API_BASE}/pipelines/`, data),
        update: (id: number, data: any) => axios.put(`${API_BASE}/pipelines/${id}`, data),
        delete: (id: number) => axios.delete(`${API_BASE}/pipelines/${id}`),
        getParams: (id: number) => axios.get(`${API_BASE}/pipelines/${id}/params`),
        updateParams: (id: number, params: any) => axios.put(`${API_BASE}/pipelines/${id}/params`, params),
        getSchema: (id: number) => axios.get(`${API_BASE}/pipelines/${id}/schema`),
    },

    // Status
    status: {
        summary: () => axios.get(`${API_BASE}/status/summary`),
        jobs: (filters?: { job_nm?: string; sts_cd?: string; limit?: number }) =>
            axios.get(`${API_BASE}/status/jobs`, { params: filters }),
        assets: (btchNbr: number) => axios.get(`${API_BASE}/status/jobs/${btchNbr}/assets`),
    },
};

// Types for metadata-driven tables
export interface ColumnMetadata {
    name: string;
    label: string;
    data_type: 'string' | 'integer' | 'boolean' | 'datetime' | 'json';
    visible: boolean;
    sortable: boolean;
    filterable: boolean;
    render_hint?: 'text' | 'code' | 'badge' | 'datetime' | 'json' | 'link';
    width?: string;
}

export interface TableMetadata {
    table_name: string;
    columns: ColumnMetadata[];
    primary_key: string;
}
