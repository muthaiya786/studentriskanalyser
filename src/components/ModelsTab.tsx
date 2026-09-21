import React, { useState } from 'react';
import {
  Cpu,
  Award,
  CheckCircle2,
  TrendingUp,
  HelpCircle,
  BarChart,
  Layers,
  ArrowRight,
  ShieldAlert,
  Sliders
} from 'lucide-react';
import { TrainingResults, ModelAlgorithm, ModelMetrics } from '../types.ts';

interface ModelsTabProps {
  trainingResults: TrainingResults | null;
  activeModel: ModelAlgorithm;
  onSelectActiveModel: (algo: ModelAlgorithm) => void;
}

export const ModelsTab: React.FC<ModelsTabProps> = ({
  trainingResults,
  activeModel,
  onSelectActiveModel
}) => {
  const [matrixView, setMatrixView] = useState<'counts' | 'percentages'>('counts');

  if (!trainingResults) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
        <Cpu className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-2" />
        <p className="text-sm text-slate-600 font-medium">Training models on 1,000-student dataset...</p>
      </div>
    );
  }

  const { logisticRegression: lr, randomForest: rf } = trainingResults;
  const currentModel = activeModel === 'logistic_regression' ? lr : rf;

  const renderConfusionMatrix = (metrics: ModelMetrics) => {
    const { labels, matrix, total } = metrics.confusionMatrix;
    const maxVal = Math.max(...matrix.flat(), 1);

    return (
      <div className="space-y-3">
        <div className="flex justify-between items-center text-xs">
          <span className="font-semibold text-slate-600">
            Confusion Matrix (Test Sample: N={total})
          </span>
          <div className="inline-flex rounded-md bg-slate-100 p-0.5 font-medium">
            <button
              onClick={() => setMatrixView('counts')}
              className={`px-2 py-0.5 rounded text-[11px] ${
                matrixView === 'counts' ? 'bg-white text-indigo-700 font-bold shadow-2xs' : 'text-slate-600'
              }`}
            >
              Counts
            </button>
            <button
              onClick={() => setMatrixView('percentages')}
              className={`px-2 py-0.5 rounded text-[11px] ${
                matrixView === 'percentages' ? 'bg-white text-indigo-700 font-bold shadow-2xs' : 'text-slate-600'
              }`}
            >
              Percentages
            </button>
          </div>
        </div>

        {/* Matrix Grid */}
        <div className="overflow-x-auto">
          <div className="min-w-[320px]">
            {/* Top Column Labels (Predicted) */}
            <div className="grid grid-cols-4 gap-1.5 text-center text-xs font-semibold text-slate-500 mb-1.5">
              <div className="text-left font-bold text-slate-400">Actual ↓ / Pred →</div>
              {labels.map(l => (
                <div key={l} className="px-2 py-1 bg-slate-100 rounded text-slate-800">
                  {l}
                </div>
              ))}
            </div>

            {/* Rows */}
            {matrix.map((row, actualIdx) => (
              <div key={actualIdx} className="grid grid-cols-4 gap-1.5 mb-1.5 items-center">
                <div className="text-xs font-bold text-slate-800 px-2 py-1 bg-slate-100 rounded text-left">
                  {labels[actualIdx]}
                </div>
                {row.map((val, predIdx) => {
                  const isDiagonal = actualIdx === predIdx;
                  const intensity = Math.min(1, val / maxVal);
                  const pct = total ? Math.round((val / total) * 1000) / 10 : 0;

                  return (
                    <div
                      key={predIdx}
                      className={`h-14 rounded-lg flex flex-col items-center justify-center border transition-transform hover:scale-[1.02] ${
                        isDiagonal
                          ? 'border-emerald-300 bg-emerald-50/90 text-emerald-900 font-bold'
                          : val > 0
                          ? 'border-rose-200 bg-rose-50/70 text-rose-800 font-medium'
                          : 'border-slate-100 bg-slate-50 text-slate-400'
                      }`}
                      style={{
                        backgroundColor: isDiagonal
                          ? `rgba(16, 185, 129, ${0.15 + intensity * 0.4})`
                          : val > 0
                          ? `rgba(244, 63, 94, ${0.1 + intensity * 0.3})`
                          : undefined
                      }}
                    >
                      <span className="text-sm font-bold">
                        {matrixView === 'counts' ? val : `${pct}%`}
                      </span>
                      <span className="text-[10px] text-slate-500 font-normal">
                        {isDiagonal ? 'Correct (TP/TN)' : 'Error (FP/FN)'}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> Diagonal = Correct Predictions
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-400 inline-block" /> Off-diagonal = Misclassifications
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Model Selection & Comparative Header */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Comparative Model Performance Benchmark
            </h2>
            <p className="text-xs text-slate-500">
              Evaluated on {trainingResults.testCount} unseen test student records ({100 - trainingResults.trainSplitPct}% holdout)
            </p>
          </div>

          {/* Active Model Selector */}
          <div className="inline-flex rounded-lg bg-slate-100 p-1 font-semibold text-xs">
            <button
              onClick={() => onSelectActiveModel('random_forest')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                activeModel === 'random_forest'
                  ? 'bg-white text-indigo-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Award className="w-3.5 h-3.5 text-indigo-600" />
              <span>Random Forest (Ensemble)</span>
            </button>
            <button
              onClick={() => onSelectActiveModel('logistic_regression')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                activeModel === 'logistic_regression'
                  ? 'bg-white text-indigo-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-slate-600" />
              <span>Logistic Regression (Linear)</span>
            </button>
          </div>
        </div>

        {/* Side by Side Metric Comparison Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Logistic Regression Card */}
          <div
            onClick={() => onSelectActiveModel('logistic_regression')}
            className={`cursor-pointer rounded-xl p-4 border transition-all ${
              activeModel === 'logistic_regression'
                ? 'border-indigo-600 ring-2 ring-indigo-100 bg-indigo-50/20'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Logistic Regression</h3>
                  <span className="text-[10px] text-slate-500">Multinomial Gradient Descent</span>
                </div>
              </div>
              {activeModel === 'logistic_regression' && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-600 text-white">
                  Active
                </span>
              )}
            </div>

            <div className="grid grid-cols-4 gap-2 text-center pt-1 border-t border-slate-100">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-medium">Accuracy</span>
                <span className="text-base font-bold text-slate-900">{lr.accuracy}%</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-medium">Precision</span>
                <span className="text-base font-bold text-slate-900">{lr.precision}%</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-medium">Recall</span>
                <span className="text-base font-bold text-slate-900">{lr.recall}%</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-medium">F1-Score</span>
                <span className="text-base font-bold text-indigo-700">{lr.f1Score}%</span>
              </div>
            </div>
          </div>

          {/* Random Forest Card */}
          <div
            onClick={() => onSelectActiveModel('random_forest')}
            className={`cursor-pointer rounded-xl p-4 border transition-all ${
              activeModel === 'random_forest'
                ? 'border-indigo-600 ring-2 ring-indigo-100 bg-indigo-50/20'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-indigo-100 text-indigo-700">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Random Forest Classifier</h3>
                  <span className="text-[10px] text-slate-500">20 Bagged Decision Trees (Gini Splitting)</span>
                </div>
              </div>
              {activeModel === 'random_forest' && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-600 text-white">
                  Active (Recommended)
                </span>
              )}
            </div>

            <div className="grid grid-cols-4 gap-2 text-center pt-1 border-t border-slate-100">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-medium">Accuracy</span>
                <span className="text-base font-bold text-slate-900">{rf.accuracy}%</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-medium">Precision</span>
                <span className="text-base font-bold text-slate-900">{rf.precision}%</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-medium">Recall</span>
                <span className="text-base font-bold text-slate-900">{rf.recall}%</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-medium">F1-Score</span>
                <span className="text-base font-bold text-indigo-700">{rf.f1Score}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Confusion Matrix + Feature Importances */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Confusion Matrix Heatmap */}
        <div className="lg:col-span-6 bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {currentModel.algorithmName} — Confusion Matrix
              </h2>
              <p className="text-xs text-slate-500">
                Mapping Actual Class vs Model Prediction on Holdout Test Set
              </p>
            </div>
          </div>

          {renderConfusionMatrix(currentModel)}

          {/* Educator Callout: Why Recall Matters */}
          <div className="mt-4 p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-amber-900">
              <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
              <span>Pedagogical Lesson for Educators (Why Recall &gt; Precision):</span>
            </div>
            <p className="text-amber-800 leading-relaxed">
              In student risk prevention, a <strong>False Negative</strong> means an at-risk student is missed and receives no tutorial support until failing the final exam.
              A <strong>False Positive</strong> merely triggers an empathetic faculty check-in. Therefore, educators prioritize models with higher Recall on High Risk.
            </p>
          </div>
        </div>

        {/* Right: Feature Importance Breakdown */}
        <div className="lg:col-span-6 bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Feature Importance Ranking
              </h2>
              <p className="text-xs text-slate-500">
                Contribution of input variables to risk classification
              </p>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
              {currentModel.algorithm === 'random_forest' ? 'Mean Gini Reduction' : 'Log-Odds Weight Impact'}
            </span>
          </div>

          <div className="space-y-2.5">
            {currentModel.featureImportances.map((f, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-mono font-medium text-slate-700">{f.feature}</span>
                  <span className="font-bold text-slate-900">{f.importance}%</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      i === 0 ? 'bg-indigo-600' : i === 1 ? 'bg-indigo-500' : i === 2 ? 'bg-indigo-400' : 'bg-slate-400'
                    }`}
                    style={{ width: `${Math.min(100, f.importance * 3)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
            <span>Leading Predictors: Midterms &amp; Attendance</span>
            <span>Secondary: Failures &amp; Study Hours</span>
          </div>
        </div>
      </div>
    </div>
  );
};
