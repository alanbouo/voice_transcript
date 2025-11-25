import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

const SettingsModal = ({ isOpen, onClose }) => {
    const [systemPrompt, setSystemPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen) {
            fetchSettings();
        }
    }, [isOpen]);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const response = await api.get('/settings');
            setSystemPrompt(response.data.system_prompt_template || '');
        } catch (err) {
            console.error('Failed to fetch settings:', err);
            setError('Failed to load settings');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        try {
            await api.put('/settings', {
                system_prompt_template: systemPrompt || null
            });
            onClose();
        } catch (err) {
            console.error('Failed to save settings:', err);
            setError('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        setSystemPrompt('');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Settings</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        ✕
                    </button>
                </div>

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                        {error}
                    </div>
                )}

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        System Prompt Template
                    </label>
                    <p className="text-sm text-gray-500 mb-2">
                        Customize how the AI behaves. Use <code>{'{transcript}'}</code> as a placeholder for the transcript text.
                        Leave empty to use the default prompt.
                    </p>
                    <textarea
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                        className="w-full h-48 p-2 border rounded-md font-mono text-sm"
                        placeholder="You are a helpful assistant... Here is the transcript: {transcript}"
                        disabled={loading}
                    />
                </div>

                <div className="flex justify-between items-center">
                    <button
                        onClick={handleReset}
                        className="text-sm text-gray-600 hover:text-gray-800 underline"
                        disabled={loading || saving}
                    >
                        Reset to Default
                    </button>

                    <div className="space-x-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 border rounded-md hover:bg-gray-50"
                            disabled={saving}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                            disabled={loading || saving}
                        >
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
