import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Layout from '../components/Layout';
import { Search, ChevronDown, ChevronUp } from 'lucide-react';

interface GuidelineWithDetails {
  id: string;
  recommendation: string;
  evidence_level: string;
  patient_summary: string;
  clinician_summary: string;
  drug: { name: string };
  gene: { symbol: string };
  source: { name: string };
  citations: Array<{
    title: string;
    authors: string;
    journal: string;
    year: number;
    url: string;
  }>;
}

export default function Evidence() {
  const [guidelines, setGuidelines] = useState<GuidelineWithDetails[]>([]);
  const [filteredGuidelines, setFilteredGuidelines] = useState<GuidelineWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [drugFilter, setDrugFilter] = useState('');
  const [geneFilter, setGeneFilter] = useState('');
  const [evidenceFilter, setEvidenceFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [drugs, setDrugs] = useState<string[]>([]);
  const [genes, setGenes] = useState<string[]>([]);

  useEffect(() => {
    fetchGuidelines();
    fetchFilters();
  }, []);

  useEffect(() => {
    filterGuidelines();
  }, [searchTerm, drugFilter, geneFilter, evidenceFilter, guidelines]);

  async function fetchGuidelines() {
    try {
      const { data, error } = await supabase
        .from('guidelines')
        .select(`
          id,
          recommendation,
          evidence_level,
          patient_summary,
          clinician_summary,
          drug:drugs(name),
          gene:genes(symbol),
          source:sources(name),
          citations(title, authors, journal, year, url)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGuidelines(data || []);
      setFilteredGuidelines(data || []);
    } catch (err) {
      console.error('Error fetching guidelines:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchFilters() {
    const { data: drugsData } = await supabase
      .from('drugs')
      .select('name')
      .order('name');

    const { data: genesData } = await supabase
      .from('genes')
      .select('symbol')
      .order('symbol');

    setDrugs(drugsData?.map(d => d.name) || []);
    setGenes(genesData?.map(g => g.symbol) || []);
  }

  function filterGuidelines() {
    let filtered = guidelines;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(g =>
        g.drug.name.toLowerCase().includes(term) ||
        g.gene.symbol.toLowerCase().includes(term) ||
        g.recommendation?.toLowerCase().includes(term)
      );
    }

    if (drugFilter) {
      filtered = filtered.filter(g => g.drug.name === drugFilter);
    }

    if (geneFilter) {
      filtered = filtered.filter(g => g.gene.symbol === geneFilter);
    }

    if (evidenceFilter) {
      filtered = filtered.filter(g => g.evidence_level === evidenceFilter);
    }

    setFilteredGuidelines(filtered);
  }

  function toggleExpand(id: string) {
    setExpandedId(expandedId === id ? null : id);
  }

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Retrieving verified sources...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-6">Evidence Base</h2>

        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search guidelines..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Drug
              </label>
              <select
                value={drugFilter}
                onChange={(e) => setDrugFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              >
                <option value="">All Drugs</option>
                {drugs.map(drug => (
                  <option key={drug} value={drug}>{drug}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gene
              </label>
              <select
                value={geneFilter}
                onChange={(e) => setGeneFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              >
                <option value="">All Genes</option>
                {genes.map(gene => (
                  <option key={gene} value={gene}>{gene}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Evidence Level
              </label>
              <select
                value={evidenceFilter}
                onChange={(e) => setEvidenceFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              >
                <option value="">All Levels</option>
                <option value="High">High</option>
                <option value="Moderate">Moderate</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>

          <p className="text-sm text-gray-600">
            Found {filteredGuidelines.length} guideline{filteredGuidelines.length !== 1 ? 's' : ''}
          </p>
        </div>

        {filteredGuidelines.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <p className="text-gray-600">No records found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredGuidelines.map((guideline) => (
              <div key={guideline.id} className="bg-white rounded-xl shadow-md overflow-hidden">
                <div
                  className="p-6 cursor-pointer hover:bg-gray-50 transition"
                  onClick={() => toggleExpand(guideline.id)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {guideline.drug.name} & {guideline.gene.symbol}
                        </h3>
                        {guideline.evidence_level && (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            guideline.evidence_level === 'High' ? 'bg-green-100 text-green-700' :
                            guideline.evidence_level === 'Moderate' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {guideline.evidence_level}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-1">
                        Source: {guideline.source.name}
                      </p>
                      {guideline.recommendation && (
                        <p className="text-sm text-gray-700 line-clamp-2">
                          {guideline.recommendation}
                        </p>
                      )}
                    </div>
                    {expandedId === guideline.id ? (
                      <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0 ml-4" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0 ml-4" />
                    )}
                  </div>
                </div>

                {expandedId === guideline.id && (
                  <div className="px-6 pb-6 border-t border-gray-100">
                    <div className="pt-4 space-y-4">
                      {guideline.patient_summary && (
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-1">Patient Summary</h4>
                          <p className="text-sm text-gray-700">{guideline.patient_summary}</p>
                        </div>
                      )}

                      {guideline.clinician_summary && (
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-1">Clinician Summary</h4>
                          <p className="text-sm text-gray-700">{guideline.clinician_summary}</p>
                        </div>
                      )}

                      {guideline.citations && guideline.citations.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-2">Citations</h4>
                          <ul className="space-y-2">
                            {guideline.citations.map((citation, idx) => (
                              <li key={idx} className="text-sm text-gray-600">
                                {citation.title} - {citation.authors} ({citation.journal}, {citation.year})
                                {citation.url && (
                                  <a
                                    href={citation.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline ml-2"
                                  >
                                    View
                                  </a>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
