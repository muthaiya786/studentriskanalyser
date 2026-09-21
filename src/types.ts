export type RiskLevel = 'Low' | 'Medium' | 'High';
export type PerformanceTier = 'High' | 'Average' | 'Low';
export type ModelAlgorithm = 'logistic_regression' | 'random_forest';

export interface ColumnMapping {
  attendance: string;
  midterm_score: string;
  final_grade: string;
  student_id: string;
}

export interface RawStudentData {
  student_id: string;
  gender: 'M' | 'F' | string;
  age: number;
  study_hours_weekly: number;
  attendance_rate: number; // percentage 0 - 100
  past_failures: number; // 0 - 4
  midterm1_score: number; // 0 - 100
  midterm2_score: number; // 0 - 100
  absences: number; // count
  internet_access: 'yes' | 'no' | boolean | string;
  school_support: 'yes' | 'no' | boolean | string;
  family_support: 'yes' | 'no' | boolean | string;
  extracurriculars: 'yes' | 'no' | boolean | string;
  desires_higher_ed: 'yes' | 'no' | boolean | string;
  final_grade: number; // 0 - 100
  performance_tier?: PerformanceTier;
  risk_level?: RiskLevel;
}

export interface CleanedStudentData extends RawStudentData {
  performance_tier: PerformanceTier;
  risk_level: RiskLevel;
  risk_score: number; // 0.0 - 1.0
}

export interface DataCleaningAudit {
  totalRows: number;
  cleanRows: number;
  missingValuesHandled: number;
  duplicatesRemoved: number;
  outliersCapped: number;
  columnSummary: {
    column: string;
    type: 'numeric' | 'categorical';
    missingCount: number;
    imputationMethod: string;
  }[];
}

export interface FeatureStats {
  mean: number;
  median: number;
  std: number;
  min: number;
  max: number;
}

export interface DatasetSummaryStats {
  totalStudents: number;
  avgAttendance: number;
  avgFinalGrade: number;
  avgStudyHours: number;
  avgMidterm1: number;
  avgMidterm2: number;
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
  };
  performanceDistribution: {
    high: number;
    average: number;
    low: number;
  };
}

export interface ConfusionMatrixData {
  labels: string[];
  matrix: number[][]; // [actual][predicted]
  total: number;
}

export interface ModelMetrics {
  algorithm: ModelAlgorithm;
  algorithmName: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  confusionMatrix: ConfusionMatrixData;
  featureImportances: { feature: string; importance: number }[];
  trainSize: number;
  testSize: number;
}

export interface TrainingResults {
  trainSplitPct: number;
  trainCount: number;
  testCount: number;
  logisticRegression: ModelMetrics;
  randomForest: ModelMetrics;
  targetVariable: 'risk_level' | 'performance_tier';
}

export interface SingleStudentInput {
  attendance_rate: number;
  study_hours_weekly: number;
  midterm1_score: number;
  midterm2_score: number;
  past_failures: number;
  absences: number;
  internet_access: boolean | string;
  school_support: boolean | string;
  family_support: boolean | string;
  extracurriculars: boolean | string;
  desires_higher_ed: boolean | string;
}

export interface PredictionResult {
  predicted_grade: number;
  performance_tier: PerformanceTier;
  risk_level: RiskLevel;
  risk_probability: number; // 0-100%
  high_performance_prob: number;
  average_performance_prob: number;
  low_performance_prob: number;
  key_risk_factors: string[];
  strengths: string[];
  recommended_interventions: string[];
  used_algorithm: ModelAlgorithm;
}

export interface HistoricalRiskPoint {
  entry_index: number;
  period_label: string;
  risk_score: number; // 0 - 100
  risk_level: RiskLevel;
  grade: number;
  attendance: number;
}

export interface BatchPredictionItem extends CleanedStudentData {
  predicted_grade: number;
  predicted_performance_tier: PerformanceTier;
  predicted_risk_level: RiskLevel;
  predicted_risk_prob: number;
  prediction_match: boolean;
  history?: HistoricalRiskPoint[];
  risk_trend?: 'improving' | 'deteriorating' | 'stable';
  multi_record_count?: number;
}
