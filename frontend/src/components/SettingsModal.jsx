import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

const SettingsModal = ({ isOpen, onClose }) => {
    const [systemPrompt, setSystemPrompt] = useState('');
    const [defaultUserPrompt, setDefaultUserPrompt] = useState('');
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
            setDefaultUserPrompt(response.data.default_user_prompt || '');
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
                system_prompt_template: systemPrompt || null,
                default_user_prompt: defaultUserPrompt || null
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
        setDefaultUserPrompt('');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Settings</h2>
                    <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                        ✕
                    </button>
                </div>

                {error && (
                    <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded mb-4">
                        {error}
                    </div>
                )}

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        System Prompt Template
                    </label>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                        Customize how the AI behaves. Use <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{'{transcript}'}</code> as a placeholder for the transcript text.
                        Leave empty to use the default prompt.
                    </p>
                    <textarea
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                        className="w-full h-32 p-2 border border-gray-300 dark:border-gray-600 rounded-md font-mono text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="You are a helpful assistant... Here is the transcript: {transcript}"
                        disabled={loading}
                    />
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Default User Prompt
                    </label>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                        This message will be automatically sent as the first message in every chat.
                        Leave empty to start with an empty chat.
                    </p>
                    <textarea
                        value={defaultUserPrompt}
                        onChange={(e) => setDefaultUserPrompt(e.target.value)}
                        className="w-full h-24 p-2 border border-gray-300 dark:border-gray-600 rounded-md font-mono text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="Summarize the main points of this transcript"
                        disabled={loading}
                    />
                </div>

                <div className="flex justify-between items-center">
                    <button
                        onClick={handleReset}
                        className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 underline"
                        disabled={loading || saving}
                    >
                        Reset to Default
                    </button>

                    <div className="space-x-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                            disabled={saving}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
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
