"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  getQuizState,
  setAnswer,
  setCurrentQuestion,
  toggleFlagQuestion,
  submitQuiz,
} from "@/lib/quiz-store";
import { useTimer } from "@/hooks/useTimer";
import { useAntiCheat } from "@/hooks/useAntiCheat";
import { QUIZ_CONFIG, ROUTES } from "@/lib/constants";
import { Question } from "@/lib/types";
import questions from "@/data/questions.json";

const typedQuestions = questions as Question[];

export default function QuizPage() {
  const router = useRouter();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [flagged, setFlagged] = useState<number[]>([]);
  const [showWarning, setShowWarning] = useState(false);
  const [warningMsg, setWarningMsg] = useState("");
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [showNav, setShowNav] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const handleTimeUp = useCallback(() => {
    const result = submitQuiz();
    if (result) {
      router.push(ROUTES.RESULTS);
    }
  }, [router]);

  const timer = useTimer(QUIZ_CONFIG.TIME_LIMIT_SECONDS, handleTimeUp);

  // Anti-cheat
  useAntiCheat({
    onTabSwitch: (count) => {
      setWarningMsg(
        `⚠️ Tab switch detected! (${count}/${QUIZ_CONFIG.MAX_TAB_SWITCHES}). Quiz will auto-submit after ${QUIZ_CONFIG.MAX_TAB_SWITCHES} switches.`
      );
      setShowWarning(true);
      setTimeout(() => setShowWarning(false), 4000);
    },
    onAutoSubmit: () => {
      router.push(ROUTES.RESULTS);
    },
  });

  // Initialize from stored state
  useEffect(() => {
    const state = getQuizState();
    if (!state.candidate || !state.startTime) {
      router.replace(ROUTES.HOME);
      return;
    }
    if (state.isSubmitted) {
      router.replace(ROUTES.RESULTS);
      return;
    }

    setCurrentIdx(state.currentQuestion);
    setAnswers(state.answers);
    setFlagged(state.flaggedQuestions);

    // Resume timer from where they left off
    const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
    if (elapsed >= QUIZ_CONFIG.TIME_LIMIT_SECONDS) {
      handleTimeUp();
    } else {
      timer.start(elapsed);
    }
    setInitialized(true);
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const currentQuestion = typedQuestions[currentIdx];

  const handleSelectAnswer = (option: string) => {
    const newAnswers = { ...answers, [currentQuestion.id]: option };
    setAnswers(newAnswers);
    setAnswer(currentQuestion.id, option);
  };

  const handleNext = () => {
    if (currentIdx < typedQuestions.length - 1) {
      const next = currentIdx + 1;
      setCurrentIdx(next);
      setCurrentQuestion(next);
    }
  };

  const handlePrev = () => {
    if (currentIdx > 0) {
      const prev = currentIdx - 1;
      setCurrentIdx(prev);
      setCurrentQuestion(prev);
    }
  };

  const handleGoToQuestion = (idx: number) => {
    setCurrentIdx(idx);
    setCurrentQuestion(idx);
    setShowNav(false);
  };

  const handleFlag = () => {
    toggleFlagQuestion(currentQuestion.id);
    setFlagged((prev) =>
      prev.includes(currentQuestion.id)
        ? prev.filter((id) => id !== currentQuestion.id)
        : [...prev, currentQuestion.id]
    );
  };

  const handleSubmit = () => {
    setShowConfirmSubmit(true);
  };

  const confirmSubmit = () => {
    timer.stop();
    submitQuiz();
    router.push(ROUTES.RESULTS);
  };

  const answeredCount = Object.keys(answers).length;
  const progress = (answeredCount / typedQuestions.length) * 100;

  if (!initialized) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-green-deep font-semibold text-lg">Loading quiz...</div>
      </div>
    );
  }

  return (
    <div className="no-select animate-slide-in max-w-2xl mx-auto">
      {/* Warning Toast */}
      {showWarning && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-6 py-3 rounded-xl shadow-2xl text-sm font-semibold animate-slide-in max-w-md text-center">
          {warningMsg}
        </div>
      )}

      {/* Timer & Progress Bar */}
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-4">
        <div className="px-4 py-3 flex items-center justify-between bg-green-deep text-white">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium">Q {currentIdx + 1}/{typedQuestions.length}</span>
            <span className="text-gray-300">|</span>
            <span className="text-xs">{answeredCount} answered</span>
          </div>
          <div
            className={`font-mono font-bold text-lg ${
              timer.isCritical
                ? "text-red-400 animate-pulse-warning"
                : timer.isWarning
                ? "text-yellow-accent"
                : "text-white"
            }`}
          >
            ⏱ {timer.formatted}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNav(!showNav)}
              className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg transition-colors"
            >
              📋 Nav
            </button>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 bg-gray-200">
          <div
            className="h-full bg-yellow-accent transition-all duration-500 animate-progress"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question Navigation Panel */}
      {showNav && (
        <div className="bg-white rounded-2xl shadow-xl p-4 mb-4 animate-slide-in">
          <h3 className="text-sm font-bold text-gray-700 mb-3">Question Navigator</h3>
          <div className="grid grid-cols-5 gap-2">
            {typedQuestions.map((q, idx) => {
              const isAnswered = answers[q.id] !== undefined;
              const isFlagged = flagged.includes(q.id);
              const isCurrent = idx === currentIdx;
              return (
                <button
                  key={q.id}
                  onClick={() => handleGoToQuestion(idx)}
                  className={`relative w-full aspect-square rounded-lg text-sm font-bold transition-all ${
                    isCurrent
                      ? "bg-green-deep text-white ring-2 ring-yellow-accent"
                      : isAnswered
                      ? "bg-green-light text-green-deep"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {idx + 1}
                  {isFlagged && (
                    <span className="absolute -top-1 -right-1 text-xs">🚩</span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex gap-4 mt-3 text-xs text-gray-500 justify-center">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-green-light rounded" /> Answered
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-gray-100 rounded border" /> Unanswered
            </span>
            <span className="flex items-center gap-1">🚩 Flagged</span>
          </div>
        </div>
      )}

      {/* Question Card */}
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="p-6">
          {/* Question */}
          <div className="mb-6">
            <div className="flex items-start justify-between gap-2 mb-3">
              <span className="bg-green-pale text-green-deep text-xs font-bold px-3 py-1 rounded-full">
                Question {currentIdx + 1}
              </span>
              <button
                onClick={handleFlag}
                className={`text-xs px-3 py-1 rounded-full transition-colors ${
                  flagged.includes(currentQuestion.id)
                    ? "bg-yellow-accent text-green-deep font-bold"
                    : "bg-gray-100 text-gray-500 hover:bg-yellow-light"
                }`}
              >
                {flagged.includes(currentQuestion.id) ? "🚩 Flagged" : "🏳️ Flag"}
              </button>
            </div>
            <p className="text-gray-900 font-medium leading-relaxed">
              {currentQuestion.question}
            </p>
          </div>

          {/* Options */}
          <div className="space-y-3">
            {(Object.entries(currentQuestion.options) as [string, string][]).map(
              ([key, value]) => {
                const isSelected = answers[currentQuestion.id] === key;
                return (
                  <button
                    key={key}
                    onClick={() => handleSelectAnswer(key)}
                    className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all duration-200 ${
                      isSelected
                        ? "border-green-deep bg-green-pale text-green-deep font-semibold shadow-sm"
                        : "border-gray-200 hover:border-green-light hover:bg-green-pale/50 text-gray-700"
                    }`}
                  >
                    <span
                      className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold mr-3 ${
                        isSelected
                          ? "bg-green-deep text-white"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {key}
                    </span>
                    {value}
                  </button>
                );
              }
            )}
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="px-6 pb-6 pt-2 flex items-center justify-between gap-3">
          <button
            onClick={handlePrev}
            disabled={currentIdx === 0}
            className="px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed border-2 border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            ← Prev
          </button>

          {currentIdx === typedQuestions.length - 1 ? (
            <button
              onClick={handleSubmit}
              className="flex-1 bg-yellow-accent hover:bg-yellow-500 text-green-deep font-bold py-2.5 px-6 rounded-xl transition-all duration-200 hover:shadow-lg active:scale-[0.98]"
            >
              Submit Quiz ✓
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="flex-1 bg-green-deep hover:bg-green-medium text-white font-bold py-2.5 px-6 rounded-xl transition-all duration-200 hover:shadow-lg active:scale-[0.98]"
            >
              Next →
            </button>
          )}
        </div>
      </div>

      {/* Submit Confirmation Modal */}
      {showConfirmSubmit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-slide-in">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Submit Quiz?</h3>
            <p className="text-gray-600 text-sm mb-1">
              You have answered <strong className="text-green-deep">{answeredCount}</strong> out
              of <strong>{typedQuestions.length}</strong> questions.
            </p>
            {answeredCount < typedQuestions.length && (
              <p className="text-red-500 text-sm mb-4">
                ⚠️ {typedQuestions.length - answeredCount} question(s) are unanswered!
              </p>
            )}
            {flagged.length > 0 && (
              <p className="text-yellow-600 text-sm mb-4">
                🚩 {flagged.length} question(s) are flagged for review.
              </p>
            )}
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowConfirmSubmit(false)}
                className="flex-1 border-2 border-gray-200 text-gray-600 font-semibold py-2.5 rounded-xl hover:bg-gray-50"
              >
                Review
              </button>
              <button
                onClick={confirmSubmit}
                className="flex-1 bg-green-deep hover:bg-green-medium text-white font-bold py-2.5 rounded-xl transition-all"
              >
                Confirm ✓
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
