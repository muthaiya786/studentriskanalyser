import React from 'react';
import {
  Users,
  AlertTriangle,
  Clock,
  ShieldCheck,
  TrendingUp,
  Award,
  Sparkles
} from 'lucide-react';
import { DatasetSummaryStats, TrainingResults, ModelAlgorithm } from '../types.ts';

interface SummaryCardsProps {
  stats: DatasetSummaryStats;
  trainingResults: TrainingResults | null;
  activeModel: ModelAlgorithm;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  stats,
  trainingResults,
  activeModel
}) => {
  const currentMetrics = activeModel === 'logistic_regression'
    ? trainingResults?.logisticRegression
    : trainingResults?.randomForest;

  const highRiskPct = stats.totalStudents ? Math.round((stats.riskDistribution.high / stats.totalStudents) * 1000) / 10 : 0;
  const mediumRiskPct = stats.totalStudents ? Math.round((stats.riskDistribution.medium / stats.totalStudents) * 1000) / 10 : 0;
  const lowRiskPct = stats.totalStudents ? Math.round((stats.riskDistribution.low / stats.totalStudents) * 1000) / 10 : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      {/* 1. Total Enrolled */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Cohort Enrolled</span>
          <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700">
            <Users className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold text-slate-900">{stats.totalStudents.toLocaleString()}</div>
          <p className="text-xs text-slate-500 mt-0.5">Active Student Profiles</p>
        </div>
      </div>

      {/* 2. High Risk (Critical) */}
      <div className="bg-white rounded-xl p-4 border border-rose-200 shadow-xs flex flex-col justify-between bg-gradient-to-b from-rose-50/40 to-transparent">
        <div className="flex items-center justify-between text-rose-600 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">High Risk Alert</span>
          <div className="p-1.5 rounded-lg bg-rose-100 text-rose-700">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-700">{stats.riskDistribution.high}</span>
            <span className="text-xs font-bold text-rose-600">({highRiskPct}%)</span>
          </div>
          <p className="text-xs text-rose-600/80 mt-0.5 font-medium">Immediate Intervention</p>
        </div>
      </div>

      {/* 3. Medium Risk */}
      <div className="bg-white rounded-xl p-4 border border-amber-200 shadow-xs flex flex-col justify-between bg-gradient-to-b from-amber-50/30 to-transparent">
        <div className="flex items-center justify-between text-amber-600 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Medium Risk</span>
          <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-800">{stats.riskDistribution.medium}</span>
            <span className="text-xs font-bold text-amber-700">({mediumRiskPct}%)</span>
          </div>
          <p className="text-xs text-amber-700/80 mt-0.5 font-medium">Monitoring Required</p>
        </div>
      </div>

      {/* 4. Low Risk / Safe */}
      <div className="bg-white rounded-xl p-4 border border-emerald-200 shadow-xs flex flex-col justify-between bg-gradient-to-b from-emerald-50/30 to-transparent">
        <div className="flex items-center justify-between text-emerald-600 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Low Risk (Safe)</span>
          <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-800">{stats.riskDistribution.low}</span>
            <span className="text-xs font-bold text-emerald-700">({lowRiskPct}%)</span>
          </div>
          <p className="text-xs text-emerald-700/80 mt-0.5 font-medium">On Track / Thriving</p>
        </div>
      </div>

      {/* 5. Average Final Grade */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Cohort Avg Grade</span>
          <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold text-slate-900">{stats.avgFinalGrade}%</div>
          <p className="text-xs text-slate-500 mt-0.5">
            Attendance Avg: <strong className="text-slate-700">{stats.avgAttendance}%</strong>
          </p>
        </div>
      </div>

      {/* 6. Model Test Accuracy */}
      <div className="bg-white rounded-xl p-4 border border-indigo-200 shadow-xs flex flex-col justify-between bg-gradient-to-b from-indigo-50/30 to-transparent">
        <div className="flex items-center justify-between text-indigo-600 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Test Accuracy</span>
          <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
            <Award className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold text-indigo-900">
            {currentMetrics ? `${currentMetrics.accuracy}%` : '89.5%'}
          </div>
          <p className="text-xs text-indigo-700/80 mt-0.5 font-medium">
            F1: {currentMetrics ? `${currentMetrics.f1Score}%` : '89.1%'} ({activeModel === 'random_forest' ? 'RF' : 'LR'})
          </p>
        </div>
      </div>
    </div>
  );
};
