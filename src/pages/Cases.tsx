import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import Layout from '../components/Layout';
import { Copy, Trash2, BookmarkCheck } from 'lucide-react';

interface SavedAnswer {
  id: string;
  drug_name: string;
  gene_name: string;
  user_type: string;
  answer: string;
  created_at: string;
}

export default function Cases() {
  const { user } = useAuth();
  const [savedAnswers, setSavedAnswers] = useState<SavedAnswer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSavedAnswers();
  }, []);

  async function fetchSavedAnswers() {
    try {
      const { data, error } = await supabase
        .from('saved_answers')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSavedAnswers(data || []);
    } catch (err) {
      console.error('Error fetching saved answers:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const { error } = await supabase
        .from('saved_answers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setSavedAnswers(savedAnswers.filter(sa => sa.id !== id));
    } catch (err) {
      console.error('Error deleting saved answer:', err);
    }
  }

  function handleCopy(answer: string) {
    navigator.clipboard.writeText(answer);
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center space-x-3 mb-6">
          <BookmarkCheck className="w-8 h-8 text-blue-600" />
          <h2 className="text-3xl font-bold text-gray-900">My Saved Answers</h2>
        </div>

        {savedAnswers.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <BookmarkCheck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No saved answers yet</h3>
            <p className="text-gray-600">
              Save answers from the chat page to access them here
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {savedAnswers.map((savedAnswer) => (
              <div
                key={savedAnswer.id}
                className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {savedAnswer.drug_name} & {savedAnswer.gene_name}
                    </h3>
                    <div className="flex items-center space-x-3 mt-1">
                      <span className="text-sm text-gray-500">
                        {savedAnswer.user_type} View
                      </span>
                      <span className="text-sm text-gray-400">•</span>
                      <span className="text-sm text-gray-500">
                        {formatDate(savedAnswer.created_at)}
                      </span>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleCopy(savedAnswer.answer)}
                      className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      title="Copy to clipboard"
                    >
                      <Copy className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(savedAnswer.id)}
                      className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="prose prose-sm max-w-none">
                  <p className="text-gray-700 whitespace-pre-wrap">{savedAnswer.answer}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
