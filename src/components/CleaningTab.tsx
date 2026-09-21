import React, { useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  CopyCheck,
  Split,
  Binary,
  Layers,
  RefreshCw,
  Sliders,
  ShieldCheck
} from 'lucide-react';
import { DataCleaningAudit, CleanedStudentData } from '../types.ts';

interface CleaningTabProps {
  audit: DataCleaningAudit;
  students: CleanedStudentData[];
  trainSplitPct: number;
  onUpdateSplit: (splitPct: number) => void;
  targetMode: 'risk_level' | 'performance_tier';
  onChangeTargetMode: (mode: 'risk_level' | 'performance_tier') => void;
  isRetraining: boolean;
}

export const CleaningTab: React.FC<CleaningTabProps> = ({
  audit,
  students,
  trainSplitPct,
  onUpdateSplit,
  targetMode,
  onChangeTargetMode,
  isRetraining
}) => {
  const [localSplit, setLocalSplit] = useState(trainSplitPct);
  const trainCount = Math.floor(students.length * (localSplit / 100));
  const testCount = students.length - trainCount;

  const handleApplySplit = () => {
    onUpdateSplit(localSplit);
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase">Total Ingested Rows</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{audit.totalRows}</div>
          <p className="text-xs text-slate-500 mt-1">Raw incoming CSV records</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-emerald-200 bg-emerald-50/20 shadow-xs">
          <div className="flex items-center justify-between text-emerald-700 mb-1">
            <span className="text-xs font-semibold uppercase">Clean Validated Rows</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-800">{audit.cleanRows}</div>
          <p className="text-xs text-emerald-600 mt-1">100% Schema &amp; Type verified</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-indigo-200 bg-indigo-50/20 shadow-xs">
          <div className="flex items-center justify-between text-indigo-700 mb-1">
            <span className="text-xs font-semibold uppercase">Missing Cells Imputed</span>
            <Sparkles className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-indigo-800">{audit.missingValuesHandled}</div>
          <p className="text-xs text-indigo-600 mt-1">Mean &amp; Mode Imputation</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-amber-200 bg-amber-50/20 shadow-xs">
          <div className="flex items-center justify-between text-amber-700 mb-1">
            <span className="text-xs font-semibold uppercase">Outliers / Range Clamped</span>
            <ShieldCheck className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-800">{audit.outliersCapped}</div>
          <p className="text-xs text-amber-600 mt-1">Clamped to valid academic scale [0, 100]</p>
        </div>
      </div>

      {/* Train/Test Split Workbench */}
      <div className="bg-white rounded-xl p-5 border border-indigo-200 shadow-xs bg-gradient-to-r from-indigo-50/40 via-white to-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Split className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-bold text-slate-900">
                Train / Test Split Configuration
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Partition the 1,000-student dataset into independent training and validation cohorts
            </p>
          </div>

          {/* Quick preset buttons */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 font-medium">Presets:</span>
            <button
              onClick={() => setLocalSplit(70)}
              className={`px-2.5 py-1 rounded-md border font-semibold ${
                localSplit === 70 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              70 / 30
            </button>
            <button
              onClick={() => setLocalSplit(80)}
              className={`px-2.5 py-1 rounded-md border font-semibold ${
                localSplit === 80 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              80 / 20 (Standard)
            </button>
            <button
              onClick={() => setLocalSplit(85)}
              className={`px-2.5 py-1 rounded-md border font-semibold ${
                localSplit === 85 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              85 / 15
            </button>
          </div>
        </div>

        {/* Split Slider */}
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-xs font-semibold mb-1">
              <span className="text-indigo-700">Training Set: {localSplit}% ({trainCount} Students)</span>
              <span className="text-amber-700">Testing Validation Set: {100 - localSplit}% ({testCount} Students)</span>
            </div>
            <input
              type="range"
              min={50}
              max={90}
              step={5}
              value={localSplit}
              onChange={(e) => setLocalSplit(Number(e.target.value))}
              className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
          </div>

          {/* Visual split bar */}
          <div className="h-4 w-full rounded-lg overflow-hidden flex text-[10px] font-bold text-white shadow-2xs">
            <div
              className="bg-indigo-600 flex items-center justify-center transition-all duration-300"
              style={{ width: `${localSplit}%` }}
            >
              Training: {trainCount}
            </div>
            <div
              className="bg-amber-500 flex items-center justify-center transition-all duration-300"
              style={{ width: `${100 - localSplit}%` }}
            >
              Testing: {testCount}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            {/* Target Variable Toggle */}
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-slate-700">Target Label:</span>
              <div className="inline-flex rounded-md bg-slate-100 p-0.5 font-medium">
                <button
                  onClick={() => onChangeTargetMode('risk_level')}
                  className={`px-2 py-1 rounded text-xs transition-colors ${
                    targetMode === 'risk_level' ? 'bg-white text-indigo-700 font-bold shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  Intervention Risk Level (Low/Med/High)
                </button>
                <button
                  onClick={() => onChangeTargetMode('performance_tier')}
                  className={`px-2 py-1 rounded text-xs transition-colors ${
                    targetMode === 'performance_tier' ? 'bg-white text-indigo-700 font-bold shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  Academic Tier (High/Avg/Low)
                </button>
              </div>
            </div>

            <button
              onClick={handleApplySplit}
              disabled={isRetraining}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRetraining ? 'animate-spin' : ''}`} />
              <span>Apply Split &amp; Retrain Models</span>
            </button>
          </div>
        </div>
      </div>

      {/* Feature Engineering & Scaling Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cleaning Audit Ledger */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
          <h2 className="text-base font-bold text-slate-900 mb-1">
            Data Quality &amp; Imputation Audit Table
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Automated treatment applied to raw student records
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-semibold border-b border-slate-200">
                  <th className="py-2 px-3">Column Name</th>
                  <th className="py-2 px-3">Data Type</th>
                  <th className="py-2 px-3">Missing Handled</th>
                  <th className="py-2 px-3">Imputation Rule</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {audit.columnSummary.map((col, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-mono font-medium text-slate-900">{col.column}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        col.type === 'numeric' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                      }`}>
                        {col.type}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-800">{col.missingCount}</td>
                    <td className="py-2 px-3 text-slate-600">{col.imputationMethod}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Feature Preparation & Encoding Table */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
          <h2 className="text-base font-bold text-slate-900 mb-1">
            Feature Preparation &amp; Scaling Strategy
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Vector transformation for Logistic Regression and Random Forest models
          </p>

          <div className="space-y-2.5 text-xs">
            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-slate-900">Attendance Rate (Continuous)</span>
                <span className="font-mono text-indigo-700 font-semibold">[0.0 - 1.0] Min-Max Scaled</span>
              </div>
              <p className="text-slate-600">Normalized percentage: <code>x / 100</code>. Primary predictor for active course engagement.</p>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-slate-900">Midterm 1 &amp; Midterm 2 Scores</span>
                <span className="font-mono text-indigo-700 font-semibold">[0.0 - 1.0] Min-Max Scaled</span>
              </div>
              <p className="text-slate-600">Scaled internal marks. Strongest correlation coefficients with final examination outcomes.</p>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-slate-900">Weekly Study Hours</span>
                <span className="font-mono text-indigo-700 font-semibold">[0.0 - 1.0] Bound-Capped</span>
              </div>
              <p className="text-slate-600">Continuous self-reported study duration. Capped at 20 hours to prevent outlier leverage.</p>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-slate-900">Categorical Toggles (Internet, Support, Ambition)</span>
                <span className="font-mono text-purple-700 font-semibold">Binary Encoding {`{0, 1}`}</span>
              </div>
              <p className="text-slate-600">Boolean representation for socio-academic support factors.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
