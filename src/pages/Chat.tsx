import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import Layout from '../components/Layout';
import { Send, Copy, BookmarkPlus, AlertCircle } from 'lucide-react';

interface QueryResult {
  drug: string;
  gene: string;
  answer: string;
  citations: string[];
}

export default function Chat() {
  const { user } = useAuth();
  const [drugInput, setDrugInput] = useState('');
  const [geneInput, setGeneInput] = useState('');
  const [userType, setUserType] = useState<'Patient' | 'Clinician'>('Patient');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState('');
  const [limitReached, setLimitReached] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setResult(null);
    setLimitReached(false);
    setSaveSuccess(false);
    setLoading(true);

    try {
      const currentMonth = new Date().toISOString().slice(0, 7);

      const { data: usageData, error: usageError } = await supabase
        .from('usage_monthly')
        .select('query_count')
        .eq('user_id', user!.id)
        .eq('month', currentMonth)
        .maybeSingle();

      if (usageError) throw usageError;

      if (usageData && usageData.query_count >= 50) {
        setLimitReached(true);
        setLoading(false);
        return;
      }

      const { data: drugData } = await supabase
        .from('drugs')
        .select('id, name')
        .ilike('name', `%${drugInput}%`)
        .limit(1)
        .maybeSingle();

      const { data: geneData } = await supabase
        .from('genes')
        .select('id, symbol')
        .ilike('symbol', `%${geneInput}%`)
        .limit(1)
        .maybeSingle();

      if (!drugData || !geneData) {
        setError('Not in database yet.');
        setLoading(false);
        return;
      }

      const { data: interactions } = await supabase
        .from('interactions')
        .select(`
          *,
          guideline:guidelines(
            *,
            source:sources(name)
          ),
          phenotype:phenotypes(phenotype, description)
        `)
        .eq('drug_id', drugData.id)
        .eq('gene_id', geneData.id);

      if (!interactions || interactions.length === 0) {
        setError('Not in database yet.');
        setLoading(false);
        return;
      }

      const interaction = interactions[0];
      const guideline = interaction.guideline;

      const { data: citationsData } = await supabase
        .from('citations')
        .select('title, authors, journal, year, url')
        .eq('guideline_id', guideline.id);

      const citations = citationsData?.map(c =>
        `${c.title} - ${c.authors} (${c.journal}, ${c.year})`
      ) || [];

      let answerText = '';
      if (userType === 'Patient') {
        answerText = guideline.patient_summary || interaction.summary || 'No information available.';
      } else {
        answerText = `${guideline.clinician_summary || interaction.summary}\n\nAction: ${interaction.action}\n\nEvidence: ${interaction.evidence}\n\nPhenotype: ${interaction.phenotype?.phenotype || 'N/A'}\n\nEvidence Level: ${guideline.evidence_level || 'N/A'}`;
      }

      setResult({
        drug: drugData.name,
        gene: geneData.symbol,
        answer: answerText,
        citations
      });

      if (usageData) {
        await supabase
          .from('usage_monthly')
          .update({
            query_count: usageData.query_count + 1,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user!.id)
          .eq('month', currentMonth);
      } else {
        await supabase
          .from('usage_monthly')
          .insert({
            user_id: user!.id,
            month: currentMonth,
            query_count: 1
          });
      }

    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!result) return;

    try {
      await supabase.from('saved_answers').insert({
        user_id: user!.id,
        drug_name: result.drug,
        gene_name: result.gene,
        user_type: userType,
        answer: result.answer
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    }
  }

  function handleCopy() {
    if (result) {
      navigator.clipboard.writeText(result.answer);
    }
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Drug-Gene Interaction Query
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Drug Name
                </label>
                <input
                  type="text"
                  value={drugInput}
                  onChange={(e) => setDrugInput(e.target.value)}
                  required
                  placeholder="e.g., Warfarin"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gene Symbol
                </label>
                <input
                  type="text"
                  value={geneInput}
                  onChange={(e) => setGeneInput(e.target.value)}
                  required
                  placeholder="e.g., CYP2D6"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                />
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-gray-700">I am a:</span>
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  value="Patient"
                  checked={userType === 'Patient'}
                  onChange={(e) => setUserType(e.target.value as 'Patient')}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm text-gray-700">Patient</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  value="Clinician"
                  checked={userType === 'Clinician'}
                  onChange={(e) => setUserType(e.target.value as 'Clinician')}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm text-gray-700">Clinician</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {loading ? (
                <span>Retrieving verified sources...</span>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  <span>Submit Query</span>
                </>
              )}
            </button>
          </form>
        </div>

        {limitReached && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900">Limit Reached</h3>
              <p className="text-sm text-red-700 mt-1">
                You have reached your monthly limit of 50 queries. Please try again next month.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
            <p className="text-gray-700">{error}</p>
          </div>
        )}

        {result && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {result.drug} & {result.gene}
                </h3>
                <span className="text-sm text-gray-500">{userType} View</span>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={handleCopy}
                  className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                  title="Copy to clipboard"
                >
                  <Copy className="w-5 h-5" />
                </button>
                <button
                  onClick={handleSave}
                  className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                  title="Save answer"
                >
                  <BookmarkPlus className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="prose prose-sm max-w-none">
              <p className="text-gray-700 whitespace-pre-wrap">{result.answer}</p>
            </div>

            {result.citations.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h4 className="font-semibold text-gray-900 mb-2">Citations</h4>
                <ul className="space-y-2">
                  {result.citations.map((citation, idx) => (
                    <li key={idx} className="text-sm text-gray-600">
                      {citation}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {saveSuccess && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
                Answer saved successfully!
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
