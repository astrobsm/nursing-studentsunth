"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getResult, clearQuizState } from "@/lib/quiz-store";
import { QUIZ_CONFIG, ROUTES } from "@/lib/constants";
import { QuizResult, Question } from "@/lib/types";
import questions from "@/data/questions.json";

const typedQuestions = questions as Question[];

export default function ResultsPage() {
  const router = useRouter();
  const [result, setResult] = useState<QuizResult | null>(null);
  const [showReview, setShowReview] = useState(false);

  useEffect(() => {
    const r = getResult();
    if (!r) {
      router.replace(ROUTES.HOME);
      return;
    }
    setResult(r);
  }, [router]);

  const handleRetake = () => {
    clearQuizState();
    router.push(ROUTES.HOME);
  };

  if (!result) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-green-deep font-semibold text-lg">Loading results...</div>
      </div>
    );
  }

  const passed = result.percentage >= QUIZ_CONFIG.PASSING_PERCENTAGE;
  const minutes = Math.floor(result.timeTaken / 60);
  const seconds = result.timeTaken % 60;

  return (
    <div className="animate-slide-in space-y-4">
      {/* Score Card */}
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className={`px-6 py-8 text-center ${passed ? "bg-green-deep" : "bg-red-500"}`}>
          <div className="text-6xl mb-3">{passed ? "🎉" : "📚"}</div>
          <h2 className="text-2xl font-bold text-white">
            {passed ? "Congratulations!" : "Keep Studying!"}
          </h2>
          <p className="text-white/80 text-sm mt-1">
            {result.candidate.fullName} • {result.candidate.studentId}
          </p>
        </div>

        {/* Score Circle */}
        <div className="flex justify-center -mt-8">
          <div
            className={`w-24 h-24 rounded-full flex items-center justify-center border-4 ${
              passed
                ? "bg-yellow-accent border-yellow-accent text-green-deep"
                : "bg-white border-red-300 text-red-500"
            }`}
          >
            <div className="text-center">
              <div className="text-2xl font-black">{result.percentage}%</div>
              <div className="text-xs font-medium">Score</div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="p-6">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-green-pale rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-green-deep">
                {result.correctAnswers}/{result.totalQuestions}
              </div>
              <div className="text-xs text-gray-600">Correct Answers</div>
            </div>
            <div className="bg-green-pale rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-green-deep">
                {minutes}:{seconds.toString().padStart(2, "0")}
              </div>
              <div className="text-xs text-gray-600">Time Taken</div>
            </div>
            <div className="bg-green-pale rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-green-deep">
                {result.tabSwitches}
              </div>
              <div className="text-xs text-gray-600">Tab Switches</div>
            </div>
            <div className="bg-green-pale rounded-xl p-3 text-center">
              <div className={`text-2xl font-bold ${passed ? "text-green-deep" : "text-red-500"}`}>
                {passed ? "PASS" : "FAIL"}
              </div>
              <div className="text-xs text-gray-600">
                Pass Mark: {QUIZ_CONFIG.PASSING_PERCENTAGE}%
              </div>
            </div>
          </div>

          {/* Performance Message */}
          <div
            className={`rounded-xl p-4 text-center text-sm ${
              result.percentage >= 80
                ? "bg-green-pale text-green-deep"
                : result.percentage >= 50
                ? "bg-yellow-light text-yellow-700"
                : "bg-red-50 text-red-600"
            }`}
          >
            {result.percentage >= 80
              ? "🌟 Excellent performance! You have a strong grasp of cardiovascular disorders."
              : result.percentage >= 50
              ? "👍 Good effort! Review the questions you missed to strengthen your knowledge."
              : "📖 More revision needed. Focus on the cardiovascular disorders lecture notes."}
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setShowReview(!showReview)}
              className="flex-1 border-2 border-green-deep text-green-deep font-semibold py-3 rounded-xl hover:bg-green-pale transition-colors"
            >
              {showReview ? "Hide Review" : "📖 Review Answers"}
            </button>
            <button
              onClick={handleRetake}
              className="flex-1 bg-green-deep hover:bg-green-medium text-white font-bold py-3 rounded-xl transition-all hover:shadow-lg"
            >
              🔄 Retake Quiz
            </button>
          </div>
        </div>
      </div>

      {/* Answer Review */}
      {showReview && (
        <div className="space-y-3 animate-slide-in">
          <h3 className="text-lg font-bold text-gray-800 px-1">Answer Review</h3>
          {typedQuestions.map((q, idx) => {
            const userAnswer = result.answers[q.id];
            const isCorrect = userAnswer === q.answer;
            return (
              <div
                key={q.id}
                className={`bg-white rounded-xl shadow-md overflow-hidden border-l-4 ${
                  isCorrect ? "border-l-green-deep" : "border-l-red-500"
                }`}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-xs font-bold text-gray-400">Q{idx + 1}</span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        isCorrect
                          ? "bg-green-pale text-green-deep"
                          : "bg-red-50 text-red-500"
                      }`}
                    >
                      {isCorrect ? "✓ Correct" : "✗ Wrong"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-800 font-medium mb-3">{q.question}</p>

                  <div className="space-y-1.5">
                    {(Object.entries(q.options) as [string, string][]).map(([key, value]) => {
                      const isUserChoice = userAnswer === key;
                      const isRightAnswer = q.answer === key;
                      return (
                        <div
                          key={key}
                          className={`text-xs px-3 py-2 rounded-lg ${
                            isRightAnswer
                              ? "bg-green-pale text-green-deep font-semibold border border-green-deep"
                              : isUserChoice && !isCorrect
                              ? "bg-red-50 text-red-500 line-through border border-red-300"
                              : "bg-gray-50 text-gray-500"
                          }`}
                        >
                          <span className="font-bold mr-2">{key}.</span>
                          {value}
                          {isRightAnswer && " ✓"}
                          {isUserChoice && !isCorrect && " (your answer)"}
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation */}
                  <div className="mt-3 bg-blue-50 text-blue-800 rounded-lg p-3 text-xs">
                    <span className="font-bold">💡 Explanation:</span> {q.explanation}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
