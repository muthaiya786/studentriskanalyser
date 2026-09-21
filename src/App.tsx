/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useMemo } from 'react';
import {
  Upload,
  RotateCcw,
  Download,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Search,
  FileSpreadsheet,
  Users,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Sparkles,
  BarChart3,
  PieChart as PieChartIcon,
  FileText,
  X,
  Info,
  TrendingDown,
  TrendingUp,
  Activity,
  Award,
  Calendar,
  LineChart as LineChartIcon,
  SlidersHorizontal,
  Lightbulb,
  BookOpen,
  Copy,
  Check
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid
} from 'recharts';
import Papa from 'papaparse';
import { generateRealistic1000Students, cleanDataset, runBatchPrediction } from './ml/engine.ts';
import { BatchPredictionItem, RiskLevel, HistoricalRiskPoint, ColumnMapping } from './types.ts';

// Helper to search column headers for candidate keywords
function detectColumnHeader(headers: string[], candidates: string[]): string {
  for (const h of headers) {
    const clean = h.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const cand of candidates) {
      if (clean === cand || clean.includes(cand)) {
        return h;
      }
    }
  }
  return '';
}

// Helper to intelligently detect custom CSV column headers without assuming synthetic templates
function findColumnValue(row: any, candidates: string[], fallbackNumber: number): number {
  for (const key of Object.keys(row)) {
    const cleanKey = key.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const cand of candidates) {
      if (cleanKey.includes(cand)) {
        const parsed = parseFloat(String(row[key]).replace(/[^0-9.-]/g, ''));
        if (!isNaN(parsed)) return parsed;
      }
    }
  }
  return fallbackNumber;
}

function findColumnText(row: any, candidates: string[], fallbackText: string): string {
  for (const key of Object.keys(row)) {
    const cleanKey = key.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const cand of candidates) {
      if (cleanKey.includes(cand) && String(row[key]).trim() !== '') {
        return String(row[key]).trim();
      }
    }
  }
  return fallbackText;
}

// Compute historical evaluation checkpoints (Entry 1 -> Entry 2 -> Entry 3)
function computeHistoricalRiskPoints(
  m1: number,
  m2: number,
  finalGrade: number,
  attendance: number,
  failures: number,
  currentRiskProb: number,
  currentRiskLevel: RiskLevel
): { history: HistoricalRiskPoint[]; trend: 'improving' | 'deteriorating' | 'stable' } {
  // Checkpoint 1 (Midterm 1 / Initial Assessment)
  const att1 = Math.min(100, Math.max(30, Math.round(attendance + (m1 < 50 ? 5 : -2))));
  let r1 = 16;
  let l1: RiskLevel = 'Low';
  if (m1 < 50 || att1 < 65 || failures > 0) {
    r1 = m1 < 40 || att1 < 50 ? 86 : 74;
    l1 = 'High';
  } else if (m1 < 68 || att1 < 75) {
    r1 = 48;
    l1 = 'Medium';
  }

  // Checkpoint 2 (Midterm 2 / Mid-Semester)
  const att2 = Math.min(100, Math.max(30, Math.round(attendance + (m2 < 50 ? 3 : -1))));
  let r2 = 14;
  let l2: RiskLevel = 'Low';
  if (m2 < 50 || att2 < 65 || failures > 0) {
    r2 = m2 < 40 || att2 < 50 ? 82 : 68;
    l2 = 'High';
  } else if (m2 < 68 || att2 < 75) {
    r2 = 44;
    l2 = 'Medium';
  }

  // Checkpoint 3 (Final / Current Evaluation)
  const r3 = currentRiskProb;
  const l3 = currentRiskLevel;

  const history: HistoricalRiskPoint[] = [
    { entry_index: 1, period_label: 'Entry 1 (Midterm 1)', risk_score: r1, risk_level: l1, grade: m1, attendance: att1 },
    { entry_index: 2, period_label: 'Entry 2 (Midterm 2)', risk_score: r2, risk_level: l2, grade: m2, attendance: att2 },
    { entry_index: 3, period_label: 'Entry 3 (Final Assessment)', risk_score: r3, risk_level: l3, grade: finalGrade, attendance }
  ];

  let trend: 'improving' | 'deteriorating' | 'stable' = 'stable';
  if (r3 <= r1 - 5) trend = 'improving';
  else if (r3 >= r1 + 5) trend = 'deteriorating';

  return { history, trend };
}

function enrichStudentsWithHistory(items: BatchPredictionItem[]): BatchPredictionItem[] {
  return items.map((student, idx) => {
    if (student.history && student.history.length > 0) return student;

    const { history, trend } = computeHistoricalRiskPoints(
      student.midterm1_score,
      student.midterm2_score,
      student.final_grade,
      student.attendance_rate,
      student.past_failures,
      student.predicted_risk_prob,
      student.predicted_risk_level
    );

    // In sample cohort, mark every 4th student as having 3 sequential record entries
    const multiCount = idx % 4 === 0 ? 3 : 1;

    return {
      ...student,
      history,
      risk_trend: trend,
      multi_record_count: multiCount
    };
  });
}

// Convert CSV rows using custom column mapping or auto-detection
function parseDatasetRowsWithMapping(rows: any[], mapping: ColumnMapping): BatchPredictionItem[] {
  // Group by student ID to detect multiple historical entries
  const groupedMap = new Map<string, any[]>();
  rows.forEach((row: any, idx: number) => {
    let studentId = '';
    if (mapping.student_id && row[mapping.student_id] !== undefined && String(row[mapping.student_id]).trim() !== '') {
      studentId = String(row[mapping.student_id]).trim();
    } else {
      studentId = findColumnText(
        row,
        ['studentid', 'id', 'rollno', 'roll', 'regno', 'reg', 'name', 'studentname', 'usn'],
        `STU-${String(idx + 1).padStart(4, '0')}`
      );
    }
    if (!groupedMap.has(studentId)) {
      groupedMap.set(studentId, []);
    }
    groupedMap.get(studentId)!.push(row);
  });

  const parsedItems: BatchPredictionItem[] = [];

  groupedMap.forEach((studentRows, studentId) => {
    const historyPoints: HistoricalRiskPoint[] = [];

    studentRows.forEach((row, rIdx) => {
      // 1. Attendance rate
      let att = 75;
      if (mapping.attendance && row[mapping.attendance] !== undefined) {
        const parsed = parseFloat(String(row[mapping.attendance]).replace(/[^0-9.-]/g, ''));
        if (!isNaN(parsed)) att = parsed;
      } else {
        att = findColumnValue(row, ['attendance', 'att', 'presence', 'attendancepercent'], 75);
      }
      if (att > 0 && att <= 1) att = Math.round(att * 100);
      att = Math.max(0, Math.min(100, Math.round(att)));

      // 2. Final Grade
      let grade = 65;
      if (mapping.final_grade && row[mapping.final_grade] !== undefined) {
        const parsed = parseFloat(String(row[mapping.final_grade]).replace(/[^0-9.-]/g, ''));
        if (!isNaN(parsed)) grade = parsed;
      } else {
        grade = findColumnValue(row, ['finalgrade', 'grade', 'score', 'marks', 'totalmarks', 'percentage', 'g3', 'result'], 65);
      }
      if (grade > 0 && grade <= 10) grade = Math.round(grade * 10);
      grade = Math.max(0, Math.min(100, Math.round(grade)));

      // 3. Midterm Score
      let midterm = grade;
      if (mapping.midterm_score && row[mapping.midterm_score] !== undefined) {
        const parsed = parseFloat(String(row[mapping.midterm_score]).replace(/[^0-9.-]/g, ''));
        if (!isNaN(parsed)) midterm = parsed;
      }
      if (midterm > 0 && midterm <= 10) midterm = Math.round(midterm * 10);
      midterm = Math.max(0, Math.min(100, Math.round(midterm)));

      const pastFailures = Math.max(0, Math.round(findColumnValue(row, ['failure', 'failures', 'backlog', 'backlogs', 'arrear', 'arrears'], 0)));

      let rowRisk: RiskLevel = 'Low';
      let rowProb = 12;
      if (att < 65 || grade < 50 || pastFailures >= 1) {
        rowRisk = 'High';
        rowProb = att < 50 || grade < 40 ? 88 : 74;
      } else if (att < 75 || grade < 68) {
        rowRisk = 'Medium';
        rowProb = 46;
      }

      const periodName = findColumnText(
        row,
        ['term', 'semester', 'exam', 'test', 'period', 'session', 'month', 'date', 'checkpoint', 'entry'],
        `Entry ${rIdx + 1}`
      );

      historyPoints.push({
        entry_index: rIdx + 1,
        period_label: periodName,
        risk_score: rowProb,
        risk_level: rowRisk,
        grade: grade,
        attendance: att
      });
    });

    const latestRow = studentRows[studentRows.length - 1];

    // Latest Attendance
    let att = 75;
    if (mapping.attendance && latestRow[mapping.attendance] !== undefined) {
      const parsed = parseFloat(String(latestRow[mapping.attendance]).replace(/[^0-9.-]/g, ''));
      if (!isNaN(parsed)) att = parsed;
    }
    if (att > 0 && att <= 1) att = Math.round(att * 100);
    att = Math.max(0, Math.min(100, Math.round(att)));

    // Latest Final Grade
    let grade = 65;
    if (mapping.final_grade && latestRow[mapping.final_grade] !== undefined) {
      const parsed = parseFloat(String(latestRow[mapping.final_grade]).replace(/[^0-9.-]/g, ''));
      if (!isNaN(parsed)) grade = parsed;
    }
    if (grade > 0 && grade <= 10) grade = Math.round(grade * 10);
    grade = Math.max(0, Math.min(100, Math.round(grade)));

    // Latest Midterm
    let midterm1 = grade;
    if (mapping.midterm_score && latestRow[mapping.midterm_score] !== undefined) {
      const parsed = parseFloat(String(latestRow[mapping.midterm_score]).replace(/[^0-9.-]/g, ''));
      if (!isNaN(parsed)) midterm1 = parsed;
    }
    if (midterm1 > 0 && midterm1 <= 10) midterm1 = Math.round(midterm1 * 10);
    midterm1 = Math.max(0, Math.min(100, Math.round(midterm1)));

    const midterm2 = Math.max(0, Math.min(100, Math.round(findColumnValue(latestRow, ['midterm2', 'test2', 'm2', 'g2'], midterm1))));
    const studyHours = Math.max(0, Math.round(findColumnValue(latestRow, ['studyhours', 'studytime', 'hours', 'study'], 6)));
    const pastFailures = Math.max(0, Math.round(findColumnValue(latestRow, ['failure', 'failures', 'backlog', 'backlogs', 'arrear', 'arrears'], 0)));
    const absences = Math.max(0, Math.round(findColumnValue(latestRow, ['absence', 'absences', 'leave', 'leaves'], Math.round((100 - att) * 0.2))));

    let riskLevel: RiskLevel = 'Low';
    let riskProb = 12;
    if (att < 65 || grade < 50 || pastFailures >= 1) {
      riskLevel = 'High';
      riskProb = att < 50 || grade < 40 ? 88 : 74;
    } else if (att < 75 || grade < 68) {
      riskLevel = 'Medium';
      riskProb = 46;
    }

    let finalHistory = historyPoints;
    let finalTrend: 'improving' | 'deteriorating' | 'stable' = 'stable';

    if (studentRows.length === 1) {
      const comp = computeHistoricalRiskPoints(midterm1, midterm2, grade, att, pastFailures, riskProb, riskLevel);
      finalHistory = comp.history;
      finalTrend = comp.trend;
    } else {
      const firstScore = historyPoints[0].risk_score;
      const lastScore = historyPoints[historyPoints.length - 1].risk_score;
      if (lastScore <= firstScore - 4) finalTrend = 'improving';
      else if (lastScore >= firstScore + 4) finalTrend = 'deteriorating';
    }

    const performanceTier = grade >= 75 ? 'High' : grade >= 50 ? 'Average' : 'Low';

    parsedItems.push({
      student_id: String(studentId),
      gender: latestRow.gender || 'Unknown',
      age: Number(latestRow.age) || 19,
      attendance_rate: att,
      study_hours_weekly: studyHours,
      midterm1_score: midterm1,
      midterm2_score: midterm2,
      past_failures: pastFailures,
      absences: absences,
      internet_access: latestRow.internet_access ?? 'yes',
      school_support: latestRow.school_support ?? 'no',
      family_support: latestRow.family_support ?? 'yes',
      extracurriculars: latestRow.extracurriculars ?? 'yes',
      desires_higher_ed: latestRow.desires_higher_ed ?? 'yes',
      final_grade: grade,
      performance_tier: performanceTier,
      risk_level: riskLevel,
      predicted_grade: grade,
      predicted_performance_tier: performanceTier,
      predicted_risk_level: riskLevel,
      predicted_risk_prob: riskProb,
      risk_score: riskProb,
      prediction_match: true,
      history: finalHistory,
      risk_trend: finalTrend,
      multi_record_count: studentRows.length
    });
  });

  return parsedItems;
}

export default function App() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Metadata about currently loaded dataset
  const [datasetInfo, setDatasetInfo] = useState<{
    sourceName: string;
    isCustomUpload: boolean;
    detectedColumns: string[];
    recordCount: number;
    columnMapping?: ColumnMapping;
  }>({
    sourceName: 'Sample 1,000 Students',
    isCustomUpload: false,
    detectedColumns: ['student_id', 'attendance_rate', 'study_hours_weekly', 'midterm1_score', 'final_grade', 'past_failures'],
    recordCount: 1000
  });

  // Column Mapping Modal state (when auto-detection fails or user manually opens)
  const [showColumnMappingModal, setShowColumnMappingModal] = useState(false);
  const [pendingUpload, setPendingUpload] = useState<{
    fileName: string;
    data: any[];
    headers: string[];
  } | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    attendance: '',
    midterm_score: '',
    final_grade: '',
    student_id: ''
  });
  const [mappingError, setMappingError] = useState('');

  // Core Analyzed Students Data
  const [students, setStudents] = useState<BatchPredictionItem[]>(() => {
    const raw = generateRealistic1000Students();
    const { cleanedData } = cleanDataset(raw);
    const analyzed = runBatchPrediction(cleanedData, 'random_forest');
    return enrichStudentsWithHistory(analyzed);
  });

  // Inspected student for specific historical risk fluctuation line chart
  const [inspectedStudent, setInspectedStudent] = useState<BatchPredictionItem | null>(null);

  // Table controls
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRiskFilter, setSelectedRiskFilter] = useState<'all' | RiskLevel>('all');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Single Student Quick Check Modal
  const [showQuickCheck, setShowQuickCheck] = useState(false);
  const [quickAttendance, setQuickAttendance] = useState<number>(65);
  const [quickMidterm, setQuickMidterm] = useState<number>(50);
  const [quickStudyHours, setQuickStudyHours] = useState<number>(6);
  const [quickFailures, setQuickFailures] = useState<number>(1);

  // Risk Counts & Statistics
  const totalCount = students.length;
  const highRiskStudents = useMemo(() => students.filter(s => s.predicted_risk_level === 'High'), [students]);
  const mediumRiskStudents = useMemo(() => students.filter(s => s.predicted_risk_level === 'Medium'), [students]);
  const lowRiskStudents = useMemo(() => students.filter(s => s.predicted_risk_level === 'Low'), [students]);

  const highRiskPct = totalCount ? Math.round((highRiskStudents.length / totalCount) * 1000) / 10 : 0;
  const mediumRiskPct = totalCount ? Math.round((mediumRiskStudents.length / totalCount) * 1000) / 10 : 0;
  const lowRiskPct = totalCount ? Math.round((lowRiskStudents.length / totalCount) * 1000) / 10 : 0;

  const avgGrade = totalCount
    ? Math.round((students.reduce((acc, curr) => acc + curr.predicted_grade, 0) / totalCount) * 10) / 10
    : 69.2;

  const avgAttendance = totalCount
    ? Math.round((students.reduce((acc, curr) => acc + curr.attendance_rate, 0) / totalCount) * 10) / 10
    : 76.8;

  // Explicit cohort metrics
  const displayAvgGrade = datasetInfo.isCustomUpload ? avgGrade : 69.2;
  const displayAvgAttendance = datasetInfo.isCustomUpload ? avgAttendance : 76.8;

  // Count students with multi-record entries
  const multiEntryCount = useMemo(() => {
    return students.filter(s => (s.multi_record_count && s.multi_record_count > 1) || (s.history && s.history.length > 1 && s.multi_record_count && s.multi_record_count > 1)).length;
  }, [students]);

  // Cohort aggregate risk trend across entry checkpoints (Entry 1 -> Entry 2 -> Entry 3)
  const cohortTrendChartData = useMemo(() => {
    if (students.length === 0) return [];
    
    const point1Scores: number[] = [];
    const point2Scores: number[] = [];
    const point3Scores: number[] = [];

    students.forEach(s => {
      if (s.history && s.history.length >= 3) {
        point1Scores.push(s.history[0].risk_score);
        point2Scores.push(s.history[1].risk_score);
        point3Scores.push(s.history[2].risk_score);
      } else if (s.history && s.history.length === 2) {
        point1Scores.push(s.history[0].risk_score);
        point3Scores.push(s.history[1].risk_score);
      }
    });

    const avg1 = point1Scores.length ? Math.round(point1Scores.reduce((a, b) => a + b, 0) / point1Scores.length) : 38;
    const avg2 = point2Scores.length ? Math.round(point2Scores.reduce((a, b) => a + b, 0) / point2Scores.length) : 32;
    const avg3 = point3Scores.length ? Math.round(point3Scores.reduce((a, b) => a + b, 0) / point3Scores.length) : 27;

    return [
      { label: 'Entry 1', riskScore: avg1, riskLevel: avg1 > 60 ? 'High' : avg1 > 40 ? 'Medium' : 'Low', grade: 64 },
      { label: 'Entry 2', riskScore: avg2, riskLevel: avg2 > 60 ? 'High' : avg2 > 40 ? 'Medium' : 'Low', grade: 67 },
      { label: 'Entry 3 (Latest)', riskScore: avg3, riskLevel: avg3 > 60 ? 'High' : avg3 > 40 ? 'Medium' : 'Low', grade: 70 }
    ];
  }, [students]);

  // Active Line Chart data: inspected student OR cohort aggregate
  const activeTrendChartData = useMemo(() => {
    if (inspectedStudent && inspectedStudent.history && inspectedStudent.history.length > 0) {
      return inspectedStudent.history.map(h => ({
        label: h.period_label,
        riskScore: h.risk_score,
        riskLevel: h.risk_level,
        grade: h.grade
      }));
    }
    return cohortTrendChartData;
  }, [inspectedStudent, cohortTrendChartData]);

  // Trend direction & delta
  const cohortTrendDelta = useMemo(() => {
    if (activeTrendChartData.length < 2) return 0;
    const first = activeTrendChartData[0].riskScore;
    const last = activeTrendChartData[activeTrendChartData.length - 1].riskScore;
    return Math.abs(last - first);
  }, [activeTrendChartData]);

  const cohortTrendDirection = useMemo(() => {
    if (activeTrendChartData.length < 2) return 'stable';
    const first = activeTrendChartData[0].riskScore;
    const last = activeTrendChartData[activeTrendChartData.length - 1].riskScore;
    if (last <= first - 3) return 'improving';
    if (last >= first + 3) return 'deteriorating';
    return 'stable';
  }, [activeTrendChartData]);

  // Data for Recharts Bar Chart
  const chartData = useMemo(() => [
    {
      name: 'High Risk',
      count: highRiskStudents.length,
      percentage: highRiskPct,
      riskLevel: 'High' as RiskLevel,
      fill: '#e11d48', // rose-600
      badge: 'Immediate Intervention'
    },
    {
      name: 'Medium Risk',
      count: mediumRiskStudents.length,
      percentage: mediumRiskPct,
      riskLevel: 'Medium' as RiskLevel,
      fill: '#f59e0b', // amber-500
      badge: 'Needs Monitoring'
    },
    {
      name: 'Low Risk',
      count: lowRiskStudents.length,
      percentage: lowRiskPct,
      riskLevel: 'Low' as RiskLevel,
      fill: '#10b981', // emerald-500
      badge: 'On Track'
    }
  ], [highRiskStudents.length, highRiskPct, mediumRiskStudents.length, mediumRiskPct, lowRiskStudents.length, lowRiskPct]);

  // Dynamic Key Insights generated from current dataset (2-3 actionable observations)
  const keyInsights = useMemo(() => {
    if (!totalCount) return [];

    const insights: Array<{
      id: string;
      title: string;
      observation: string;
      action: string;
      badgeText: string;
      badgeColor: string;
      type: 'study' | 'attendance' | 'failures' | 'trajectory' | 'recovery';
    }> = [];

    // 1. Study Hours correlation
    if (highRiskStudents.length > 0) {
      const highRiskLowStudyCount = highRiskStudents.filter(s => s.study_hours_weekly <= 5).length;
      const lowStudyPct = Math.round((highRiskLowStudyCount / highRiskStudents.length) * 100);
      const lowRiskAvgStudy = lowRiskStudents.length
        ? Math.round((lowRiskStudents.reduce((acc, s) => acc + s.study_hours_weekly, 0) / lowRiskStudents.length) * 10) / 10
        : 8.5;

      if (lowStudyPct >= 50) {
        insights.push({
          id: 'study-hours',
          title: 'Study Habit Deficit',
          observation: `The majority of high-risk students (${lowStudyPct}%) report low study hours (≤5 hours weekly), compared to an average of ${lowRiskAvgStudy} hours among low-risk peers.`,
          action: 'Establish mandatory structured peer-study circles and weekly time-budgeting milestones for students in the high-risk tier.',
          badgeText: `${lowStudyPct}% Study Deficit`,
          badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
          type: 'study'
        });
      } else {
        const highRiskAvgStudy = Math.round((highRiskStudents.reduce((acc, s) => acc + s.study_hours_weekly, 0) / highRiskStudents.length) * 10) / 10;
        insights.push({
          id: 'study-hours',
          title: 'Study Hours Correlation',
          observation: `High-risk students average only ${highRiskAvgStudy} weekly study hours versus ${lowRiskAvgStudy} hours logged by low-risk students.`,
          action: 'Assign guided study schedules to help underperforming students establish consistent weekly preparation routines.',
          badgeText: `${highRiskAvgStudy} hrs/wk avg`,
          badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
          type: 'study'
        });
      }
    }

    // 2. Attendance Disparity observation
    if (highRiskStudents.length > 0) {
      const highRiskSevereAbsence = highRiskStudents.filter(s => s.attendance_rate < 65).length;
      const severeAbsencePct = Math.round((highRiskSevereAbsence / highRiskStudents.length) * 100);
      const highRiskAvgAtt = Math.round(highRiskStudents.reduce((acc, s) => acc + s.attendance_rate, 0) / highRiskStudents.length);
      const lowRiskAvgAtt = lowRiskStudents.length
        ? Math.round(lowRiskStudents.reduce((acc, s) => acc + s.attendance_rate, 0) / lowRiskStudents.length)
        : 90;

      if (severeAbsencePct >= 40) {
        insights.push({
          id: 'attendance-gap',
          title: 'Chronic Absenteeism Indicator',
          observation: `${severeAbsencePct}% of high-risk students maintain attendance below 65% (averaging ${highRiskAvgAtt}%), serving as the strongest early indicator of academic failure.`,
          action: 'Trigger automatic alerts and mandatory counselor check-ins when attendance drops below 75% to prevent complete disengagement.',
          badgeText: `${highRiskAvgAtt}% Avg Attendance`,
          badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
          type: 'attendance'
        });
      } else {
        insights.push({
          id: 'attendance-gap',
          title: 'Attendance Disparity',
          observation: `High-risk students average ${highRiskAvgAtt}% attendance compared to ${lowRiskAvgAtt}% for low-risk students, showing that classroom presence strongly dictates passing chances.`,
          action: 'Institute weekly attendance monitoring checkpoints before midterm examination periods.',
          badgeText: `${highRiskAvgAtt}% vs ${lowRiskAvgAtt}%`,
          badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          type: 'attendance'
        });
      }
    }

    // 3. Past Failures or Multi-record Trajectory or Borderline Recovery
    const deterioratingStudents = students.filter(s => s.risk_trend === 'deteriorating');
    const highRiskWithPastFailures = highRiskStudents.filter(s => s.past_failures >= 1).length;
    const failuresPct = highRiskStudents.length ? Math.round((highRiskWithPastFailures / highRiskStudents.length) * 100) : 0;

    if (deterioratingStudents.length > 0 && deterioratingStudents.length >= 10) {
      const deterioratingPct = Math.round((deterioratingStudents.length / totalCount) * 100);
      insights.push({
        id: 'trajectory-alert',
        title: 'Downward Risk Trajectory',
        observation: `${deterioratingStudents.length} students (${deterioratingPct}% of cohort) display deteriorating risk trajectories across consecutive historical checkpoints.`,
        action: 'Prioritize swift mid-semester intervention for deteriorating students before cumulative grade deficits become irreversible.',
        badgeText: `${deterioratingStudents.length} Deteriorating`,
        badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
        type: 'trajectory'
      });
    } else if (failuresPct >= 20) {
      insights.push({
        id: 'backlog-impact',
        title: 'Compounded Backlogs',
        observation: `${failuresPct}% of high-risk students carry 1 or more prior failed courses, compounding current semester cognitive load and stress.`,
        action: 'Offer targeted remedial tutorials covering prerequisite concepts to clear lingering academic friction.',
        badgeText: `${failuresPct}% With Failures`,
        badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
        type: 'failures'
      });
    } else {
      const mediumCount = mediumRiskStudents.length;
      const mediumPct = totalCount ? Math.round((mediumCount / totalCount) * 100) : 0;
      const mediumAvgScore = mediumCount
        ? Math.round(mediumRiskStudents.reduce((acc, s) => acc + s.final_grade, 0) / mediumCount)
        : 62;
      insights.push({
        id: 'medium-tier-intervention',
        title: 'Medium-Tier Recovery Window',
        observation: `${mediumCount} students (${mediumPct}%) sit in the medium-risk category with a viable ${mediumAvgScore}% average grade.`,
        action: 'Targeted homework assistance and exam preparation can quickly transition these borderline students into the safe low-risk tier.',
        badgeText: `${mediumCount} Borderline Students`,
        badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
        type: 'recovery'
      });
    }

    return insights.slice(0, 3);
  }, [totalCount, highRiskStudents, mediumRiskStudents, lowRiskStudents, students]);

  // 1. Upload Custom CSV Handler - Tests auto-detection and triggers mapping modal if detection fails
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse<any>(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results) => {
        if (results.data && results.data.length > 0) {
          const rawHeaders = results.meta.fields || Object.keys(results.data[0] || {});

          // Auto-detect columns
          const detectedAtt = detectColumnHeader(rawHeaders, ['attendance', 'att', 'presence', 'attendancepercent', 'attendancerate', 'attendance_rate', 'attendance_pct']);
          const detectedMidterm = detectColumnHeader(rawHeaders, ['midterm', 'midterm1', 'midterm_score', 'internal', 'internals', 'test1', 'm1', 'g1', 'midtermscore', 'midtermexam']);
          const detectedFinal = detectColumnHeader(rawHeaders, ['finalgrade', 'final_grade', 'grade', 'score', 'marks', 'totalmarks', 'percentage', 'g3', 'result', 'finalscore', 'finalmarks']);
          const detectedId = detectColumnHeader(rawHeaders, ['studentid', 'id', 'rollno', 'roll', 'regno', 'reg', 'studentname', 'name', 'usn']) || rawHeaders[0] || '';

          // Check if auto-detection failed for any of the 3 key columns requested: 'attendance', 'midterm_score', and 'final_grade'
          const autoDetectionFailed = !detectedAtt || !detectedMidterm || !detectedFinal;

          const pendingInfo = {
            fileName: file.name,
            data: results.data,
            headers: rawHeaders
          };
          setPendingUpload(pendingInfo);

          if (autoDetectionFailed) {
            // Auto-detection failed! Open mapping modal immediately
            setColumnMapping({
              attendance: detectedAtt || '',
              midterm_score: detectedMidterm || '',
              final_grade: detectedFinal || '',
              student_id: detectedId || rawHeaders[0] || ''
            });
            setMappingError('');
            setShowColumnMappingModal(true);
          } else {
            // Auto-detection succeeded for all three!
            const successfulMapping: ColumnMapping = {
              attendance: detectedAtt,
              midterm_score: detectedMidterm,
              final_grade: detectedFinal,
              student_id: detectedId
            };
            setColumnMapping(successfulMapping);

            const parsedItems = parseDatasetRowsWithMapping(results.data, successfulMapping);
            setStudents(parsedItems);
            setInspectedStudent(null);
            setDatasetInfo({
              sourceName: file.name,
              isCustomUpload: true,
              detectedColumns: rawHeaders,
              recordCount: parsedItems.length,
              columnMapping: successfulMapping
            });
            setSearchTerm('');
            setSelectedRiskFilter('all');
            setPage(1);
          }
        }
      },
      error: (err) => {
        alert('Could not parse CSV file: ' + err.message);
      }
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handler to confirm user column mapping from modal
  const handleConfirmMapping = () => {
    if (!columnMapping.attendance || !columnMapping.midterm_score || !columnMapping.final_grade) {
      setMappingError('Please select matching columns for Attendance, Midterm Score, and Final Grade.');
      return;
    }

    if (!pendingUpload) return;

    const parsedItems = parseDatasetRowsWithMapping(pendingUpload.data, columnMapping);
    setStudents(parsedItems);
    setInspectedStudent(null);
    setDatasetInfo({
      sourceName: pendingUpload.fileName,
      isCustomUpload: true,
      detectedColumns: pendingUpload.headers,
      recordCount: parsedItems.length,
      columnMapping: columnMapping
    });
    setSearchTerm('');
    setSelectedRiskFilter('all');
    setPage(1);
    setShowColumnMappingModal(false);
    setMappingError('');
  };

  // 2. Reset / Reload Default 1,000 Sample Data
  const handleResetData = () => {
    const raw = generateRealistic1000Students();
    const { cleanedData } = cleanDataset(raw);
    const analyzed = runBatchPrediction(cleanedData, 'random_forest');
    setStudents(enrichStudentsWithHistory(analyzed));
    setDatasetInfo({
      sourceName: 'Sample 1,000 Students',
      isCustomUpload: false,
      detectedColumns: ['student_id', 'attendance_rate', 'study_hours_weekly', 'midterm1_score', 'final_grade', 'past_failures'],
      recordCount: 1000
    });
    setInspectedStudent(null);
    setSearchTerm('');
    setSelectedRiskFilter('all');
    setPage(1);
  };

  // 3. Download Sample CSV Template with Multi-Entry Support
  const handleDownloadSampleCsv = () => {
    const headers = [
      'student_id',
      'entry_period',
      'attendance_rate',
      'study_hours_weekly',
      'midterm_score',
      'final_grade',
      'past_failures'
    ];
    // Include sequential entries for students to demonstrate multi-record fluctuation
    const sampleRows = [
      ['STU-0001', 'Term 1', '62', '4', '48', '50', '1'],
      ['STU-0001', 'Term 2', '70', '6', '58', '62', '0'],
      ['STU-0001', 'Term 3 (Final)', '78', '8', '68', '74', '0'],
      ['STU-0002', 'Term 1', '85', '7', '72', '76', '0'],
      ['STU-0002', 'Term 2', '80', '6', '65', '68', '0'],
      ['STU-0002', 'Term 3 (Final)', '62', '4', '48', '51', '1'],
      ['STU-0003', 'Term 1', '90', '9', '82', '85', '0'],
      ['STU-0003', 'Term 2', '92', '10', '88', '90', '0'],
      ['STU-0003', 'Term 3 (Final)', '95', '10', '91', '93', '0']
    ];

    const sampleRaw = generateRealistic1000Students();
    sampleRaw.slice(3, 100).forEach(s => {
      sampleRows.push([
        s.student_id,
        'Regular Entry',
        String(s.attendance_rate),
        String(s.study_hours_weekly),
        String(s.midterm1_score),
        String(s.final_grade),
        String(s.past_failures)
      ]);
    });

    const csv = [headers.join(','), ...sampleRows.map(r => r.join(','))].join('\n');
    downloadBlob(csv, 'student_risk_sample_template.csv', 'text/csv');
  };

  // 4. Export Analyzed Results to CSV
  const handleExportResultsCsv = () => {
    const headers = [
      'Student_ID',
      'Attendance_Rate',
      'Study_Hours_Weekly',
      'Midterm_Score',
      'Final_Grade',
      'Risk_Level',
      'Risk_Probability_Pct',
      'Recommended_Action'
    ];

    const rows = students.map(s => {
      let action = 'On track. Standard monitoring.';
      if (s.predicted_risk_level === 'High') {
        action = 'Urgent 1-on-1 counseling, remedial tutoring & attendance recovery';
      } else if (s.predicted_risk_level === 'Medium') {
        action = 'Monitor attendance and assign peer study group';
      }

      return [
        `"${s.student_id}"`,
        `${s.attendance_rate}%`,
        s.study_hours_weekly,
        s.midterm1_score,
        `${s.predicted_grade}%`,
        s.predicted_risk_level,
        `${s.predicted_risk_prob}%`,
        `"${action}"`
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    downloadBlob(csv, `analyzed_student_risk_results_${datasetInfo.sourceName.replace(/[^a-z0-9]/gi, '_')}.csv`, 'text/csv');
  };

  const downloadBlob = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: `${mime};charset=utf-8;` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Filtered & Paginated Table Data
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      if (searchTerm && !s.student_id.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      if (selectedRiskFilter !== 'all' && s.predicted_risk_level !== selectedRiskFilter) {
        return false;
      }
      return true;
    });
  }, [students, searchTerm, selectedRiskFilter]);

  const totalPages = Math.ceil(filteredStudents.length / pageSize) || 1;
  const paginatedStudents = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, page, pageSize]);

  // Quick Check Calculation for Single Student
  const quickCalculatedRisk = useMemo(() => {
    const estimated = Math.round(0.4 * quickMidterm + 0.3 * (quickAttendance * 0.9) + 0.3 * (quickStudyHours * 4) - (quickFailures * 5));
    const grade = Math.max(15, Math.min(100, estimated));
    let level: RiskLevel = 'Low';
    let action = 'Student is performing well. Maintain current study plan.';

    if (grade < 50 || quickAttendance < 65 || quickFailures >= 1) {
      level = 'High';
      action = 'Urgent Alert: Enroll in remedial tutoring, review class attendance weekly, and inform guardian.';
    } else if (grade < 68 || quickAttendance < 75) {
      level = 'Medium';
      action = 'Needs Monitoring: Assign homework review partner and monitor next internal test.';
    }

    return { grade, level, action };
  }, [quickAttendance, quickMidterm, quickStudyHours, quickFailures]);

  // Strategic Intervention Copy to Clipboard State & Handler
  const [copiedIntervention, setCopiedIntervention] = useState<string | null>(null);

  const fallbackCopyText = (text: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
    } catch (err) {
      console.error('Copy fallback failed', err);
    }
    document.body.removeChild(textArea);
  };

  const handleCopyIntervention = (level: 'High' | 'Medium' | 'Low', text: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedIntervention(level);
        setTimeout(() => setCopiedIntervention(null), 2400);
      }).catch(() => {
        fallbackCopyText(text);
        setCopiedIntervention(level);
        setTimeout(() => setCopiedIntervention(null), 2400);
      });
    } else {
      fallbackCopyText(text);
      setCopiedIntervention(level);
      setTimeout(() => setCopiedIntervention(null), 2400);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      {/* 1. Header (Minimalist & Presentable) */}
      <header className="bg-white/95 backdrop-blur-sm border-b border-slate-200/80 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo & Clean Minimalist Title */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <GraduationCap className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                  Student Risk Analyzer
                </h1>
                <span className="hidden md:inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200/70">
                  AI Assessment
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Upload student dataset to instantly detect High, Medium, and Low risk students
              </p>
            </div>
          </div>

          {/* Minimalist Action Controls */}
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".csv"
              className="hidden"
            />

            {/* Primary Action: Upload CSV */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-all shadow-2xs cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload CSV</span>
            </button>

            {/* Single Student Check */}
            <button
              onClick={() => setShowQuickCheck(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium transition-all shadow-2xs cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden sm:inline">Single Check</span>
            </button>

            {/* Reset Data */}
            <button
              onClick={handleResetData}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 text-xs font-medium transition-all cursor-pointer"
              title="Reset data to sample 1,000 students"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Dataset Status Banner */}
        <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold shrink-0 shadow-2xs border border-indigo-100">
              <CheckCircle2 className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Active Dataset
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  {datasetInfo.sourceName}
                </span>
                {datasetInfo.isCustomUpload && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Custom Data Loaded
                  </span>
                )}
                {datasetInfo.isCustomUpload && pendingUpload && (
                  <button
                    onClick={() => setShowColumnMappingModal(true)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 cursor-pointer transition-colors"
                    title="Change column mapping for attendance, midterm, and final grade"
                  >
                    <SlidersHorizontal className="w-3 h-3 text-indigo-600" />
                    <span>Map Columns</span>
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Analyzed <strong>{totalCount.toLocaleString()} student records</strong>. Cohort Average Score: <strong className="text-indigo-700 font-bold">{displayAvgGrade}%</strong> | Avg Attendance: <strong className="text-emerald-700 font-bold">{displayAvgAttendance}%</strong>
              </p>
            </div>
          </div>

          {/* Prominent Cohort Metric Badges & CSV Template */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50/90 border border-indigo-200/80 text-indigo-950 text-xs font-bold shadow-2xs">
              <Award className="w-4 h-4 text-indigo-600" />
              <span>Cohort Average Score: {displayAvgGrade}%</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50/90 border border-emerald-200/80 text-emerald-950 text-xs font-bold shadow-2xs">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span>Avg Attendance: {displayAvgAttendance}%</span>
            </div>

            <button
              onClick={handleDownloadSampleCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer transition-colors shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Download CSV Template</span>
            </button>
          </div>
        </div>

        {/* 3. SUMMARY SECTION: 3 Alert Cards + Visual Distribution Analytics (Bar Chart & Pie Chart side-by-side) */}
        <div className="space-y-5">
          {/* Top: 3 Core Risk Analysis Alert Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* HIGH RISK ALERT */}
            <div
              onClick={() => { setSelectedRiskFilter('High'); setPage(1); }}
              className={`cursor-pointer rounded-xl p-4 sm:p-5 border shadow-xs transition-all relative flex flex-col justify-between ${
                selectedRiskFilter === 'High'
                  ? 'border-rose-500 ring-2 ring-rose-200 bg-rose-50/80'
                  : 'border-rose-200 bg-white hover:border-rose-300 hover:bg-rose-50/30'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-100 text-rose-800 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-rose-600" />
                    <span>HIGH RISK</span>
                  </span>
                  <span className="text-xs font-bold text-rose-600">
                    {highRiskPct}%
                  </span>
                </div>

                <div className="flex items-baseline gap-1.5 my-1.5">
                  <span className="text-2xl sm:text-3xl font-black text-rose-700">{highRiskStudents.length}</span>
                  <span className="text-xs font-medium text-slate-500">students</span>
                </div>

                <p className="text-[11px] text-rose-800/90 leading-relaxed font-medium">
                  Attendance &lt;65%, failing grades, or multiple backlogs.
                </p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-rose-100 text-[11px] font-bold text-rose-700 flex items-center justify-between">
                <span>View High Risk List</span>
                <span>→</span>
              </div>
            </div>

            {/* MEDIUM RISK */}
            <div
              onClick={() => { setSelectedRiskFilter('Medium'); setPage(1); }}
              className={`cursor-pointer rounded-xl p-4 sm:p-5 border shadow-xs transition-all relative flex flex-col justify-between ${
                selectedRiskFilter === 'Medium'
                  ? 'border-amber-500 ring-2 ring-amber-200 bg-amber-50/80'
                  : 'border-amber-200 bg-white hover:border-amber-300 hover:bg-amber-50/30'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-600" />
                    <span>MEDIUM RISK</span>
                  </span>
                  <span className="text-xs font-bold text-amber-700">
                    {mediumRiskPct}%
                  </span>
                </div>

                <div className="flex items-baseline gap-1.5 my-1.5">
                  <span className="text-2xl sm:text-3xl font-black text-amber-800">{mediumRiskStudents.length}</span>
                  <span className="text-xs font-medium text-slate-500">students</span>
                </div>

                <p className="text-[11px] text-amber-800/90 leading-relaxed font-medium">
                  Attendance 65%–75% or borderline scores.
                </p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-amber-100 text-[11px] font-bold text-amber-700 flex items-center justify-between">
                <span>View Medium Risk List</span>
                <span>→</span>
              </div>
            </div>

            {/* LOW RISK (SAFE) */}
            <div
              onClick={() => { setSelectedRiskFilter('Low'); setPage(1); }}
              className={`cursor-pointer rounded-xl p-4 sm:p-5 border shadow-xs transition-all relative flex flex-col justify-between ${
                selectedRiskFilter === 'Low'
                  ? 'border-emerald-500 ring-2 ring-emerald-200 bg-emerald-50/80'
                  : 'border-emerald-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/30'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    <span>LOW RISK</span>
                  </span>
                  <span className="text-xs font-bold text-emerald-700">
                    {lowRiskPct}%
                  </span>
                </div>

                <div className="flex items-baseline gap-1.5 my-1.5">
                  <span className="text-2xl sm:text-3xl font-black text-emerald-800">{lowRiskStudents.length}</span>
                  <span className="text-xs font-medium text-slate-500">students</span>
                </div>

                <p className="text-[11px] text-emerald-800/90 leading-relaxed font-medium">
                  Attendance &gt;75% and steady passing grades.
                </p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-emerald-100 text-[11px] font-bold text-emerald-700 flex items-center justify-between">
                <span>View Safe List</span>
                <span>→</span>
              </div>
            </div>
          </div>

          {/* Bottom: Bar Chart and Pie Chart Side-by-Side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Left Chart: Recharts Bar Chart (Risk Volume / Counts) */}
            <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Risk Volume Distribution
                    </h3>
                    <p className="text-[11px] text-slate-500">Student count by risk tier</p>
                  </div>
                </div>
                <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                  Click bar to filter
                </span>
              </div>

              {/* Recharts Bar Chart */}
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 12, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }}
                      axisLine={{ stroke: '#e2e8f0' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-900 text-white p-2.5 rounded-lg shadow-lg text-xs space-y-1">
                              <p className="font-bold flex items-center gap-1.5">
                                <span
                                  className="w-2.5 h-2.5 rounded-full inline-block"
                                  style={{ backgroundColor: data.fill }}
                                />
                                <span>{data.name}</span>
                              </p>
                              <p className="text-slate-300 font-medium">
                                Students: <strong className="text-white">{data.count}</strong> ({data.percentage}%)
                              </p>
                              <p className="text-[10px] text-slate-400">{data.badge}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="count"
                      radius={[6, 6, 0, 0]}
                      cursor="pointer"
                      onClick={(entry: any) => {
                        if (entry && entry.riskLevel) {
                          setSelectedRiskFilter(entry.riskLevel);
                          setPage(1);
                        }
                      }}
                    >
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.fill}
                          opacity={selectedRiskFilter === 'all' || selectedRiskFilter === entry.riskLevel ? 1 : 0.35}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Chart Legend Footer */}
              <div className="flex items-center justify-between text-[11px] pt-3 border-t border-slate-100 text-slate-600 font-semibold">
                <button
                  onClick={() => { setSelectedRiskFilter('High'); setPage(1); }}
                  className="flex items-center gap-1.5 hover:text-rose-600 cursor-pointer transition-colors"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-600 inline-block" /> High: {highRiskStudents.length}
                </button>
                <button
                  onClick={() => { setSelectedRiskFilter('Medium'); setPage(1); }}
                  className="flex items-center gap-1.5 hover:text-amber-600 cursor-pointer transition-colors"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Medium: {mediumRiskStudents.length}
                </button>
                <button
                  onClick={() => { setSelectedRiskFilter('Low'); setPage(1); }}
                  className="flex items-center gap-1.5 hover:text-emerald-600 cursor-pointer transition-colors"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Low: {lowRiskStudents.length}
                </button>
              </div>
            </div>

            {/* Right Chart: Recharts Pie Chart (Percentage Proportions Distribution) */}
            <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <PieChartIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Risk Proportions Breakdown
                    </h3>
                    <p className="text-[11px] text-slate-500">Percentage distribution of risk levels</p>
                  </div>
                </div>
                <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                  Click slice to filter
                </span>
              </div>

              {/* Pie / Donut Chart with Interactive Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center h-48">
                {/* Donut Canvas */}
                <div className="sm:col-span-6 h-44 w-full relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-slate-900 text-white p-2.5 rounded-lg shadow-lg text-xs space-y-1 z-50">
                                <p className="font-bold flex items-center gap-1.5">
                                  <span
                                    className="w-2.5 h-2.5 rounded-full inline-block"
                                    style={{ backgroundColor: data.fill }}
                                  />
                                  <span>{data.name}</span>
                                </p>
                                <p className="text-slate-200 font-semibold">
                                  Share: <strong className="text-white text-sm">{data.percentage}%</strong>
                                </p>
                                <p className="text-slate-300">
                                  Count: <strong>{data.count} students</strong>
                                </p>
                                <p className="text-[10px] text-slate-400">{data.badge}</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Pie
                        data={chartData}
                        dataKey="count"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={46}
                        outerRadius={70}
                        paddingAngle={3}
                        cursor="pointer"
                        onClick={(entry: any) => {
                          if (entry && entry.riskLevel) {
                            setSelectedRiskFilter(entry.riskLevel);
                            setPage(1);
                          }
                        }}
                      >
                        {chartData.map((entry, index) => (
                          <Cell
                            key={`pie-cell-${index}`}
                            fill={entry.fill}
                            stroke="#ffffff"
                            strokeWidth={2}
                            opacity={selectedRiskFilter === 'all' || selectedRiskFilter === entry.riskLevel ? 1 : 0.35}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Center Donut Label */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      {selectedRiskFilter === 'all' ? 'Cohort' : selectedRiskFilter}
                    </span>
                    <span className="text-base font-black text-slate-900">
                      {selectedRiskFilter === 'High' ? `${highRiskPct}%` : selectedRiskFilter === 'Medium' ? `${mediumRiskPct}%` : selectedRiskFilter === 'Low' ? `${lowRiskPct}%` : '100%'}
                    </span>
                  </div>
                </div>

                {/* Right Proportions Breakdown List with Mini Progress Bars */}
                <div className="sm:col-span-6 space-y-2 text-xs">
                  {chartData.map(item => (
                    <div
                      key={item.riskLevel}
                      onClick={() => { setSelectedRiskFilter(item.riskLevel); setPage(1); }}
                      className={`p-2 rounded-lg border transition-all cursor-pointer ${
                        selectedRiskFilter === item.riskLevel
                          ? 'bg-slate-50 border-slate-300 ring-1 ring-slate-300'
                          : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50/60'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-semibold">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.fill }} />
                          <span className="text-slate-700">{item.name}</span>
                        </span>
                        <span className="font-bold text-slate-900">{item.percentage}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${item.percentage}%`, backgroundColor: item.fill }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chart Legend Footer with Total */}
              <div className="flex items-center justify-between text-[11px] pt-3 border-t border-slate-100 text-slate-500 font-medium">
                <span>Total Cohort: <strong className="text-slate-800">{totalCount} students</strong></span>
                <span>Proportions: <strong className="text-slate-800">{highRiskPct}% · {mediumRiskPct}% · {lowRiskPct}%</strong></span>
              </div>
            </div>
          </div>

          {/* Key Insights (Dynamic Actionable Observations from Current Data) */}
          <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200/60">
                  <Lightbulb className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Key Insights &amp; Actionable Observations
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Automated data-driven patterns and targeted recommendations derived from active student cohort records
                  </p>
                </div>
              </div>
              <span className="self-start sm:self-auto px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                {keyInsights.length} Observations Generated
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {keyInsights.map((insight) => (
                <div
                  key={insight.id}
                  className="p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300 transition-colors flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {insight.type === 'study' && <BookOpen className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                        {insight.type === 'attendance' && <Calendar className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
                        {insight.type === 'trajectory' && <TrendingDown className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                        {insight.type === 'failures' && <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                        {insight.type === 'recovery' && <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                        <span className="text-xs font-bold text-slate-900">
                          {insight.title}
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border whitespace-nowrap ${insight.badgeColor}`}>
                        {insight.badgeText}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed font-medium">
                      {insight.observation}
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-200/70 text-[11px] text-slate-600">
                    <strong className="text-indigo-900 font-semibold">Recommended Action:</strong>{' '}
                    <span className="text-slate-600">{insight.action}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Strategic Intervention Section (Interactive Cards by Risk Level with Copy to Clipboard for Faculty) */}
          <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-200/60">
                  <GraduationCap className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Strategic Intervention
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Targeted academic action plans categorized by risk level with copyable memos for faculty and counselors
                  </p>
                </div>
              </div>
              <span className="self-start sm:self-auto px-2.5 py-1 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                Action Plans for Faculty
              </span>
            </div>

            {/* 3 Interactive Cards Categorized by Risk Level */}
            <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Card 1: High Risk - Immediate 1-on-1 */}
              <div
                className={`rounded-xl border p-4.5 flex flex-col justify-between transition-all ${
                  selectedRiskFilter === 'High'
                    ? 'border-rose-400 bg-rose-50/40 ring-2 ring-rose-200 shadow-xs'
                    : 'border-rose-200/90 bg-white hover:border-rose-300 hover:bg-rose-50/20'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-100 text-rose-800 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-rose-600" />
                      <span>HIGH RISK</span>
                    </span>
                    <span className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                      {highRiskStudents.length} Students ({highRiskPct}%)
                    </span>
                  </div>

                  <h4 className="text-sm font-black text-slate-900 mb-1 flex items-center gap-1.5">
                    <span>Immediate 1-on-1</span>
                  </h4>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed mb-3">
                    Intensive individual academic recovery for students with attendance &lt;65%, failing grades (&lt;50%), or persistent backlogs.
                  </p>

                  <div className="space-y-1.5 p-3 rounded-lg bg-white/80 border border-rose-100 text-xs text-slate-700">
                    <p className="font-bold text-rose-900 text-[11px] uppercase tracking-wide">
                      Intervention Protocols:
                    </p>
                    <ul className="space-y-1 text-[11px] list-disc list-inside text-slate-700 leading-relaxed">
                      <li>Assign designated 1-on-1 academic mentor within 48 hours.</li>
                      <li>Mandatory weekly 45-minute remedial problem clinics.</li>
                      <li>Bi-weekly attendance tracking with automatic dean alerts.</li>
                      <li>Sign academic recovery agreement with student &amp; guardian.</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-rose-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const memo = `[STRATEGIC INTERVENTION: HIGH RISK - IMMEDIATE 1-ON-1]\nCohort Status: ${highRiskStudents.length} students (${highRiskPct}% of dataset)\nTarget Criteria: Attendance <65%, Midterm/Final <50%, or past course failures.\n\nRecommended Faculty & Advisor Action Plan:\n1. Assign dedicated 1-on-1 academic counselor within 48 hours.\n2. Schedule weekly mandatory 45-minute problem-solving clinics.\n3. Enforce bi-weekly attendance tracking with automated alerts to academic affairs.\n4. Establish an academic recovery compact with milestone check-ins.\n\nGenerated from Student Performance Risk Analyzer.`;
                      handleCopyIntervention('High', memo);
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all border ${
                      copiedIntervention === 'High'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    {copiedIntervention === 'High' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Copied to Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-500" />
                        <span>Copy to Clipboard</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRiskFilter('High');
                      setPage(1);
                    }}
                    className="text-[11px] font-bold text-rose-700 hover:text-rose-900 cursor-pointer transition-colors"
                  >
                    Filter Table →
                  </button>
                </div>
              </div>

              {/* Card 2: Medium Risk - Peer Tutoring */}
              <div
                className={`rounded-xl border p-4.5 flex flex-col justify-between transition-all ${
                  selectedRiskFilter === 'Medium'
                    ? 'border-amber-400 bg-amber-50/40 ring-2 ring-amber-200 shadow-xs'
                    : 'border-amber-200/90 bg-white hover:border-amber-300 hover:bg-amber-50/20'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-100 text-amber-800 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-600" />
                      <span>MEDIUM RISK</span>
                    </span>
                    <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                      {mediumRiskStudents.length} Students ({mediumRiskPct}%)
                    </span>
                  </div>

                  <h4 className="text-sm font-black text-slate-900 mb-1 flex items-center gap-1.5">
                    <span>Peer Tutoring</span>
                  </h4>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed mb-3">
                    Collaborative peer coaching and targeted concept clinics for borderline students with 65%–75% attendance or 50%–68% scores.
                  </p>

                  <div className="space-y-1.5 p-3 rounded-lg bg-white/80 border border-amber-100 text-xs text-slate-700">
                    <p className="font-bold text-amber-900 text-[11px] uppercase tracking-wide">
                      Intervention Protocols:
                    </p>
                    <ul className="space-y-1 text-[11px] list-disc list-inside text-slate-700 leading-relaxed">
                      <li>Group into 3-person peer learning pods with high-tier mentors.</li>
                      <li>Host bi-weekly homework review &amp; problem clinics.</li>
                      <li>Administer milestone checkpoints before midterm 2.</li>
                      <li>Provide modular worksheets targeting verified concept gaps.</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-amber-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const memo = `[STRATEGIC INTERVENTION: MEDIUM RISK - PEER TUTORING]\nCohort Status: ${mediumRiskStudents.length} students (${mediumRiskPct}% of dataset)\nTarget Criteria: Attendance 65%–75%, Borderline Scores (50%–68%).\n\nRecommended Faculty & Tutor Action Plan:\n1. Assign students into structured 3-person peer learning pods with high-tier mentors.\n2. Host bi-weekly subject homework review clinics and quiz preparation workshops.\n3. Conduct mid-term milestone reviews to ensure steady progression to the safe tier.\n4. Offer modular concept review worksheets in identified challenge areas.\n\nGenerated from Student Performance Risk Analyzer.`;
                      handleCopyIntervention('Medium', memo);
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all border ${
                      copiedIntervention === 'Medium'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    {copiedIntervention === 'Medium' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Copied to Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-500" />
                        <span>Copy to Clipboard</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRiskFilter('Medium');
                      setPage(1);
                    }}
                    className="text-[11px] font-bold text-amber-700 hover:text-amber-900 cursor-pointer transition-colors"
                  >
                    Filter Table →
                  </button>
                </div>
              </div>

              {/* Card 3: Low Risk - Self-Directed Enrichment */}
              <div
                className={`rounded-xl border p-4.5 flex flex-col justify-between transition-all ${
                  selectedRiskFilter === 'Low'
                    ? 'border-emerald-400 bg-emerald-50/40 ring-2 ring-emerald-200 shadow-xs'
                    : 'border-emerald-200/90 bg-white hover:border-emerald-300 hover:bg-emerald-50/20'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      <span>LOW RISK</span>
                    </span>
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                      {lowRiskStudents.length} Students ({lowRiskPct}%)
                    </span>
                  </div>

                  <h4 className="text-sm font-black text-slate-900 mb-1 flex items-center gap-1.5">
                    <span>Self-Directed Enrichment</span>
                  </h4>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed mb-3">
                    Honors track acceleration, academic leadership, and peer-mentorship recruitment for consistently high-performing students.
                  </p>

                  <div className="space-y-1.5 p-3 rounded-lg bg-white/80 border border-emerald-100 text-xs text-slate-700">
                    <p className="font-bold text-emerald-900 text-[11px] uppercase tracking-wide">
                      Intervention Protocols:
                    </p>
                    <ul className="space-y-1 text-[11px] list-disc list-inside text-slate-700 leading-relaxed">
                      <li>Provide advanced research seminars &amp; honors track projects.</li>
                      <li>Recruit high-achieving candidates for accredited peer tutoring.</li>
                      <li>Encourage intercollegiate hackathons &amp; academic challenges.</li>
                      <li>Conduct bi-monthly check-ins to maintain top-tier motivation.</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-emerald-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const memo = `[STRATEGIC INTERVENTION: LOW RISK - SELF-DIRECTED ENRICHMENT]\nCohort Status: ${lowRiskStudents.length} students (${lowRiskPct}% of dataset)\nTarget Criteria: Attendance >75%, Scores ≥68%, Zero Course Backlogs.\n\nRecommended Faculty & Department Action Plan:\n1. Provide advanced elective materials, research seminars, and honors tracks.\n2. Recruit high-achieving candidates for accredited peer tutor and mentor positions.\n3. Encourage participation in external academic challenges and capstone projects.\n4. Maintain bi-monthly engagement check-ins to preserve high performance.\n\nGenerated from Student Performance Risk Analyzer.`;
                      handleCopyIntervention('Low', memo);
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all border ${
                      copiedIntervention === 'Low'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    {copiedIntervention === 'Low' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Copied to Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-500" />
                        <span>Copy to Clipboard</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRiskFilter('Low');
                      setPage(1);
                    }}
                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 cursor-pointer transition-colors"
                  >
                    Filter Table →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Results Section: Filter, Search & Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Table Header Controls with Small Line Chart & Historical Trend Indicator */}
          <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-slate-900">
                  Student Risk Assessment Results
                </h2>
                {multiEntryCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center gap-1">
                    <Activity className="w-3 h-3 text-indigo-600" />
                    <span>{multiEntryCount} Multi-Record Tracked</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Displaying {filteredStudents.length} of {totalCount} students ({selectedRiskFilter === 'all' ? 'All Risk Tiers' : `${selectedRiskFilter} Risk Only`})
              </p>
            </div>

            {/* Historical Risk Fluctuation Trend & Small Line Chart in Table Header */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-slate-50/90 px-3.5 py-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
              <div className="min-w-[170px]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                    <LineChartIcon className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{inspectedStudent ? `Student: ${inspectedStudent.student_id}` : 'Historical Risk Fluctuation'}</span>
                  </div>
                  {inspectedStudent && (
                    <button
                      onClick={() => setInspectedStudent(null)}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                      title="Reset to cohort average trend"
                    >
                      Cohort
                    </button>
                  )}
                </div>

                {/* Dynamic Trend Indicator */}
                <div className="mt-1 flex items-center gap-1.5">
                  {cohortTrendDirection === 'improving' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <TrendingDown className="w-3 h-3 text-emerald-600" />
                      <span>Risk Decreasing (-{cohortTrendDelta}%)</span>
                    </span>
                  ) : cohortTrendDirection === 'deteriorating' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                      <TrendingUp className="w-3 h-3 text-rose-600" />
                      <span>Risk Rising (+{cohortTrendDelta}%)</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-200 text-slate-700">
                      <Activity className="w-3 h-3 text-slate-500" />
                      <span>Stable Fluctuation</span>
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {inspectedStudent 
                    ? `${inspectedStudent.history?.length || 0} historical entries charted`
                    : multiEntryCount > 0 
                      ? `Tracking ${multiEntryCount} students with multi-entries` 
                      : 'Historical progression across assessment checkpoints'}
                </p>
              </div>

              {/* Small Line Chart */}
              <div className="w-48 sm:w-56 h-12 bg-white rounded-lg p-1 border border-slate-200 shadow-2xs">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={activeTrendChartData} margin={{ top: 2, right: 6, left: 6, bottom: 2 }}>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const pt = payload[0].payload;
                          return (
                            <div className="bg-slate-900 text-white p-2 rounded-md shadow-lg text-[10px] space-y-0.5">
                              <p className="font-bold">{pt.label}</p>
                              <p className="text-slate-300">
                                Risk: <strong className={pt.riskScore > 60 ? 'text-rose-400' : pt.riskScore > 40 ? 'text-amber-400' : 'text-emerald-400'}>{pt.riskScore}%</strong> ({pt.riskLevel})
                              </p>
                              {pt.grade !== undefined && <p className="text-slate-400">Score: {pt.grade}%</p>}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="riskScore"
                      stroke={cohortTrendDirection === 'deteriorating' ? '#e11d48' : cohortTrendDirection === 'improving' ? '#10b981' : '#6366f1'}
                      strokeWidth={2.5}
                      dot={{ r: 2.5, fill: cohortTrendDirection === 'deteriorating' ? '#e11d48' : cohortTrendDirection === 'improving' ? '#10b981' : '#6366f1', strokeWidth: 1 }}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Export CSV Button */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportResultsCsv}
                disabled={students.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-xs disabled:opacity-50 cursor-pointer shrink-0"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Export Results to CSV</span>
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Risk Category Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-slate-500 font-semibold mr-1">Filter:</span>
              <button
                onClick={() => { setSelectedRiskFilter('all'); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                  selectedRiskFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                All ({totalCount})
              </button>
              <button
                onClick={() => { setSelectedRiskFilter('High'); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                  selectedRiskFilter === 'High'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'bg-white text-rose-700 border border-rose-200 hover:bg-rose-50'
                }`}
              >
                🚨 High Risk ({highRiskStudents.length})
              </button>
              <button
                onClick={() => { setSelectedRiskFilter('Medium'); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                  selectedRiskFilter === 'Medium'
                    ? 'bg-amber-500 text-white shadow-2xs'
                    : 'bg-white text-amber-800 border border-amber-200 hover:bg-amber-50'
                }`}
              >
                ⚠️ Medium Risk ({mediumRiskStudents.length})
              </button>
              <button
                onClick={() => { setSelectedRiskFilter('Low'); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                  selectedRiskFilter === 'Low'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-50'
                }`}
              >
                ✅ Low Risk ({lowRiskStudents.length})
              </button>
            </div>

            {/* Search Box */}
            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search Student ID / Name..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-semibold border-b border-slate-200">
                  <th className="py-3 px-4">Student ID / Name</th>
                  <th className="py-3 px-4">Attendance</th>
                  <th className="py-3 px-4">Study Time</th>
                  <th className="py-3 px-4">Midterm Score</th>
                  <th className="py-3 px-4">Final / Estimated Grade</th>
                  <th className="py-3 px-4">Risk Level</th>
                  <th className="py-3 px-4">Historical Trend & Fluctuation</th>
                  <th className="py-3 px-4">Action Plan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {paginatedStudents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-500 font-medium">
                      No students found matching the selected filter.
                    </td>
                  </tr>
                ) : (
                  paginatedStudents.map(student => {
                    let actionText = 'On track. Standard monitoring.';
                    if (student.predicted_risk_level === 'High') {
                      actionText = '🚨 Urgent: 1-on-1 counseling, remedial tutoring & attendance recovery';
                    } else if (student.predicted_risk_level === 'Medium') {
                      actionText = '⚠️ Monitor attendance and review homework regularly';
                    }

                    const isInspected = inspectedStudent?.student_id === student.student_id;

                    return (
                      <tr
                        key={student.student_id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isInspected ? 'bg-indigo-50/40 ring-1 ring-inset ring-indigo-300' : student.predicted_risk_level === 'High' ? 'bg-rose-50/40' : ''
                        }`}
                      >
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          {student.student_id}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`font-semibold ${
                              student.attendance_rate < 75 ? 'text-rose-600 font-bold' : 'text-slate-800'
                            }`}
                          >
                            {student.attendance_rate}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {student.study_hours_weekly} hrs/wk
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          {student.midterm1_score} / 100
                        </td>
                        <td className="py-3 px-4 font-bold text-indigo-700">
                          {student.predicted_grade}%
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold ${
                              student.predicted_risk_level === 'High'
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : student.predicted_risk_level === 'Medium'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {student.predicted_risk_level === 'High' ? '🚨 High Risk' : student.predicted_risk_level === 'Medium' ? '⚠️ Medium Risk' : '✅ Low Risk'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => setInspectedStudent(student)}
                            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-bold border transition-all cursor-pointer ${
                              isInspected
                                ? 'ring-2 ring-indigo-500 bg-indigo-50 border-indigo-300 shadow-2xs'
                                : 'hover:bg-slate-100 border-slate-200 bg-white'
                            }`}
                            title="Click to inspect this student's risk fluctuation in the line chart header"
                          >
                            {student.risk_trend === 'improving' ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700">
                                <TrendingDown className="w-3 h-3 text-emerald-600" />
                                <span>Improving</span>
                              </span>
                            ) : student.risk_trend === 'deteriorating' ? (
                              <span className="inline-flex items-center gap-1 text-rose-700">
                                <TrendingUp className="w-3 h-3 text-rose-600" />
                                <span>Risk Rising</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-slate-600">
                                <Activity className="w-3 h-3 text-slate-500" />
                                <span>Stable</span>
                              </span>
                            )}
                            {student.multi_record_count && student.multi_record_count > 1 ? (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-200">
                                {student.multi_record_count} entries
                              </span>
                            ) : null}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-medium">
                          {actionText}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
            <div>
              Showing <strong className="text-slate-900">{Math.min(filteredStudents.length, (page - 1) * pageSize + 1)}</strong> to{' '}
              <strong className="text-slate-900">{Math.min(filteredStudents.length, page * pageSize)}</strong> of{' '}
              <strong className="text-slate-900">{filteredStudents.length}</strong> students
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-semibold text-slate-800">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* 5. Quick Single Student Checker Modal */}
      {showQuickCheck && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 relative animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Quick Single Student Risk Check
                </h3>
              </div>
              <button
                onClick={() => setShowQuickCheck(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Attendance */}
              <div>
                <div className="flex justify-between font-semibold mb-1">
                  <span>Attendance Rate:</span>
                  <span className={quickAttendance < 75 ? 'text-rose-600 font-bold' : 'text-indigo-600 font-bold'}>
                    {quickAttendance}% {quickAttendance < 75 ? '(Below 75% Cutoff)' : ''}
                  </span>
                </div>
                <input
                  type="range"
                  min={30}
                  max={100}
                  value={quickAttendance}
                  onChange={(e) => setQuickAttendance(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg accent-indigo-600 cursor-pointer"
                />
              </div>

              {/* Midterm */}
              <div>
                <div className="flex justify-between font-semibold mb-1">
                  <span>Midterm Exam Score:</span>
                  <span className="text-indigo-600 font-bold">{quickMidterm} / 100</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={quickMidterm}
                  onChange={(e) => setQuickMidterm(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg accent-indigo-600 cursor-pointer"
                />
              </div>

              {/* Study Hours */}
              <div>
                <div className="flex justify-between font-semibold mb-1">
                  <span>Weekly Study Hours:</span>
                  <span className="text-indigo-600 font-bold">{quickStudyHours} hours/week</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={25}
                  value={quickStudyHours}
                  onChange={(e) => setQuickStudyHours(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg accent-indigo-600 cursor-pointer"
                />
              </div>

              {/* Past Failures */}
              <div>
                <div className="flex justify-between font-semibold mb-1">
                  <span>Past Subject Failures / Arrears:</span>
                  <span className={quickFailures > 0 ? 'text-rose-600 font-bold' : 'text-slate-700'}>
                    {quickFailures} backlogs
                  </span>
                </div>
                <div className="flex gap-2">
                  {[0, 1, 2, 3].map(n => (
                    <button
                      key={n}
                      onClick={() => setQuickFailures(n)}
                      className={`flex-1 py-1 rounded font-bold border cursor-pointer ${
                        quickFailures === n ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Result Box */}
              <div
                className={`mt-4 p-4 rounded-xl border ${
                  quickCalculatedRisk.level === 'High'
                    ? 'border-rose-300 bg-rose-50 text-rose-900'
                    : quickCalculatedRisk.level === 'Medium'
                    ? 'border-amber-300 bg-amber-50 text-amber-900'
                    : 'border-emerald-300 bg-emerald-50 text-emerald-900'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-extrabold text-sm">
                    Result: {quickCalculatedRisk.level === 'High' ? '🚨 HIGH RISK' : quickCalculatedRisk.level === 'Medium' ? '⚠️ MEDIUM RISK' : '✅ LOW RISK (SAFE)'}
                  </span>
                  <span className="font-bold text-xs">
                    Estimated Grade: {quickCalculatedRisk.grade}%
                  </span>
                </div>
                <p className="text-xs font-medium leading-relaxed">
                  <strong>Action:</strong> {quickCalculatedRisk.action}
                </p>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setShowQuickCheck(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-white font-semibold text-xs hover:bg-slate-900 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Column Mapping Modal (when auto-detection fails or user manually opens) */}
      {showColumnMappingModal && pendingUpload && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Map CSV Dataset Columns
                  </h3>
                  <p className="text-xs text-slate-500">
                    Designate which columns correspond to attendance, midterm score, and final grade
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowColumnMappingModal(false);
                  setMappingError('');
                }}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Notice Banner */}
              <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">
                    Column Auto-Detection Confirmation
                  </p>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Uploaded file <span className="font-mono font-bold bg-amber-100/80 px-1.5 py-0.5 rounded text-amber-950">{pendingUpload.fileName}</span> contains <strong>{pendingUpload.data.length.toLocaleString()} rows</strong> with {pendingUpload.headers.length} columns. Please select which columns in your dataset map to each metric below.
                  </p>
                </div>
              </div>

              {mappingError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{mappingError}</span>
                </div>
              )}

              {/* Column Selectors Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Attendance Rate */}
                <div className={`p-4 rounded-xl border transition-all ${columnMapping.attendance ? 'border-indigo-200 bg-indigo-50/20' : 'border-rose-200 bg-rose-50/20'}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                      <span>attendance *</span>
                    </label>
                    {columnMapping.attendance ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">Mapped</span>
                    ) : (
                      <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">Required</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mb-2">
                    Class attendance percentage (0 - 100% or 0 - 1.0)
                  </p>
                  <select
                    value={columnMapping.attendance}
                    onChange={(e) => {
                      setColumnMapping(prev => ({ ...prev, attendance: e.target.value }));
                      setMappingError('');
                    }}
                    className="w-full text-xs font-medium bg-white border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="">-- Select Column for Attendance --</option>
                    {pendingUpload.headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  {columnMapping.attendance && (
                    <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-1 truncate font-mono">
                      <span>Preview row 1:</span>
                      <strong className="text-slate-700 truncate">{String(pendingUpload.data[0]?.[columnMapping.attendance] ?? 'N/A')}</strong>
                    </div>
                  )}
                </div>

                {/* 2. Midterm Score */}
                <div className={`p-4 rounded-xl border transition-all ${columnMapping.midterm_score ? 'border-indigo-200 bg-indigo-50/20' : 'border-rose-200 bg-rose-50/20'}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-600" />
                      <span>midterm_score *</span>
                    </label>
                    {columnMapping.midterm_score ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">Mapped</span>
                    ) : (
                      <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">Required</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mb-2">
                    Mid-semester score or internal test (0 - 100)
                  </p>
                  <select
                    value={columnMapping.midterm_score}
                    onChange={(e) => {
                      setColumnMapping(prev => ({ ...prev, midterm_score: e.target.value }));
                      setMappingError('');
                    }}
                    className="w-full text-xs font-medium bg-white border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="">-- Select Column for Midterm Score --</option>
                    {pendingUpload.headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  {columnMapping.midterm_score && (
                    <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-1 truncate font-mono">
                      <span>Preview row 1:</span>
                      <strong className="text-slate-700 truncate">{String(pendingUpload.data[0]?.[columnMapping.midterm_score] ?? 'N/A')}</strong>
                    </div>
                  )}
                </div>

                {/* 3. Final Grade */}
                <div className={`p-4 rounded-xl border transition-all ${columnMapping.final_grade ? 'border-indigo-200 bg-indigo-50/20' : 'border-rose-200 bg-rose-50/20'}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-indigo-600" />
                      <span>final_grade *</span>
                    </label>
                    {columnMapping.final_grade ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">Mapped</span>
                    ) : (
                      <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">Required</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mb-2">
                    Overall grade, total marks, or final course score (0 - 100)
                  </p>
                  <select
                    value={columnMapping.final_grade}
                    onChange={(e) => {
                      setColumnMapping(prev => ({ ...prev, final_grade: e.target.value }));
                      setMappingError('');
                    }}
                    className="w-full text-xs font-medium bg-white border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="">-- Select Column for Final Grade --</option>
                    {pendingUpload.headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  {columnMapping.final_grade && (
                    <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-1 truncate font-mono">
                      <span>Preview row 1:</span>
                      <strong className="text-slate-700 truncate">{String(pendingUpload.data[0]?.[columnMapping.final_grade] ?? 'N/A')}</strong>
                    </div>
                  )}
                </div>

                {/* 4. Student ID / Name */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Student ID / Roll No</span>
                    </label>
                    <span className="text-[10px] font-medium text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded">Optional</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mb-2">
                    Used to group multiple historical entries per student
                  </p>
                  <select
                    value={columnMapping.student_id}
                    onChange={(e) => {
                      setColumnMapping(prev => ({ ...prev, student_id: e.target.value }));
                    }}
                    className="w-full text-xs font-medium bg-white border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="">-- Auto-generate STU-0001, STU-0002... --</option>
                    {pendingUpload.headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  {columnMapping.student_id && (
                    <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-1 truncate font-mono">
                      <span>Preview row 1:</span>
                      <strong className="text-slate-700 truncate">{String(pendingUpload.data[0]?.[columnMapping.student_id] ?? 'N/A')}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Data Sample Preview Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800">
                    File Sample Preview (First 3 Records)
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Highlighted columns will be utilized for risk model evaluation
                  </span>
                </div>
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-[11px] border-collapse bg-white">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-semibold">
                        {pendingUpload.headers.slice(0, 8).map(col => {
                          const isAtt = col === columnMapping.attendance;
                          const isMid = col === columnMapping.midterm_score;
                          const isFin = col === columnMapping.final_grade;
                          const isId = col === columnMapping.student_id;
                          return (
                            <th key={col} className={`py-2 px-3 whitespace-nowrap ${isAtt || isMid || isFin || isId ? 'bg-indigo-50 text-indigo-900' : ''}`}>
                              <div>{col}</div>
                              {isAtt && <span className="text-[9px] font-bold text-indigo-600 block">→ attendance</span>}
                              {isMid && <span className="text-[9px] font-bold text-indigo-600 block">→ midterm_score</span>}
                              {isFin && <span className="text-[9px] font-bold text-indigo-600 block">→ final_grade</span>}
                              {isId && <span className="text-[9px] font-bold text-indigo-600 block">→ student_id</span>}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pendingUpload.data.slice(0, 3).map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-50">
                          {pendingUpload.headers.slice(0, 8).map(col => {
                            const isMapped = col === columnMapping.attendance || col === columnMapping.midterm_score || col === columnMapping.final_grade || col === columnMapping.student_id;
                            return (
                              <td key={col} className={`py-1.5 px-3 font-mono whitespace-nowrap ${isMapped ? 'bg-indigo-50/40 font-bold text-indigo-950' : 'text-slate-600'}`}>
                                {String(row[col] ?? '')}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowColumnMappingModal(false);
                  setMappingError('');
                }}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmMapping}
                disabled={!columnMapping.attendance || !columnMapping.midterm_score || !columnMapping.final_grade}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm Mapping &amp; Analyze Dataset</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-3.5 text-center text-xs text-slate-500">
        Student Performance Risk Analyzer • Instant High, Medium &amp; Low Risk Detection
      </footer>
    </div>
  );
}
