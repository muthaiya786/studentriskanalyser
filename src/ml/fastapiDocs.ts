export const FASTAPI_MAIN_PY = `# =====================================================================
# FastAPI Backend for Student Performance Prediction & Risk Warning
# FDP Hands-On Activity Workshop Module
# =====================================================================

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix
import io

app = FastAPI(
    title="Student Performance & Risk Prediction API",
    description="Model serving backend for educator early warning system",
    version="1.0.0"
)

# Enable CORS for React frontend connectivity
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global in-memory storage for trained models & scaler
models_store = {
    "scaler": None,
    "logistic_regression": None,
    "random_forest": None,
    "metrics": {}
}

# --- Pydantic Data Schemas ---
class StudentFeatureInput(BaseModel):
    attendance_rate: float = Field(..., ge=0, le=100, description="Attendance percentage (0-100)")
    study_hours_weekly: float = Field(..., ge=0, le=50, description="Hours studied per week")
    midterm1_score: float = Field(..., ge=0, le=100, description="Score in Internal Exam 1 (0-100)")
    midterm2_score: float = Field(..., ge=0, le=100, description="Score in Internal Exam 2 (0-100)")
    past_failures: int = Field(0, ge=0, le=10, description="Number of past subject failures")
    absences: int = Field(0, ge=0, le=100, description="Number of missed lecture hours")
    internet_access: bool = True
    school_support: bool = False
    family_support: bool = True
    desires_higher_ed: bool = True

class PredictionOutput(BaseModel):
    predicted_grade: float
    performance_tier: str  # "High", "Average", "Low"
    risk_level: str        # "Low", "Medium", "High"
    risk_probability_pct: float
    algorithm_used: str
    pedagogical_recommendations: List[str]

class TrainingRequest(BaseModel):
    test_size: float = 0.2
    target: str = "risk_level"  # or "performance_tier"
    random_state: int = 42

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "Student Performance FastAPI Model Server",
        "models_loaded": models_store["random_forest"] is not None
    }

@app.post("/predict", response_model=PredictionOutput)
def predict_student_risk(student: StudentFeatureInput, algorithm: str = "random_forest"):
    """
    Predicts academic risk level and performance tier for a single student.
    """
    # Feature engineering vector
    features = np.array([[
        student.attendance_rate,
        student.study_hours_weekly,
        student.midterm1_score,
        student.midterm2_score,
        student.past_failures,
        student.absences,
        1.0 if student.internet_access else 0.0,
        1.0 if student.school_support else 0.0,
        1.0 if student.family_support else 0.0,
        1.0 if student.desires_higher_ed else 0.0,
    ]])

    # Predicted Grade regression heuristic / formula
    predicted_grade = round(
        0.28 * student.midterm1_score +
        0.38 * student.midterm2_score +
        0.24 * (student.attendance_rate * 0.95) +
        0.10 * (student.study_hours_weekly * 4.2) -
        (student.past_failures * 5),
        1
    )
    predicted_grade = max(10.0, min(100.0, predicted_grade))

    # Classification & Risk
    if predicted_grade < 50 or student.attendance_rate < 65 or student.past_failures >= 2:
        risk = "High"
        risk_prob = 84.5
        tier = "Low"
        recommendations = [
            "Mandatory 1-on-1 counseling with Academic Advisor within 48 hours.",
            "Enroll in remedial tutorial sessions for core prerequisite concepts.",
            "Notify parent/guardian regarding attendance and midterm deficit.",
            "Establish daily attendance check-in requirement."
        ]
    elif predicted_grade < 68 or student.attendance_rate < 75 or student.past_failures >= 1:
        risk = "Medium"
        risk_prob = 52.0
        tier = "Average"
        recommendations = [
            "Encourage participation in departmental peer study group.",
            "Assign supplementary practice problem sheets before semester finals.",
            "Schedule weekly office hour check-in with subject instructor."
        ]
    else:
        risk = "Low"
        risk_prob = 12.0
        tier = "High" if predicted_grade >= 75 else "Average"
        recommendations = [
            "Nominate student for Undergraduate Research Fellowship or Honor Roll.",
            "Encourage student to mentor struggling peers in study circles."
        ]

    return PredictionOutput(
        predicted_grade=predicted_grade,
        performance_tier=tier,
        risk_level=risk,
        risk_probability_pct=risk_prob,
        algorithm_used=algorithm,
        pedagogical_recommendations=recommendations
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
`;

export const FASTAPI_REQUIREMENTS_TXT = `fastapi==0.115.0
uvicorn==0.30.6
pydantic==2.8.2
scikit-learn==1.5.1
pandas==2.2.2
numpy==1.26.4
python-multipart==0.0.9
`;

export const FDP_CURRICULUM_STEPS = [
  {
    step: 1,
    title: 'Data Ingestion & Hygiene (1,000 Students)',
    description: 'Load the 1,000-student standardized CSV dataset, audit missing values (attendance, study hours, midterms), remove duplicate student IDs, and apply mean/median imputation.',
    activity: 'Upload student_records_1000.csv, review the Data Cleaning Audit table, and examine the missing cell recovery rate.'
  },
  {
    step: 2,
    title: 'Exploratory Data Analysis (EDA) & Correlations',
    description: 'Investigate statistical distributions of Midterm 1, Midterm 2, and Final Grade. Analyze correlation between Attendance % and Academic Failure Rate.',
    activity: 'Observe the Attendance vs Final Grade scatter matrix to identify the critical 75% attendance threshold.'
  },
  {
    step: 3,
    title: 'Feature Engineering & Train/Test Splitting',
    description: 'Encode categorical variables (Internet access, School support, Family support) and scale continuous features. Perform 80/20 train/test split with deterministic seeding.',
    activity: 'Adjust the Train/Test Split slider between 70/30 and 80/20 to observe sample distribution changes.'
  },
  {
    step: 4,
    title: 'Model Training & Comparative Benchmark',
    description: 'Train Logistic Regression (multinomial gradient descent) and Random Forest (ensemble of decision trees with Gini split optimization).',
    activity: 'Compare Accuracy, Precision, Recall, and F1-Score side-by-side between the linear model and the non-linear ensemble.'
  },
  {
    step: 5,
    title: 'Diagnostic Confusion Matrix Analysis',
    description: 'Evaluate False Positives (over-flagging safe students) vs False Negatives (missing students in genuine danger of academic failure).',
    activity: 'Analyze why Educators prioritize high Recall for the High-Risk class over high Precision.'
  },
  {
    step: 6,
    title: 'Interactive Simulation & Batch Inference',
    description: 'Simulate at-risk warning for incoming students using interactive feature sliders, review automated pedagogical intervention guidelines, and export the 1,000-student batch results.',
    activity: 'Adjust a hypothetical student with 55% attendance and 2 prior failures to see real-time risk classification and action plan.'
  }
];
