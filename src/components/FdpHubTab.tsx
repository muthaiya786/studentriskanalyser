import React, { useState } from 'react';
import {
  BookOpen,
  Code2,
  Copy,
  Check,
  Download,
  Terminal,
  Server,
  Play,
  Layers,
  ArrowRight,
  ExternalLink,
  ShieldAlert,
  Cpu
} from 'lucide-react';
import { FASTAPI_MAIN_PY, FASTAPI_REQUIREMENTS_TXT, FDP_CURRICULUM_STEPS } from '../ml/fastapiDocs.ts';

export const FdpHubTab: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'curriculum' | 'fastapi_code' | 'api_tester'>('curriculum');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [isTestingApi, setIsTestingApi] = useState(false);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDownloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const runLiveApiTest = async (endpoint: string) => {
    setIsTestingApi(true);
    try {
      let res;
      if (endpoint === '/api/health') {
        res = await fetch('/api/health');
      } else if (endpoint === '/api/predict') {
        res = await fetch('/api/predict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            attendance_rate: 62,
            study_hours_weekly: 4,
            midterm1_score: 48,
            midterm2_score: 52,
            past_failures: 2,
            absences: 12,
            internet_access: true,
            school_support: false,
            family_support: true,
            desires_higher_ed: true
          })
        });
      } else {
        res = await fetch('/api/train', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ splitPct: 80, target: 'risk_level' })
        });
      }
      const data = await res.json();
      setApiResponse({ endpoint, status: res.status, data });
    } catch (err: any) {
      setApiResponse({ endpoint, error: err.message });
    } finally {
      setIsTestingApi(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="inline-flex rounded-lg bg-slate-100 p-1 text-xs font-semibold">
          <button
            onClick={() => setActiveSubTab('curriculum')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
              activeSubTab === 'curriculum' ? 'bg-white text-indigo-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>FDP Hands-On Curriculum (6 Steps)</span>
          </button>
          <button
            onClick={() => setActiveSubTab('fastapi_code')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
              activeSubTab === 'fastapi_code' ? 'bg-white text-indigo-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Python FastAPI Backend Source</span>
          </button>
          <button
            onClick={() => setActiveSubTab('api_tester')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
              activeSubTab === 'api_tester' ? 'bg-white text-indigo-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Live REST API Tester</span>
          </button>
        </div>

        <span className="text-xs text-slate-500 font-medium hidden sm:inline">
          Faculty Development Programme (AI in Higher Education)
        </span>
      </div>

      {/* 1. CURRICULUM VIEW */}
      {activeSubTab === 'curriculum' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
            <h2 className="text-base font-bold text-slate-900 mb-1">
              FDP Hands-on Activity Guide: Student Risk Prediction Pipeline
            </h2>
            <p className="text-xs text-slate-500 mb-6">
              Step-by-step laboratory syllabus for faculty members and educational data science researchers
            </p>

            <div className="space-y-4">
              {FDP_CURRICULUM_STEPS.map((step) => (
                <div
                  key={step.step}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center shrink-0 text-sm">
                      {step.step}
                    </div>
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <h3 className="text-sm font-bold text-slate-900">{step.title}</h3>
                        <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium">
                          FDP Module {step.step}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {step.description}
                      </p>
                      <div className="mt-2 p-2.5 rounded-lg bg-white border border-slate-200 text-xs text-indigo-950 font-medium flex items-center gap-2">
                        <ArrowRight className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span><strong>Hands-on Task:</strong> {step.activity}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. FASTAPI BACKEND CODE VIEW */}
      {activeSubTab === 'fastapi_code' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  FastAPI Model Serving Backend (`main.py`)
                </h2>
                <p className="text-xs text-slate-500">
                  Complete scikit-learn model serving application ready to deploy with Uvicorn
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopy(FASTAPI_MAIN_PY, 'main_py')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 shadow-xs"
                >
                  {copiedKey === 'main_py' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleDownloadFile(FASTAPI_MAIN_PY, 'main.py')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download main.py</span>
                </button>
              </div>
            </div>

            {/* Code Block */}
            <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto text-xs text-slate-200 font-mono max-h-[500px] scrollbar-thin">
              <pre>{FASTAPI_MAIN_PY}</pre>
            </div>

            {/* requirements.txt */}
            <div className="pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-slate-900 uppercase">
                  Python Dependencies (`requirements.txt`)
                </h3>
                <button
                  onClick={() => handleDownloadFile(FASTAPI_REQUIREMENTS_TXT, 'requirements.txt')}
                  className="text-xs text-indigo-600 font-semibold hover:underline flex items-center gap-1"
                >
                  <Download className="w-3 h-3" />
                  <span>Download requirements.txt</span>
                </button>
              </div>
              <div className="bg-slate-900 rounded-lg p-3 text-xs text-slate-200 font-mono">
                <pre>{FASTAPI_REQUIREMENTS_TXT}</pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. LIVE REST API TESTER */}
      {activeSubTab === 'api_tester' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Live Backend API Connectivity Playground
              </h2>
              <p className="text-xs text-slate-500">
                Execute live HTTP queries against the backend server endpoints
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => runLiveApiTest('/api/health')}
                disabled={isTestingApi}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                <Server className="w-3.5 h-3.5 text-emerald-600" />
                <span>GET /api/health</span>
              </button>

              <button
                onClick={() => runLiveApiTest('/api/predict')}
                disabled={isTestingApi}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                <Cpu className="w-3.5 h-3.5 text-indigo-600" />
                <span>POST /api/predict (Student)</span>
              </button>

              <button
                onClick={() => runLiveApiTest('/api/train')}
                disabled={isTestingApi}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-800 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 text-purple-600" />
                <span>POST /api/train (80/20)</span>
              </button>
            </div>

            {/* Response Viewer */}
            {apiResponse && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">
                    Endpoint: <code className="font-mono text-indigo-700">{apiResponse.endpoint}</code>
                  </span>
                  {apiResponse.status && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      HTTP {apiResponse.status} OK
                    </span>
                  )}
                </div>

                <div className="bg-slate-900 rounded-xl p-4 text-xs font-mono text-emerald-400 overflow-x-auto max-h-[350px] scrollbar-thin">
                  <pre>{JSON.stringify(apiResponse.data || apiResponse.error, null, 2)}</pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
