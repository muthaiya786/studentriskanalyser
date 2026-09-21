import React, { useRef } from 'react';
import {
  GraduationCap,
  Download,
  Upload,
  RefreshCw,
  Cpu,
  BookOpen,
  CheckCircle2,
  Server
} from 'lucide-react';
import Papa from 'papaparse';
import { RawStudentData } from '../types.ts';

interface HeaderProps {
  totalCount: number;
  onResetDataset: () => void;
  onUploadData: (data: RawStudentData[]) => void;
  onDownloadSampleCsv: () => void;
  onOpenFdpHub: () => void;
  backendHealthy: boolean;
  activeModelName: string;
}

export const Header: React.FC<HeaderProps> = ({
  totalCount,
  onResetDataset,
  onUploadData,
  onDownloadSampleCsv,
  onOpenFdpHub,
  backendHealthy,
  activeModelName
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse<any>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data && results.data.length > 0) {
          const parsedStudents: RawStudentData[] = results.data.map((row, idx) => ({
            student_id: row.student_id || row.id || `STU-${String(idx + 1).padStart(4, '0')}`,
            gender: row.gender || (idx % 2 === 0 ? 'F' : 'M'),
            age: Number(row.age) || 18,
            study_hours_weekly: Number(row.study_hours_weekly ?? row.study_time ?? row.studyhours) || 8,
            attendance_rate: Number(row.attendance_rate ?? row.attendance) || 75,
            past_failures: Number(row.past_failures ?? row.failures) || 0,
            midterm1_score: Number(row.midterm1_score ?? row.g1 ?? row.test1) || 60,
            midterm2_score: Number(row.midterm2_score ?? row.g2 ?? row.test2) || 62,
            absences: Number(row.absences) || 4,
            internet_access: row.internet_access ?? 'yes',
            school_support: row.school_support ?? 'no',
            family_support: row.family_support ?? 'yes',
            extracurriculars: row.extracurriculars ?? 'yes',
            desires_higher_ed: row.desires_higher_ed ?? 'yes',
            final_grade: Number(row.final_grade ?? row.g3 ?? row.score) || 65
          }));
          onUploadData(parsedStudents);
        }
      },
      error: (err) => {
        console.error('CSV Parsing error:', err);
      }
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Logo & Title */}
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                  Student Performance AI &amp; Risk Predictor
                </h1>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  FDP Workshop Edition
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Machine Learning Early Warning System • 1,000-Student Predictive Pipeline
              </p>
            </div>
          </div>

          {/* Action Tools & Status */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Backend Status Indicator */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200" title="Full-Stack Backend Health">
              <Server className="w-3.5 h-3.5 text-emerald-600" />
              <span>FastAPI/Express</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>

            {/* Active Model Badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-50 text-indigo-800 border border-indigo-200">
              <Cpu className="w-3.5 h-3.5 text-indigo-600" />
              <span>{activeModelName}</span>
            </div>

            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".csv"
              className="hidden"
            />

            {/* Upload CSV */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
              title="Upload your own student cohort CSV"
            >
              <Upload className="w-3.5 h-3.5 text-slate-600" />
              <span>Upload CSV</span>
            </button>

            {/* Download Sample CSV */}
            <button
              onClick={onDownloadSampleCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
              title="Download 1,000-Student Standard CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>1k Sample CSV</span>
            </button>

            {/* Reset Dataset */}
            <button
              onClick={onResetDataset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
              title="Reset to fresh synthetic 1,000 dataset"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden sm:inline">Reset Data</span>
            </button>

            {/* FDP Activity Hub Button */}
            <button
              onClick={onOpenFdpHub}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-xs"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>FDP Activity Hub</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
