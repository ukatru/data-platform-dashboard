import axios, { InternalAxiosRequestConfig, AxiosResponse } from 'axios';

const API_BASE = '/api/v1';

const apiInstance = axios.create({
    baseURL: '',
});

// Axios Interceptors for Auth
apiInstance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token');
    const teamId = localStorage.getItem('currentTeamId');
    if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    if (teamId && config.headers) {
        config.headers['X-Team-Id'] = teamId;
    }
    return config;
});

apiInstance.interceptors.response.use(
    (response: AxiosResponse) => response,
    (error: any) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            if (!window.location.pathname.startsWith('/login')) {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export const api = {
    // Auth
    auth: {
        login: (formData: FormData) => apiInstance.post(`${API_BASE}/auth/login`, formData),
        me: () => apiInstance.get(`${API_BASE}/auth/me`),
    },

    // Users (Admin Only)
    users: {
        list: () => apiInstance.get(`${API_BASE}/users/`),
        create: (data: any) => apiInstance.post(`${API_BASE}/users/`, data),
        update: (id: number, data: any) => apiInstance.put(`${API_BASE}/users/${id}`, data),
        listRoles: () => apiInstance.get(`${API_BASE}/users/roles`),
        changePassword: (data: any) => apiInstance.post(`${API_BASE}/users/me/password`, data),
    },

    // Metadata
    metadata: {
        pipelines: () => apiInstance.get(`${API_BASE}/metadata/pipelines`),
        schedules: () => apiInstance.get(`${API_BASE}/metadata/schedules`),
        connections: () => apiInstance.get(`${API_BASE}/metadata/connections`),
        status: () => apiInstance.get(`${API_BASE}/metadata/status`),
        schemas: () => apiInstance.get(`${API_BASE}/metadata/schemas`),
        repositories: () => apiInstance.get(`${API_BASE}/metadata/repositories`),
        jobs: () => apiInstance.get(`${API_BASE}/metadata/jobs`),
    },

    // Connections
    connections: {
        list: () => apiInstance.get(`${API_BASE}/connections/`),
        get: (id: number) => apiInstance.get(`${API_BASE}/connections/${id}`),
        create: (data: any) => apiInstance.post(`${API_BASE}/connections/`, data),
        update: (id: number, data: any) => apiInstance.put(`${API_BASE}/connections/${id}`, data),
        delete: (id: number) => apiInstance.delete(`${API_BASE}/connections/${id}`),
        test: (id: number) => apiInstance.post(`${API_BASE}/connections/${id}/test`),
        testRaw: (data: any) => apiInstance.post(`${API_BASE}/connections/test-raw`, data),
        seed: () => apiInstance.post(`${API_BASE}/metadata/connections/seed`),
        listTypes: () => apiInstance.get(`${API_BASE}/metadata/connections/types`),
        getTypeSchema: (type: string) => apiInstance.get(`${API_BASE}/metadata/connections/types/${type}`),
    },

    // Schedules
    schedules: {
        list: () => apiInstance.get(`${API_BASE}/schedules/`),
        get: (id: number) => apiInstance.get(`${API_BASE}/schedules/${id}`),
        create: (data: any) => apiInstance.post(`${API_BASE}/schedules/`, data),
        update: (id: number, data: any) => apiInstance.put(`${API_BASE}/schedules/${id}`, data),
        delete: (id: number) => apiInstance.delete(`${API_BASE}/schedules/${id}`),
    },

    // Schemas
    schemas: {
        list: () => apiInstance.get(`${API_BASE}/schemas/`),
        get: (id: number) => apiInstance.get(`${API_BASE}/schemas/${id}`),
        getByJob: (jobName: string) => apiInstance.get(`${API_BASE}/schemas/by-job/${jobName}`),
        create: (data: any) => apiInstance.post(`${API_BASE}/schemas/`, data),
    },

    // Repositories (Code Locations)
    repositories: {
        list: () => apiInstance.get(`${API_BASE}/repositories/`),
        get: (id: number) => apiInstance.get(`${API_BASE}/repositories/${id}`),
        create: (data: any) => apiInstance.post(`${API_BASE}/repositories/`, data),
        update: (id: number, data: any) => apiInstance.put(`${API_BASE}/repositories/${id}`, data),
        delete: (id: number) => apiInstance.delete(`${API_BASE}/repositories/${id}`),
    },

    // Pipelines
    pipelines: {
        list: () => apiInstance.get(`${API_BASE}/pipelines/`),
        get: (id: number) => apiInstance.get(`${API_BASE}/pipelines/${id}`),
        create: (data: any) => apiInstance.post(`${API_BASE}/pipelines/`, data),
        update: (id: number, data: any) => apiInstance.put(`${API_BASE}/pipelines/${id}`, data),
        delete: (id: number) => apiInstance.delete(`${API_BASE}/pipelines/${id}`),
        getParams: (id: number) => apiInstance.get(`${API_BASE}/pipelines/${id}/params`),
        updateParams: (id: number, params: any) => apiInstance.put(`${API_BASE}/pipelines/${id}/params`, params),
        getSchema: (id: number) => apiInstance.get(`${API_BASE}/pipelines/${id}/schema`),
    },

    // Job Definitions
    jobs: {
        list: () => apiInstance.get(`${API_BASE}/jobs/`),
        get: (id: number) => apiInstance.get(`${API_BASE}/jobs/${id}`),
    },

    // Status
    status: {
        summary: (teamId?: number | null) =>
            apiInstance.get(`${API_BASE}/status/summary`, { params: { team_id: teamId } }),
        jobs: (filters?: { job_nm?: string; sts_cd?: string; limit?: number; team_id?: number | null }) =>
            apiInstance.get(`${API_BASE}/status/jobs`, { params: filters }),
        assets: (btchNbr: number) => apiInstance.get(`${API_BASE}/status/jobs/${btchNbr}/assets`),
    },

    // Management (SaaS Hierarchy)
    management: {
        listOrgs: () => apiInstance.get(`${API_BASE}/management/orgs`),
        getOrg: (id: number) => apiInstance.get(`${API_BASE}/management/orgs/${id}`),
        listTeams: () => apiInstance.get(`${API_BASE}/management/teams`),
        createTeam: (data: any) => apiInstance.post(`${API_BASE}/management/teams`, data),
        patchTeam: (id: number, data: any) => apiInstance.patch(`${API_BASE}/management/teams/${id}`, data),
        deleteTeam: (id: number) => apiInstance.delete(`${API_BASE}/management/teams/${id}`),
        listTeamMembers: (teamId: number) => apiInstance.get(`${API_BASE}/management/teams/${teamId}/members`),
        addTeamMember: (teamId: number, data: any) => apiInstance.post(`${API_BASE}/management/teams/${teamId}/members`, data),
        removeTeamMember: (teamId: number, userId: number) => apiInstance.delete(`${API_BASE}/management/teams/${teamId}/members/${userId}`),
        listCodeLocations: () => apiInstance.get(`${API_BASE}/management/code-locations`),
        registerCodeLocation: (data: any) => apiInstance.post(`${API_BASE}/management/code-locations`, data),
        patchCodeLocation: (id: number, data: any) => apiInstance.patch(`${API_BASE}/management/code-locations/${id}`, data),
        deleteCodeLocation: (id: number) => apiInstance.delete(`${API_BASE}/management/code-locations/${id}`),
    },

    // Reports
    reports: {
        accessMatrix: () => apiInstance.get(`${API_BASE}/reports/access-matrix`),
        exportAccessMatrix: () => `http://localhost:8000${API_BASE}/reports/access-matrix/csv`,
    },

    healthCheck: () => apiInstance.get(`${API_BASE}/`),
};

// Types for metadata-driven tables
export interface ColumnMetadata {
    name: string;
    label: string;
    data_type: 'string' | 'integer' | 'boolean' | 'datetime' | 'json';
    visible: boolean;
    sortable: boolean;
    filterable: boolean;
    render_hint?: 'text' | 'code' | 'badge' | 'datetime' | 'json' | 'link' | 'external_link';
    width?: string;
}

export interface TableMetadata {
    table_name: string;
    columns: ColumnMetadata[];
    primary_key: string;
}
