"use client";

import { Candidate, QuizState, QuizResult, CheatingEvent } from "./types";
import { queueForSync } from "./sync-manager";
import questions from "@/data/questions.json";

const STORAGE_KEY = "nursing_quiz_state";
const ALL_RESULTS_KEY = "nursing_quiz_all_results";

/** Check if Supabase env vars are set (client-side check) */
function isSupabaseReady(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

const defaultState: QuizState = {
  candidate: null,
  currentQuestion: 0,
  answers: {},
  startTime: null,
  endTime: null,
  tabSwitchCount: 0,
  isSubmitted: false,
  flaggedQuestions: [],
  cheatingEvents: [],
};

export function getQuizState(): QuizState {
  if (typeof window === "undefined") return defaultState;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return defaultState;
}

export function saveQuizState(state: QuizState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function clearQuizState(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function setCandidate(candidate: Candidate): void {
  const state = getQuizState();
  state.candidate = candidate;
  saveQuizState(state);
}

export function startQuiz(): void {
  const state = getQuizState();
  state.startTime = Date.now();
  state.currentQuestion = 0;
  state.answers = {};
  state.tabSwitchCount = 0;
  state.isSubmitted = false;
  state.flaggedQuestions = [];
  saveQuizState(state);
}

export function setAnswer(questionId: number, answer: string): void {
  const state = getQuizState();
  state.answers[questionId] = answer;
  saveQuizState(state);
}

export function setCurrentQuestion(index: number): void {
  const state = getQuizState();
  state.currentQuestion = index;
  saveQuizState(state);
}

export function toggleFlagQuestion(questionId: number): void {
  const state = getQuizState();
  const idx = state.flaggedQuestions.indexOf(questionId);
  if (idx >= 0) {
    state.flaggedQuestions.splice(idx, 1);
  } else {
    state.flaggedQuestions.push(questionId);
  }
  saveQuizState(state);
}

export function incrementTabSwitch(): number {
  const state = getQuizState();
  state.tabSwitchCount += 1;
  saveQuizState(state);
  return state.tabSwitchCount;
}

export function logCheatingEvent(event: CheatingEvent): void {
  const state = getQuizState();
  if (!state.cheatingEvents) state.cheatingEvents = [];
  state.cheatingEvents.push(event);
  saveQuizState(state);
}

export function submitQuiz(): QuizResult | null {
  const state = getQuizState();
  if (!state.candidate || !state.startTime) return null;

  const endTime = Date.now();
  const timeTaken = Math.floor((endTime - state.startTime) / 1000);

  let correctAnswers = 0;
  questions.forEach((q) => {
    if (state.answers[q.id] === q.answer) {
      correctAnswers++;
    }
  });

  const result: QuizResult = {
    candidate: state.candidate,
    totalQuestions: questions.length,
    correctAnswers,
    score: correctAnswers,
    percentage: Math.round((correctAnswers / questions.length) * 100),
    timeTaken,
    tabSwitches: state.tabSwitchCount,
    answers: state.answers,
    submittedAt: new Date().toISOString(),
    cheatingEvents: state.cheatingEvents || [],
  };

  state.isSubmitted = true;
  state.endTime = endTime;
  saveQuizState(state);

  // Store result for this candidate
  try {
    localStorage.setItem("nursing_quiz_result", JSON.stringify(result));
  } catch {}

  // Store in the shared all-results collection
  saveResultToCollection(result);

  // Persist to Supabase backend (fire-and-forget, localStorage is always the source of truth)
  submitToSupabase(result);

  return result;
}

/** Async submit to Supabase via API route — queues for offline sync if network unavailable */
async function submitToSupabase(result: QuizResult): Promise<void> {
  if (!isSupabaseReady()) return;

  const payload = {
    candidate: result.candidate,
    fullName: result.candidate.fullName,
    studentId: result.candidate.studentId,
    email: result.candidate.email,
    totalQuestions: result.totalQuestions,
    correctAnswers: result.correctAnswers,
    score: result.score,
    percentage: result.percentage,
    timeTaken: result.timeTaken,
    tabSwitches: result.tabSwitches,
    answers: result.answers,
    submittedAt: result.submittedAt,
    cheatingEvents: result.cheatingEvents,
  };

  // If online, try direct submission first
  if (navigator.onLine) {
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        console.log("[quiz-store] Submitted to Supabase successfully");
        return;
      }
      console.warn("[quiz-store] Supabase submit failed:", res.status);
    } catch (err) {
      console.warn("[quiz-store] Supabase submit error:", err);
    }
  }

  // Offline or failed — queue for background sync
  try {
    await queueForSync("submit", payload);
    console.log("[quiz-store] Queued submission for offline sync");
  } catch (err) {
    console.warn("[quiz-store] Failed to queue for sync:", err);
  }
}

export function saveResultToCollection(result: QuizResult): void {
  if (typeof window === "undefined") return;
  try {
    const allResults = getAllResults();
    // Prevent duplicates by studentId + submittedAt
    const exists = allResults.some(
      (r) =>
        r.candidate.studentId === result.candidate.studentId &&
        r.submittedAt === result.submittedAt
    );
    if (!exists) {
      allResults.push(result);
      localStorage.setItem(ALL_RESULTS_KEY, JSON.stringify(allResults));
    }
  } catch {}
}

export function getAllResults(): QuizResult[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(ALL_RESULTS_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return [];
}

export function getResult(): QuizResult | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem("nursing_quiz_result");
    if (stored) return JSON.parse(stored);
  } catch {}
  return null;
}
