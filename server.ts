import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import {
  generateRealistic1000Students,
  cleanDataset,
  runTrainTestPipeline,
  predictSingleStudent,
  runBatchPrediction
} from './src/ml/engine.ts';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '15mb' }));

  // In-memory preloaded 1,000 students dataset
  const raw1000 = generateRealistic1000Students();
  const { cleanedData: initialCleaned } = cleanDataset(raw1000);

  // Health endpoint matching FastAPI specification
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'Student Performance Prediction & Early Warning Engine',
      version: '1.0.0',
      total_students_loaded: initialCleaned.length,
      gemini_ai_enabled: Boolean(process.env.GEMINI_API_KEY)
    });
  });

  // Get sample 1,000-student dataset (raw or cleaned)
  app.get('/api/dataset/sample', (req, res) => {
    const format = req.query.format;
    if (format === 'csv') {
      const headers = [
        'student_id',
        'gender',
        'age',
        'study_hours_weekly',
        'attendance_rate',
        'past_failures',
        'midterm1_score',
        'midterm2_score',
        'absences',
        'internet_access',
        'school_support',
        'family_support',
        'extracurriculars',
        'desires_higher_ed',
        'final_grade'
      ];
      const rows = raw1000.map(s => [
        s.student_id,
        s.gender,
        s.age,
        s.study_hours_weekly ?? '',
        s.attendance_rate ?? '',
        s.past_failures,
        s.midterm1_score ?? '',
        s.midterm2_score,
        s.absences,
        s.internet_access,
        s.school_support,
        s.family_support,
        s.extracurriculars,
        s.desires_higher_ed,
        s.final_grade
      ].join(','));

      const csvContent = [headers.join(','), ...rows].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="student_dataset_1000.csv"');
      return res.send(csvContent);
    }

    res.json({
      success: true,
      count: raw1000.length,
      data: raw1000
    });
  });

  // Train / Benchmark endpoint
  app.post('/api/train', (req, res) => {
    try {
      const { splitPct = 80, target = 'risk_level' } = req.body;
      const results = runTrainTestPipeline(initialCleaned, Number(splitPct), target);
      res.json({
        success: true,
        results
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Single student prediction
  app.post('/api/predict', (req, res) => {
    try {
      const input = req.body;
      const algorithm = req.query.algorithm === 'logistic_regression' ? 'logistic_regression' : 'random_forest';
      const prediction = predictSingleStudent(input, algorithm);
      res.json({
        success: true,
        prediction
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // Batch prediction
  app.post('/api/batch-predict', (req, res) => {
    try {
      const { students, algorithm } = req.body;
      const dataToPredict = students && Array.isArray(students) ? students : initialCleaned;
      const results = runBatchPrediction(dataToPredict, algorithm);
      res.json({
        success: true,
        count: results.length,
        results
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // AI Educator Consultation Endpoint
  app.post('/api/ai-insight', async (req, res) => {
    const { student, prediction } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.json({
        source: 'pedagogical_heuristics_engine',
        advice: `Student is classified as ${prediction.risk_level} Risk with an estimated final score of ${prediction.predicted_grade}%.
Key Attention Areas:
- Attendance is at ${student.attendance_rate}%, ${student.attendance_rate < 75 ? 'which falls below the university minimum accreditation threshold' : 'meeting acceptable attendance metrics'}.
- Weekly study commitment of ${student.study_hours_weekly} hours.
- Prior backlogs: ${student.past_failures} subjects.

Educator Action Plan:
1. Conduct an empathetic academic audit within 5 business days.
2. Pair with a student mentor from the peer honors cohort.
3. Review internal test 1 and test 2 question breakdown to isolate conceptual gaps.`
      });
    }

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `You are a Senior Academic Dean and Faculty Pedagogical Advisor conducting an FDP (Faculty Development Programme) workshop.
Analyze the following student machine learning risk prediction:
- Student Attendance: ${student.attendance_rate}%
- Weekly Independent Study: ${student.study_hours_weekly} hrs
- Midterm 1: ${student.midterm1_score} / 100
- Midterm 2: ${student.midterm2_score} / 100
- Past Subject Failures: ${student.past_failures}
- Unexcused Absences: ${student.absences}
- Model Predicted Final Grade: ${prediction.predicted_grade}%
- Academic Performance Tier: ${prediction.performance_tier}
- Risk Level: ${prediction.risk_level} (Confidence: ${prediction.risk_probability}%)

Provide concise, highly actionable educator guidance with:
1. Root-cause diagnostic assessment (2-3 sentences)
2. Immediate 3-step intervention strategy for the course instructor
3. Measurable 4-week recovery milestone.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });

      res.json({
        source: 'gemini_educator_advisor',
        advice: response.text
      });
    } catch (error: any) {
      console.error('Gemini insight error:', error);
      res.json({
        source: 'pedagogical_heuristics_engine (fallback)',
        advice: `Student requires structured monitoring due to ${prediction.risk_level} Risk status. Focus on recovering attendance (${student.attendance_rate}%) and providing supplementary practice worksheets for upcoming examinations.`
      });
    }
  });

  // Vite middleware for development vs static build for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
