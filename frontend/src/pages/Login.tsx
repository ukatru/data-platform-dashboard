import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';

export const Login: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const from = (location.state as any)?.from?.pathname || '/';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const formData = new FormData();
            formData.append('username', username);
            formData.append('password', password);

            const response = await api.auth.login(formData);
            const { access_token } = response.data;

            // Get user info
            // Set token temporarily to fetch user info
            localStorage.setItem('token', access_token);
            const userResponse = await api.auth.me();

            login(access_token, userResponse.data);
            navigate(from, { replace: true });
        } catch (err: any) {
            console.error('Login error', err);
            setError(err.response?.data?.detail || 'Login failed. Please check your credentials.');
            localStorage.removeItem('token');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-header">
                    <div className="login-logo">🛰️</div>
                    <h1>Nexus Control</h1>
                    <p>Enter your credentials to access the platform</p>
                </div>

                <form onSubmit={handleSubmit} className="login-form">
                    {error && <div className="login-error">{error}</div>}

                    <div className="form-group">
                        <label>Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="username"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <button type="submit" className="login-button" disabled={loading}>
                        {loading ? 'Authenticating...' : 'Sign In'}
                    </button>
                </form>

                <div className="login-footer">
                    <p>© 2025 Data Platform Engineering</p>
                </div>
            </div>

            <style>{`
                .login-page {
                    height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: radial-gradient(circle at top left, #1a1c2c, #0d0e14);
                    font-family: 'Inter', system-ui, sans-serif;
                }

                .login-card {
                    width: 100%;
                    max-width: 400px;
                    padding: 2.5rem;
                    background: rgba(255, 255, 255, 0.03);
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 24px;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                }

                .login-header {
                    text-align: center;
                    margin-bottom: 2rem;
                }

                .login-logo {
                    font-size: 3rem;
                    margin-bottom: 1rem;
                }

                .login-header h1 {
                    color: white;
                    font-size: 1.75rem;
                    font-weight: 700;
                    margin: 0;
                    letter-spacing: -0.025em;
                }

                .login-header p {
                    color: #94a3b8;
                    font-size: 0.875rem;
                    margin-top: 0.5rem;
                }

                .login-form {
                    display: flex;
                    flex-direction: column;
                    gap: 1.25rem;
                }

                .login-error {
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid rgba(239, 68, 68, 0.2);
                    color: #f87171;
                    padding: 0.75rem;
                    border-radius: 12px;
                    font-size: 0.875rem;
                    text-align: center;
                }

                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .form-group label {
                    color: #e2e8f0;
                    font-size: 0.875rem;
                    font-weight: 500;
                }

                .form-group input {
                    background: rgba(0, 0, 0, 0.2);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 12px;
                    padding: 0.75rem 1rem;
                    color: white;
                    font-size: 1rem;
                    transition: all 0.2s;
                }

                .form-group input:focus {
                    outline: none;
                    border-color: #6366f1;
                    background: rgba(0, 0, 0, 0.3);
                    box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
                }

                .login-button {
                    background: #6366f1;
                    color: white;
                    border: none;
                    border-radius: 12px;
                    padding: 0.75rem;
                    font-size: 1rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    margin-top: 0.5rem;
                }

                .login-button:hover {
                    background: #4f46e5;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
                }

                .login-button:active {
                    transform: translateY(0);
                }

                .login-button:disabled {
                    opacity: 0.7;
                    cursor: not-allowed;
                    transform: none;
                }

                .login-footer {
                    margin-top: 2rem;
                    text-align: center;
                    color: #64748b;
                    font-size: 0.75rem;
                }
            `}</style>
        </div>
    );
};
