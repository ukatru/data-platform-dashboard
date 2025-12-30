import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { PipelineList } from './pages/Pipelines/PipelineList';
import { PipelineDetail } from './pages/Pipelines/PipelineDetail';
import { ConnectionList } from './pages/Connections/ConnectionList';
import { ScheduleList } from './pages/Schedules/ScheduleList';
import { SchemaList } from './pages/Schemas/SchemaList';
import { StatusDashboard } from './pages/Status/StatusDashboard';
import './index.css';

function App() {
    return (
        <BrowserRouter>
            <div className="layout">
                <Sidebar />
                <main className="main-content">
                    <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/pipelines" element={<PipelineList />} />
                        <Route path="/pipelines/:id" element={<PipelineDetail />} />
                        <Route path="/connections" element={<ConnectionList />} />
                        <Route path="/schedules" element={<ScheduleList />} />
                        <Route path="/schemas" element={<SchemaList />} />
                        <Route path="/status" element={<StatusDashboard />} />
                        <Route path="/admin" element={<div>Admin (Coming Soon)</div>} />
                    </Routes>
                </main>
            </div>
        </BrowserRouter>
    );
}

export default App;
