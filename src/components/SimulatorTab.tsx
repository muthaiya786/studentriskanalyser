import React, { useState } from 'react';
import {
  UserCheck,
  AlertTriangle,
  ShieldCheck,
  Sparkles,
  Award,
  BookOpen,
  Send,
  HelpCircle,
  Clock,
  RotateCcw,
  Sliders,
  ChevronRight,
  Bot
} from 'lucide-react';
import { SingleStudentInput, PredictionResult, ModelAlgorithm } from '../types.ts';
import { predictSingleStudent } from '../ml/engine.ts';

interface SimulatorTabProps {
  activeModel: ModelAlgorithm;
}

export const SimulatorTab: React.FC<SimulatorTabProps> = ({ activeModel }) => {
  const defaultInput: SingleStudentInput = {
    attendance_rate: 68,
    study_hours_weekly: 6,
    midterm1_score: 54,
    midterm2_score: 56,
    past_failures: 1,
    absences: 8,
    internet_access: true,
    school_support: false,
    family_support: true,
    extracurriculars: true,
    desires_higher_ed: true
  };

  const [input, setInput] = useState<SingleStudentInput>(defaultInput);
  const [prediction, setPrediction] = useState<PredictionResult>(() =>
    predictSingleStudent(defaultInput, activeModel)
  );
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  const handleInputChange = (field: keyof SingleStudentInput, value: any) => {
    const updated = { ...input, [field]: value };
    setInput(updated);
    setPrediction(predictSingleStudent(updated, activeModel));
    // Clear previous AI text if user modified parameters
    if (aiAdvice) setAiAdvice(null);
  };

  const applyPreset = (preset: 'honors' | 'borderline' | 'critical' | 'average') => {
    let p: SingleStudentInput;
    if (preset === 'honors') {
      p = {
        attendance_rate: 94,
        study_hours_weekly: 16,
        midterm1_score: 88,
        midterm2_score: 92,
        past_failures: 0,
        absences: 2,
        internet_access: true,
        school_support: false,
        family_support: true,
        extracurriculars: true,
        desires_higher_ed: true
      };
    } else if (preset === 'borderline') {
      p = {
        attendance_rate: 72,
        study_hours_weekly: 5,
        midterm1_score: 52,
        midterm2_score: 55,
        past_failures: 1,
        absences: 9,
        internet_access: true,
        school_support: true,
        family_support: true,
        extracurriculars: false,
        desires_higher_ed: true
      };
    } else if (preset === 'critical') {
      p = {
        attendance_rate: 45,
        study_hours_weekly: 2,
        midterm1_score: 32,
        midterm2_score: 36,
        past_failures: 3,
        absences: 22,
        internet_access: false,
        school_support: false,
        family_support: false,
        extracurriculars: false,
        desires_higher_ed: false
      };
    } else {
      p = {
        attendance_rate: 80,
        study_hours_weekly: 8,
        midterm1_score: 65,
        midterm2_score: 68,
        past_failures: 0,
        absences: 5,
        internet_access: true,
        school_support: false,
        family_support: true,
        extracurriculars: true,
        desires_higher_ed: true
      };
    }

    setInput(p);
    setPrediction(predictSingleStudent(p, activeModel));
    if (aiAdvice) setAiAdvice(null);
  };

  const requestAiAdvisor = async () => {
    setIsLoadingAi(true);
    try {
      const res = await fetch('/api/ai-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student: input, prediction })
      });
      const data = await res.json();
      setAiAdvice(data.advice);
    } catch (err) {
      console.error(err);
      // Fallback
      setAiAdvice(`Academic Assessment: Student demonstrates ${prediction.risk_level} Risk profile with an estimated score of ${prediction.predicted_grade}%.
Immediate Recommendation:
1. Conduct an academic check-in on attendance (${input.attendance_rate}%).
2. Schedule remedial workshop for prerequisite foundational topics.
3. Establish weekly study logs with advisor sign-off.`);
    } finally {
      setIsLoadingAi(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Presets Header */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Simulation Test Profiles (Presets)
          </span>
          <span className="text-xs text-slate-600">
            Instantly load standard educator archetypes to examine model decision boundaries
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => applyPreset('honors')}
            className="px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-semibold hover:bg-emerald-100 transition-colors"
          >
            ★ Honors Student
          </button>
          <button
            onClick={() => applyPreset('average')}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors"
          >
            Average Achiever
          </button>
          <button
            onClick={() => applyPreset('borderline')}
            className="px-2.5 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-xs font-semibold hover:bg-amber-100 transition-colors"
          >
            ⚠️ Borderline Risk
          </button>
          <button
            onClick={() => applyPreset('critical')}
            className="px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-xs font-semibold hover:bg-rose-100 transition-colors"
          >
            🚨 Critical Failure Alert
          </button>
        </div>
      </div>

      {/* Grid: Inputs on Left, Output on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Input Controls */}
        <div className="lg:col-span-6 bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-600" />
              <span>Student Academic &amp; Behavioral Inputs</span>
            </h2>
            <button
              onClick={() => {
                setInput(defaultInput);
                setPrediction(predictSingleStudent(defaultInput, activeModel));
              }}
              className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>

          {/* Sliders */}
          <div className="space-y-3.5 text-xs">
            {/* Attendance */}
            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span className="text-slate-700">Lecture Attendance Rate</span>
                <span className={`font-bold ${input.attendance_rate < 75 ? 'text-rose-600' : 'text-indigo-600'}`}>
                  {input.attendance_rate}% {input.attendance_rate < 75 ? '(Below 75% Cutoff)' : ''}
                </span>
              </div>
              <input
                type="range"
                min={30}
                max={100}
                step={1}
                value={input.attendance_rate}
                onChange={(e) => handleInputChange('attendance_rate', Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>

            {/* Study Hours */}
            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span className="text-slate-700">Weekly Self-Study Time</span>
                <span className="font-bold text-indigo-600">{input.study_hours_weekly} hrs/week</span>
              </div>
              <input
                type="range"
                min={1}
                max={25}
                step={1}
                value={input.study_hours_weekly}
                onChange={(e) => handleInputChange('study_hours_weekly', Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>

            {/* Midterm 1 */}
            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span className="text-slate-700">Internal Midterm Exam 1</span>
                <span className="font-bold text-indigo-600">{input.midterm1_score} / 100</span>
              </div>
              <input
                type="range"
                min={15}
                max={100}
                step={1}
                value={input.midterm1_score}
                onChange={(e) => handleInputChange('midterm1_score', Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>

            {/* Midterm 2 */}
            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span className="text-slate-700">Internal Midterm Exam 2</span>
                <span className="font-bold text-indigo-600">{input.midterm2_score} / 100</span>
              </div>
              <input
                type="range"
                min={15}
                max={100}
                step={1}
                value={input.midterm2_score}
                onChange={(e) => handleInputChange('midterm2_score', Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>

            {/* Past Failures */}
            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span className="text-slate-700">Prior Subject Failures (Backlogs)</span>
                <span className={`font-bold ${input.past_failures > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                  {input.past_failures} {input.past_failures === 1 ? 'subject' : 'subjects'}
                </span>
              </div>
              <div className="flex gap-2">
                {[0, 1, 2, 3, 4].map(num => (
                  <button
                    key={num}
                    onClick={() => handleInputChange('past_failures', num)}
                    className={`flex-1 py-1.5 rounded-lg border font-bold text-xs ${
                      input.past_failures === num
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            {/* Absences */}
            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span className="text-slate-700">Unexcused Absences</span>
                <span className="font-bold text-slate-700">{input.absences} hours</span>
              </div>
              <input
                type="range"
                min={0}
                max={30}
                step={1}
                value={input.absences}
                onChange={(e) => handleInputChange('absences', Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>

            {/* Environmental & Support Toggles */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <span className="font-bold text-slate-800 block text-xs">Support &amp; Motivation Factors</span>

              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={Boolean(input.school_support)}
                    onChange={(e) => handleInputChange('school_support', e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-[11px] font-medium text-slate-700">School Tutoring Support</span>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={Boolean(input.internet_access)}
                    onChange={(e) => handleInputChange('internet_access', e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-[11px] font-medium text-slate-700">Home Internet Access</span>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={Boolean(input.family_support)}
                    onChange={(e) => handleInputChange('family_support', e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-[11px] font-medium text-slate-700">Family Educational Backing</span>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={Boolean(input.desires_higher_ed)}
                    onChange={(e) => handleInputChange('desires_higher_ed', e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-[11px] font-medium text-slate-700">Higher Education Goal</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Real-time Prediction Output & Intervention Plan */}
        <div className="lg:col-span-6 space-y-4">
          {/* Main Risk Output Card */}
          <div
            className={`rounded-xl p-5 border shadow-xs transition-all ${
              prediction.risk_level === 'High'
                ? 'border-rose-300 bg-rose-50/50'
                : prediction.risk_level === 'Medium'
                ? 'border-amber-300 bg-amber-50/50'
                : 'border-emerald-300 bg-emerald-50/50'
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Model Prediction Output ({activeModel === 'random_forest' ? 'Random Forest' : 'Logistic Regression'})
                </span>
                <h3 className="text-xl font-bold text-slate-900 mt-0.5">
                  Academic Trajectory Status
                </h3>
              </div>

              {/* Badges */}
              <div className="flex flex-col items-end gap-1">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-2xs ${
                    prediction.risk_level === 'High'
                      ? 'bg-rose-600 text-white'
                      : prediction.risk_level === 'Medium'
                      ? 'bg-amber-500 text-white'
                      : 'bg-emerald-600 text-white'
                  }`}
                >
                  {prediction.risk_level === 'High' ? (
                    <AlertTriangle className="w-3.5 h-3.5" />
                  ) : prediction.risk_level === 'Medium' ? (
                    <Clock className="w-3.5 h-3.5" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5" />
                  )}
                  <span>{prediction.risk_level} Risk Level</span>
                </span>

                <span
                  className={`px-2.5 py-0.5 rounded text-[11px] font-semibold border ${
                    prediction.performance_tier === 'High'
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                      : prediction.performance_tier === 'Average'
                      ? 'bg-slate-100 border-slate-200 text-slate-700'
                      : 'bg-rose-100 border-rose-200 text-rose-800'
                  }`}
                >
                  {prediction.performance_tier} Performance Tier
                </span>
              </div>
            </div>

            {/* Score & Risk Meter */}
            <div className="grid grid-cols-2 gap-4 bg-white/80 p-3.5 rounded-lg border border-slate-200/80 mb-4">
              <div>
                <span className="text-xs text-slate-500 font-medium block">Predicted Final Grade</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-3xl font-extrabold text-slate-900">{prediction.predicted_grade}%</span>
                  <span className="text-xs text-slate-400 font-medium">/ 100</span>
                </div>
              </div>

              <div>
                <span className="text-xs text-slate-500 font-medium block">Failure Risk Probability</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span
                    className={`text-3xl font-extrabold ${
                      prediction.risk_probability > 60
                        ? 'text-rose-600'
                        : prediction.risk_probability > 30
                        ? 'text-amber-600'
                        : 'text-emerald-600'
                    }`}
                  >
                    {prediction.risk_probability}%
                  </span>
                </div>
              </div>
            </div>

            {/* Probability Progress Bar */}
            <div className="space-y-1 mb-3 text-xs">
              <div className="flex justify-between font-semibold text-slate-600">
                <span>At-Risk Probability Gauge</span>
                <span>{prediction.risk_probability}%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    prediction.risk_probability > 60
                      ? 'bg-rose-600'
                      : prediction.risk_probability > 30
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${prediction.risk_probability}%` }}
                />
              </div>
            </div>

            {/* Driving Risk Factors */}
            <div className="space-y-2 pt-2 text-xs">
              <span className="font-bold text-slate-800 block">Identified Driving Factors:</span>
              <ul className="space-y-1">
                {prediction.key_risk_factors.map((factor, i) => (
                  <li key={i} className="flex items-center gap-1.5 text-slate-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                    <span>{factor}</span>
                  </li>
                ))}
                {prediction.strengths.map((str, i) => (
                  <li key={i} className="flex items-center gap-1.5 text-emerald-700 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span>{str}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Actionable Pedagogical Intervention Plan */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Recommended Educator Action Plan (FDP Activity)
                </h3>
              </div>
              <button
                onClick={requestAiAdvisor}
                disabled={isLoadingAi}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors disabled:opacity-50"
              >
                <Bot className="w-3.5 h-3.5 text-indigo-600" />
                <span>{isLoadingAi ? 'Consulting Advisor...' : 'AI Advisor'}</span>
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-700">
              {prediction.recommended_interventions.map((plan, i) => (
                <div key={i} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 leading-relaxed font-medium">
                  {plan}
                </div>
              ))}
            </div>

            {/* AI Advisor Response Section */}
            {aiAdvice && (
              <div className="mt-3 p-3.5 rounded-lg bg-indigo-50/80 border border-indigo-200 text-xs text-indigo-950 space-y-2 animate-in fade-in">
                <div className="flex items-center gap-1.5 font-bold text-indigo-900">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span>AI Faculty Pedagogical Advice</span>
                </div>
                <div className="whitespace-pre-line leading-relaxed text-indigo-900/90 font-medium">
                  {aiAdvice}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
