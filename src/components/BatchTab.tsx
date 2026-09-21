import React, { useState, useMemo } from 'react';
import {
  Table as TableIcon,
  Download,
  Search,
  Filter,
  AlertTriangle,
  Clock,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  CheckCircle2,
  FileSpreadsheet
} from 'lucide-react';
import { BatchPredictionItem, RiskLevel, PerformanceTier } from '../types.ts';

interface BatchTabProps {
  batchData: BatchPredictionItem[];
  onExportCsv: () => void;
  activeModelName: string;
}

export const BatchTab: React.FC<BatchTabProps> = ({
  batchData,
  onExportCsv,
  activeModelName
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState<'all' | RiskLevel>('all');
  const [tierFilter, setTierFilter] = useState<'all' | PerformanceTier>('all');
  const [discrepancyOnly, setDiscrepancyOnly] = useState(false);
  const [sortField, setSortField] = useState<keyof BatchPredictionItem>('predicted_risk_prob');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Filter & Sort
  const filteredData = useMemo(() => {
    return batchData.filter(item => {
      // Search
      if (searchTerm && !item.student_id.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      // Risk filter
      if (riskFilter !== 'all' && item.predicted_risk_level !== riskFilter) {
        return false;
      }
      // Performance tier filter
      if (tierFilter !== 'all' && item.predicted_performance_tier !== tierFilter) {
        return false;
      }
      // Discrepancy
      if (discrepancyOnly && item.prediction_match) {
        return false;
      }
      return true;
    }).sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortAsc ? valA - valB : valB - valA;
      }
      return sortAsc
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [batchData, searchTerm, riskFilter, tierFilter, discrepancyOnly, sortField, sortAsc]);

  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, page, pageSize]);

  const handleSort = (field: keyof BatchPredictionItem) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const highRiskCount = batchData.filter(d => d.predicted_risk_level === 'High').length;
  const mediumRiskCount = batchData.filter(d => d.predicted_risk_level === 'Medium').length;
  const lowRiskCount = batchData.filter(d => d.predicted_risk_level === 'Low').length;

  return (
    <div className="space-y-5">
      {/* Controls Bar */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <TableIcon className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-bold text-slate-900">
                1,000-Student Cohort Batch Prediction Table
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Live batch inference generated via <span className="font-semibold text-indigo-600">{activeModelName}</span>
            </p>
          </div>

          {/* Export CSV Button */}
          <button
            onClick={onExportCsv}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Results CSV (1,000 Records)</span>
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
          {/* Search ID */}
          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Student ID (e.g. STU-0042)..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* Risk Level Filter */}
          <div className="flex items-center gap-1">
            <span className="text-slate-500 font-medium">Risk:</span>
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5 font-medium">
              <button
                onClick={() => { setRiskFilter('all'); setPage(1); }}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  riskFilter === 'all' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600'
                }`}
              >
                All ({batchData.length})
              </button>
              <button
                onClick={() => { setRiskFilter('High'); setPage(1); }}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  riskFilter === 'High' ? 'bg-rose-600 text-white font-bold shadow-2xs' : 'text-rose-700 hover:bg-rose-50'
                }`}
              >
                High ({highRiskCount})
              </button>
              <button
                onClick={() => { setRiskFilter('Medium'); setPage(1); }}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  riskFilter === 'Medium' ? 'bg-amber-500 text-white font-bold shadow-2xs' : 'text-amber-700 hover:bg-amber-50'
                }`}
              >
                Medium ({mediumRiskCount})
              </button>
              <button
                onClick={() => { setRiskFilter('Low'); setPage(1); }}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  riskFilter === 'Low' ? 'bg-emerald-600 text-white font-bold shadow-2xs' : 'text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                Low ({lowRiskCount})
              </button>
            </div>
          </div>

          {/* Performance Tier Filter */}
          <div className="flex items-center gap-1">
            <span className="text-slate-500 font-medium">Tier:</span>
            <select
              value={tierFilter}
              onChange={(e) => { setTierFilter(e.target.value as any); setPage(1); }}
              className="py-1 px-2 rounded-md border border-slate-300 bg-white text-xs text-slate-700 focus:outline-none"
            >
              <option value="all">All Tiers</option>
              <option value="High">High (≥75%)</option>
              <option value="Average">Average (50-74%)</option>
              <option value="Low">Low (&lt;50%)</option>
            </select>
          </div>

          {/* Discrepancy Toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer ml-auto">
            <input
              type="checkbox"
              checked={discrepancyOnly}
              onChange={(e) => { setDiscrepancyOnly(e.target.checked); setPage(1); }}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-slate-600 font-medium">Show Misclassifications Only</span>
          </label>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-800 font-semibold border-b border-slate-200 select-none">
                <th
                  onClick={() => handleSort('student_id')}
                  className="py-3 px-3.5 cursor-pointer hover:bg-slate-200/70"
                >
                  <div className="flex items-center gap-1">
                    <span>Student ID</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('attendance_rate')}
                  className="py-3 px-3.5 cursor-pointer hover:bg-slate-200/70"
                >
                  <div className="flex items-center gap-1">
                    <span>Attendance</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('study_hours_weekly')}
                  className="py-3 px-3.5 cursor-pointer hover:bg-slate-200/70"
                >
                  <div className="flex items-center gap-1">
                    <span>Study Time</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('midterm1_score')}
                  className="py-3 px-3.5 cursor-pointer hover:bg-slate-200/70"
                >
                  <div className="flex items-center gap-1">
                    <span>Midterm 1</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('midterm2_score')}
                  className="py-3 px-3.5 cursor-pointer hover:bg-slate-200/70"
                >
                  <div className="flex items-center gap-1">
                    <span>Midterm 2</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('past_failures')}
                  className="py-3 px-3.5 cursor-pointer hover:bg-slate-200/70"
                >
                  <div className="flex items-center gap-1">
                    <span>Failures</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('final_grade')}
                  className="py-3 px-3.5 cursor-pointer hover:bg-slate-200/70"
                >
                  <div className="flex items-center gap-1">
                    <span>Actual Grade</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('predicted_grade')}
                  className="py-3 px-3.5 cursor-pointer hover:bg-slate-200/70"
                >
                  <div className="flex items-center gap-1">
                    <span>Pred Grade</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('predicted_performance_tier')}
                  className="py-3 px-3.5 cursor-pointer hover:bg-slate-200/70"
                >
                  <div className="flex items-center gap-1">
                    <span>Performance Tier</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('predicted_risk_level')}
                  className="py-3 px-3.5 cursor-pointer hover:bg-slate-200/70"
                >
                  <div className="flex items-center gap-1">
                    <span>Risk Level</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('predicted_risk_prob')}
                  className="py-3 px-3.5 cursor-pointer hover:bg-slate-200/70"
                >
                  <div className="flex items-center gap-1">
                    <span>Risk Prob</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-500 font-medium">
                    No students matching the current filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedData.map((row) => (
                  <tr
                    key={row.student_id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      row.predicted_risk_level === 'High' ? 'bg-rose-50/30' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3.5 font-mono font-bold text-slate-900">
                      {row.student_id}
                    </td>
                    <td className="py-2.5 px-3.5">
                      <span className={`font-semibold ${row.attendance_rate < 75 ? 'text-rose-600 font-bold' : 'text-slate-800'}`}>
                        {row.attendance_rate}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-600">
                      {row.study_hours_weekly} hrs
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-600">
                      {row.midterm1_score}
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-600">
                      {row.midterm2_score}
                    </td>
                    <td className="py-2.5 px-3.5">
                      <span className={row.past_failures > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}>
                        {row.past_failures}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 font-medium text-slate-700">
                      {row.final_grade}%
                    </td>
                    <td className="py-2.5 px-3.5 font-bold text-indigo-700">
                      {row.predicted_grade}%
                    </td>
                    <td className="py-2.5 px-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          row.predicted_performance_tier === 'High'
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            : row.predicted_performance_tier === 'Average'
                            ? 'bg-slate-100 text-slate-700'
                            : 'bg-rose-100 text-rose-800 border border-rose-200'
                        }`}
                      >
                        {row.predicted_performance_tier}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          row.predicted_risk_level === 'High'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : row.predicted_risk_level === 'Medium'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {row.predicted_risk_level}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 font-mono font-medium">
                      <span className={row.predicted_risk_prob > 50 ? 'text-rose-600 font-bold' : 'text-slate-600'}>
                        {row.predicted_risk_prob}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
          <div>
            Showing <strong className="text-slate-900">{Math.min(filteredData.length, (page - 1) * pageSize + 1)}</strong> to{' '}
            <strong className="text-slate-900">{Math.min(filteredData.length, page * pageSize)}</strong> of{' '}
            <strong className="text-slate-900">{filteredData.length}</strong> students
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold text-slate-800">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
