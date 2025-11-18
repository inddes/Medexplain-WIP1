import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Layout from '../components/Layout';
import { Plus, Trash2, Edit2, Database, FileText, Play, Loader } from 'lucide-react';

interface Source {
  id: string;
  name: string;
  url: string;
  description: string;
  is_active: boolean;
}

interface IngestionJob {
  id: string;
  job_type: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  records_processed: number;
  error_message: string | null;
  created_at: string;
}

interface AuditLogEntry {
  id: string;
  action: string;
  table_name: string;
  created_at: string;
  user_id: string;
}

interface Stats {
  totalDrugs: number;
  totalGenes: number;
  totalGuidelines: number;
}

export default function Admin() {
  const [activeTab, setActiveTab] = useState<'sources' | 'jobs' | 'audit'>('sources');
  const [sources, setSources] = useState<Source[]>([]);
  const [jobs, setJobs] = useState<IngestionJob[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [stats, setStats] = useState<Stats>({ totalDrugs: 0, totalGenes: 0, totalGuidelines: 0 });
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSource, setEditingSource] = useState<Source | null>(null);
  const [webhookLoading, setWebhookLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    url: '',
    description: '',
    is_active: true
  });

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  async function fetchData() {
    setLoading(true);
    try {
      if (activeTab === 'sources') {
        await fetchSources();
      } else if (activeTab === 'jobs') {
        await fetchJobs();
      } else if (activeTab === 'audit') {
        await fetchAuditLog();
      }
      await fetchStats();
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchSources() {
    const { data, error } = await supabase
      .from('sources')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    setSources(data || []);
  }

  async function fetchJobs() {
    const { data, error } = await supabase
      .from('ingestion_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    setJobs(data || []);
  }

  async function fetchAuditLog() {
    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    setAuditLog(data || []);
  }

  async function fetchStats() {
    const [drugsRes, genesRes, guidelinesRes] = await Promise.all([
      supabase.from('drugs').select('id', { count: 'exact', head: true }),
      supabase.from('genes').select('id', { count: 'exact', head: true }),
      supabase.from('guidelines').select('id', { count: 'exact', head: true })
    ]);

    setStats({
      totalDrugs: drugsRes.count || 0,
      totalGenes: genesRes.count || 0,
      totalGuidelines: guidelinesRes.count || 0
    });
  }

  async function handleSubmitSource(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editingSource) {
        const { error } = await supabase
          .from('sources')
          .update(formData)
          .eq('id', editingSource.id);

        if (error) throw error;
        showToast('Source updated successfully', 'success');
      } else {
        const { error } = await supabase
          .from('sources')
          .insert([formData]);

        if (error) throw error;
        showToast('Source added successfully', 'success');
      }

      setShowAddModal(false);
      setEditingSource(null);
      setFormData({ name: '', url: '', description: '', is_active: true });
      fetchSources();
    } catch (err: any) {
      showToast(err.message || 'Failed to save source', 'error');
    }
  }

  async function handleDeleteSource(id: string) {
    if (!confirm('Are you sure you want to delete this source?')) return;

    try {
      const { error } = await supabase
        .from('sources')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showToast('Source deleted successfully', 'success');
      fetchSources();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete source', 'error');
    }
  }

  function handleEditSource(source: Source) {
    setEditingSource(source);
    setFormData({
      name: source.name,
      url: source.url || '',
      description: source.description || '',
      is_active: source.is_active
    });
    setShowAddModal(true);
  }

  async function triggerWebhook(jobType: string, webhookUrl: string) {
    setWebhookLoading(jobType);
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_type: jobType, triggered_at: new Date().toISOString() })
      });

      if (!response.ok) throw new Error('Webhook failed');

      await supabase.from('ingestion_jobs').insert([{
        job_type: jobType,
        status: 'pending',
        started_at: new Date().toISOString()
      }]);

      showToast(`${jobType} triggered successfully`, 'success');
      fetchJobs();
    } catch (err: any) {
      showToast(err.message || 'Failed to trigger webhook', 'error');
    } finally {
      setWebhookLoading(null);
    }
  }

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  function formatDateTime(dateString: string | null) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-6">Admin Dashboard</h2>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Database className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Drugs</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalDrugs}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-pink-100 rounded-lg">
                <Database className="w-6 h-6 text-pink-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Genes</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalGenes}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-red-100 rounded-lg">
                <FileText className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Guidelines</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalGuidelines}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex">
              <button
                onClick={() => setActiveTab('sources')}
                className={`px-6 py-4 font-medium transition ${
                  activeTab === 'sources'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Sources
              </button>
              <button
                onClick={() => setActiveTab('jobs')}
                className={`px-6 py-4 font-medium transition ${
                  activeTab === 'jobs'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Ingestion Jobs
              </button>
              <button
                onClick={() => setActiveTab('audit')}
                className={`px-6 py-4 font-medium transition ${
                  activeTab === 'audit'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Audit Log
              </button>
            </nav>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading...</p>
              </div>
            ) : (
              <>
                {activeTab === 'sources' && (
                  <div>
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-semibold text-gray-900">Data Sources</h3>
                      <button
                        onClick={() => {
                          setShowAddModal(true);
                          setEditingSource(null);
                          setFormData({ name: '', url: '', description: '', is_active: true });
                        }}
                        className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                      >
                        <Plus className="w-5 h-5" />
                        <span>Add Source</span>
                      </button>
                    </div>

                    {sources.length === 0 ? (
                      <p className="text-gray-600 text-center py-8">No sources found</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-3 px-4 font-semibold text-gray-700">Name</th>
                              <th className="text-left py-3 px-4 font-semibold text-gray-700">URL</th>
                              <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                              <th className="text-right py-3 px-4 font-semibold text-gray-700">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sources.map((source) => (
                              <tr key={source.id} className="border-b border-gray-100">
                                <td className="py-3 px-4 font-medium text-gray-900">{source.name}</td>
                                <td className="py-3 px-4 text-gray-600 text-sm truncate max-w-xs">
                                  {source.url || 'N/A'}
                                </td>
                                <td className="py-3 px-4">
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    source.is_active
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-gray-100 text-gray-700'
                                  }`}>
                                    {source.is_active ? 'Active' : 'Inactive'}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right space-x-2">
                                  <button
                                    onClick={() => handleEditSource(source)}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition inline-flex"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSource(source.id)}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition inline-flex"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'jobs' && (
                  <div>
                    <div className="mb-6">
                      <h3 className="text-xl font-semibold text-gray-900 mb-4">Trigger Ingestion</h3>
                      <div className="grid md:grid-cols-3 gap-4">
                        <button
                          onClick={() => triggerWebhook('FDA Ingestion', 'YOUR_N8N_FDA_WEBHOOK_URL')}
                          disabled={webhookLoading !== null}
                          className="flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-3 rounded-lg hover:from-blue-600 hover:to-blue-700 transition disabled:opacity-50"
                        >
                          {webhookLoading === 'FDA Ingestion' ? (
                            <Loader className="w-5 h-5 animate-spin" />
                          ) : (
                            <Play className="w-5 h-5" />
                          )}
                          <span>Run FDA Ingestion</span>
                        </button>

                        <button
                          onClick={() => triggerWebhook('Gene/Variant Ingestion', 'YOUR_N8N_GENE_WEBHOOK_URL')}
                          disabled={webhookLoading !== null}
                          className="flex items-center justify-center space-x-2 bg-gradient-to-r from-pink-500 to-pink-600 text-white px-4 py-3 rounded-lg hover:from-pink-600 hover:to-pink-700 transition disabled:opacity-50"
                        >
                          {webhookLoading === 'Gene/Variant Ingestion' ? (
                            <Loader className="w-5 h-5 animate-spin" />
                          ) : (
                            <Play className="w-5 h-5" />
                          )}
                          <span>Run Gene/Variant Ingestion</span>
                        </button>

                        <button
                          onClick={() => triggerWebhook('Guidelines Refresh', 'YOUR_N8N_GUIDELINES_WEBHOOK_URL')}
                          disabled={webhookLoading !== null}
                          className="flex items-center justify-center space-x-2 bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-3 rounded-lg hover:from-red-600 hover:to-red-700 transition disabled:opacity-50"
                        >
                          {webhookLoading === 'Guidelines Refresh' ? (
                            <Loader className="w-5 h-5 animate-spin" />
                          ) : (
                            <Play className="w-5 h-5" />
                          )}
                          <span>Run Guidelines Refresh</span>
                        </button>
                      </div>
                    </div>

                    <h3 className="text-xl font-semibold text-gray-900 mb-4">Job History</h3>
                    {jobs.length === 0 ? (
                      <p className="text-gray-600 text-center py-8">No jobs found</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-3 px-4 font-semibold text-gray-700">Job Type</th>
                              <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                              <th className="text-left py-3 px-4 font-semibold text-gray-700">Started</th>
                              <th className="text-left py-3 px-4 font-semibold text-gray-700">Completed</th>
                              <th className="text-right py-3 px-4 font-semibold text-gray-700">Records</th>
                            </tr>
                          </thead>
                          <tbody>
                            {jobs.map((job) => (
                              <tr key={job.id} className="border-b border-gray-100">
                                <td className="py-3 px-4 font-medium text-gray-900">{job.job_type}</td>
                                <td className="py-3 px-4">
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    job.status === 'completed' ? 'bg-green-100 text-green-700' :
                                    job.status === 'running' ? 'bg-blue-100 text-blue-700' :
                                    job.status === 'failed' ? 'bg-red-100 text-red-700' :
                                    'bg-gray-100 text-gray-700'
                                  }`}>
                                    {job.status}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-sm text-gray-600">
                                  {formatDateTime(job.started_at)}
                                </td>
                                <td className="py-3 px-4 text-sm text-gray-600">
                                  {formatDateTime(job.completed_at)}
                                </td>
                                <td className="py-3 px-4 text-right text-gray-900">
                                  {job.records_processed}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'audit' && (
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-4">Audit Trail</h3>
                    {auditLog.length === 0 ? (
                      <p className="text-gray-600 text-center py-8">No audit entries found</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-3 px-4 font-semibold text-gray-700">Action</th>
                              <th className="text-left py-3 px-4 font-semibold text-gray-700">Table</th>
                              <th className="text-left py-3 px-4 font-semibold text-gray-700">User ID</th>
                              <th className="text-left py-3 px-4 font-semibold text-gray-700">Timestamp</th>
                            </tr>
                          </thead>
                          <tbody>
                            {auditLog.map((entry) => (
                              <tr key={entry.id} className="border-b border-gray-100">
                                <td className="py-3 px-4 font-medium text-gray-900">{entry.action}</td>
                                <td className="py-3 px-4 text-gray-600">{entry.table_name || 'N/A'}</td>
                                <td className="py-3 px-4 text-sm text-gray-600 truncate max-w-xs">
                                  {entry.user_id || 'System'}
                                </td>
                                <td className="py-3 px-4 text-sm text-gray-600">
                                  {formatDateTime(entry.created_at)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              {editingSource ? 'Edit Source' : 'Add Source'}
            </h3>

            <form onSubmit={handleSubmitSource} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700">Active</label>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition"
                >
                  {editingSource ? 'Update' : 'Add'} Source
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingSource(null);
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className={`px-6 py-4 rounded-lg shadow-lg ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          } text-white`}>
            {toast.message}
          </div>
        </div>
      )}
    </Layout>
  );
}
