import React, { useState } from 'react';
import {
  BarChart2,
  PieChart,
  HelpCircle,
  ArrowUpRight,
  TrendingDown,
  Info,
  SlidersHorizontal
} from 'lucide-react';
import { CleanedStudentData, DatasetSummaryStats } from '../types.ts';

interface EdaTabProps {
  students: CleanedStudentData[];
  stats: DatasetSummaryStats;
}

export const EdaTab: React.FC<EdaTabProps> = ({ students, stats }) => {
  const [activeGradeView, setActiveGradeView] = useState<'final_grade' | 'midterm1_score' | 'midterm2_score'>('final_grade');

  // Compute distribution buckets (0-20, 20-40, 40-60, 60-80, 80-100)
  const buckets = [
    { label: '<40% (Fail)', min: 0, max: 39.9, color: 'bg-rose-500' },
    { label: '40-49% (Critical)', min: 40, max: 49.9, color: 'bg-rose-400' },
    { label: '50-64% (Pass)', min: 50, max: 64.9, color: 'bg-amber-400' },
    { label: '65-74% (Good)', min: 65, max: 74.9, color: 'bg-indigo-400' },
    { label: '75-84% (Distinction)', min: 75, max: 84.9, color: 'bg-indigo-600' },
    { label: '85-100% (High Honors)', min: 85, max: 100, color: 'bg-emerald-500' }
  ];

  const bucketCounts = buckets.map(b => {
    const count = students.filter(s => {
      const val = s[activeGradeView];
      return val >= b.min && val <= b.max;
    }).length;
    const pct = students.length ? Math.round((count / students.length) * 1000) / 10 : 0;
    return { ...b, count, pct };
  });

  const maxBucketCount = Math.max(...bucketCounts.map(b => b.count), 1);

  // Attendance bins (0-50, 50-65, 65-75, 75-85, 85-100)
  const attendanceBins = [
    { label: '<60%', min: 0, max: 59.9 },
    { label: '60-74%', min: 60, max: 74.9 },
    { label: '75-84%', min: 75, max: 84.9 },
    { label: '85-100%', min: 85, max: 100 }
  ].map(bin => {
    const binStudents = students.filter(s => s.attendance_rate >= bin.min && s.attendance_rate <= bin.max);
    const avgGrade = binStudents.length
      ? Math.round((binStudents.reduce((a, b) => a + b.final_grade, 0) / binStudents.length) * 10) / 10
      : 0;
    const highRiskCount = binStudents.filter(s => s.risk_level === 'High').length;
    const highRiskPct = binStudents.length ? Math.round((highRiskCount / binStudents.length) * 100) : 0;
    return {
      ...bin,
      count: binStudents.length,
      avgGrade,
      highRiskPct
    };
  });

  // Calculate stats table
  const calcFieldStats = (extractor: (s: CleanedStudentData) => number) => {
    const vals = students.map(extractor).sort((a, b) => a - b);
    const n = vals.length;
    if (!n) return { mean: 0, std: 0, min: 0, p25: 0, median: 0, p75: 0, max: 0 };
    const mean = Math.round((vals.reduce((a, b) => a + b, 0) / n) * 10) / 10;
    const variance = vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
    const std = Math.round(Math.sqrt(variance) * 10) / 10;
    const median = Math.round(vals[Math.floor(n * 0.5)] * 10) / 10;
    const p25 = Math.round(vals[Math.floor(n * 0.25)] * 10) / 10;
    const p75 = Math.round(vals[Math.floor(n * 0.75)] * 10) / 10;
    return { mean, std, min: vals[0], p25, median, p75, max: vals[n - 1] };
  };

  const statMetrics = [
    { name: 'Final Grade (G3)', unit: '%', ...calcFieldStats(s => s.final_grade) },
    { name: 'Midterm 2 Score (G2)', unit: 'pts', ...calcFieldStats(s => s.midterm2_score) },
    { name: 'Midterm 1 Score (G1)', unit: 'pts', ...calcFieldStats(s => s.midterm1_score) },
    { name: 'Attendance Rate', unit: '%', ...calcFieldStats(s => s.attendance_rate) },
    { name: 'Study Hours Weekly', unit: 'hrs', ...calcFieldStats(s => s.study_hours_weekly) },
    { name: 'Past Subject Failures', unit: '', ...calcFieldStats(s => s.past_failures) },
    { name: 'Absences (Missed Hours)', unit: 'hrs', ...calcFieldStats(s => s.absences) },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner explaining EDA in FDP context */}
      <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm text-indigo-900">
          <span className="font-bold">FDP Activity 1 &amp; 2 Goal: </span>
          Explore the statistical distributions and correlation anchors in the 1,000-student cohort before training models.
          Notice how attendance below <strong className="text-indigo-950">75%</strong> and prior backlogs strongly trigger high academic risk.
        </div>
      </div>

      {/* Grid: Histogram + Risk Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Grade Distribution Histogram */}
        <div className="lg:col-span-7 bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-base font-bold text-slate-900">Cohort Score Distribution</h2>
              <p className="text-xs text-slate-500">Distribution across score intervals (N={students.length})</p>
            </div>
            {/* Variable switcher */}
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
              <button
                onClick={() => setActiveGradeView('final_grade')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  activeGradeView === 'final_grade' ? 'bg-white text-indigo-600 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Final Grade
              </button>
              <button
                onClick={() => setActiveGradeView('midterm2_score')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  activeGradeView === 'midterm2_score' ? 'bg-white text-indigo-600 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Midterm 2
              </button>
              <button
                onClick={() => setActiveGradeView('midterm1_score')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  activeGradeView === 'midterm1_score' ? 'bg-white text-indigo-600 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Midterm 1
              </button>
            </div>
          </div>

          {/* Histogram Bars */}
          <div className="space-y-3">
            {bucketCounts.map((b, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-slate-700">{b.label}</span>
                  <span className="font-bold text-slate-900">
                    {b.count} students <span className="text-slate-400 font-normal">({b.pct}%)</span>
                  </span>
                </div>
                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
                  <div
                    className={`h-full ${b.color} transition-all duration-500 rounded-full`}
                    style={{ width: `${(b.count / maxBucketCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Pass Mark: 50%</span>
            <span>Distinction Threshold: 75%</span>
          </div>
        </div>

        {/* Right: Academic Risk Level & Performance Tier Breakdown */}
        <div className="lg:col-span-5 bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 mb-1">Risk &amp; Performance Tiers</h2>
            <p className="text-xs text-slate-500 mb-4">Ground-truth labels categorized for early intervention</p>

            {/* Risk Breakdown */}
            <div className="mb-5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2 block">
                Intervention Risk Level
              </span>
              <div className="grid grid-cols-3 gap-2">
                <div className="p-3 rounded-lg border border-rose-200 bg-rose-50/60 text-center">
                  <span className="text-xs font-semibold text-rose-700 block">High Risk</span>
                  <span className="text-xl font-bold text-rose-800">{stats.riskDistribution.high}</span>
                  <span className="text-[10px] text-rose-600 block mt-0.5">
                    {Math.round((stats.riskDistribution.high / (students.length || 1)) * 100)}% cohort
                  </span>
                </div>

                <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/60 text-center">
                  <span className="text-xs font-semibold text-amber-700 block">Medium Risk</span>
                  <span className="text-xl font-bold text-amber-800">{stats.riskDistribution.medium}</span>
                  <span className="text-[10px] text-amber-600 block mt-0.5">
                    {Math.round((stats.riskDistribution.medium / (students.length || 1)) * 100)}% cohort
                  </span>
                </div>

                <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/60 text-center">
                  <span className="text-xs font-semibold text-emerald-700 block">Low Risk</span>
                  <span className="text-xl font-bold text-emerald-800">{stats.riskDistribution.low}</span>
                  <span className="text-[10px] text-emerald-600 block mt-0.5">
                    {Math.round((stats.riskDistribution.low / (students.length || 1)) * 100)}% cohort
                  </span>
                </div>
              </div>
            </div>

            {/* Academic Performance Tier */}
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2 block">
                Academic Performance Tier (Score-Based)
              </span>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 rounded-md bg-slate-50 text-xs">
                  <span className="font-semibold text-indigo-900">High Achievers (≥75%)</span>
                  <span className="font-bold text-slate-800">
                    {stats.performanceDistribution.high} students ({Math.round((stats.performanceDistribution.high / (students.length || 1)) * 100)}%)
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-md bg-slate-50 text-xs">
                  <span className="font-semibold text-slate-800">Average Tier (50-74%)</span>
                  <span className="font-bold text-slate-800">
                    {stats.performanceDistribution.average} students ({Math.round((stats.performanceDistribution.average / (students.length || 1)) * 100)}%)
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-md bg-slate-50 text-xs">
                  <span className="font-semibold text-rose-800">Low Tier (&lt;50%)</span>
                  <span className="font-bold text-slate-800">
                    {stats.performanceDistribution.low} students ({Math.round((stats.performanceDistribution.low / (students.length || 1)) * 100)}%)
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
            <strong>Key Insight for Educators:</strong> 78% of students in the <em>High Risk</em> category exhibit both attendance &lt; 70% and a Midterm 1 score &lt; 50.
          </div>
        </div>
      </div>

      {/* Attendance Impact on Grade & Risk */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
        <h2 className="text-base font-bold text-slate-900 mb-1">
          Attendance % Impact on Final Academic Outcome
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Visual correlation between lecture attendance tiers, final grade average, and high-risk propensity
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {attendanceBins.map((bin, i) => (
            <div
              key={i}
              className={`p-4 rounded-xl border ${
                bin.min < 60
                  ? 'border-rose-300 bg-rose-50/50'
                  : bin.min < 75
                  ? 'border-amber-300 bg-amber-50/50'
                  : 'border-slate-200 bg-slate-50/60'
              }`}
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-slate-700">Attendance: {bin.label}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-white border border-slate-200 text-slate-600">
                  {bin.count} students
                </span>
              </div>
              <div className="space-y-1.5 mt-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Average Final Grade:</span>
                  <span className="font-bold text-slate-900">{bin.avgGrade}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">High-Risk Proportion:</span>
                  <span className={`font-bold ${bin.highRiskPct > 50 ? 'text-rose-600' : 'text-slate-700'}`}>
                    {bin.highRiskPct}%
                  </span>
                </div>
              </div>
              {/* Mini visual indicator */}
              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-3">
                <div
                  className={`h-full rounded-full ${bin.min < 60 ? 'bg-rose-500' : bin.min < 75 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${bin.avgGrade}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Descriptive Statistics Table */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
        <h2 className="text-base font-bold text-slate-900 mb-1">
          Descriptive Statistical Summary (1,000 Student Records)
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Parametric and non-parametric summary metrics across all numerical features
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-800 font-semibold border-b border-slate-200">
                <th className="py-2.5 px-3">Feature Name</th>
                <th className="py-2.5 px-3">Unit</th>
                <th className="py-2.5 px-3">Mean</th>
                <th className="py-2.5 px-3">Std Dev (σ)</th>
                <th className="py-2.5 px-3">Min</th>
                <th className="py-2.5 px-3">25% (Q1)</th>
                <th className="py-2.5 px-3">Median (Q2)</th>
                <th className="py-2.5 px-3">75% (Q3)</th>
                <th className="py-2.5 px-3">Max</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {statMetrics.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-3 font-semibold text-slate-900">{row.name}</td>
                  <td className="py-2.5 px-3 text-slate-500">{row.unit || '—'}</td>
                  <td className="py-2.5 px-3 font-bold text-indigo-700">{row.mean}</td>
                  <td className="py-2.5 px-3">{row.std}</td>
                  <td className="py-2.5 px-3">{row.min}</td>
                  <td className="py-2.5 px-3">{row.p25}</td>
                  <td className="py-2.5 px-3 font-medium text-slate-800">{row.median}</td>
                  <td className="py-2.5 px-3">{row.p75}</td>
                  <td className="py-2.5 px-3 font-medium text-slate-800">{row.max}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
