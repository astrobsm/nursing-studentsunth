"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getQuizState, startQuiz } from "@/lib/quiz-store";
import { QUIZ_CONFIG, ROUTES } from "@/lib/constants";

export default function InstructionsPage() {
  const router = useRouter();
  const [candidateName, setCandidateName] = useState("");

  useEffect(() => {
    const state = getQuizState();
    if (!state.candidate) {
      router.replace(ROUTES.HOME);
      return;
    }
    setCandidateName(state.candidate.fullName);
  }, [router]);

  const handleStartQuiz = () => {
    startQuiz();
    router.push(ROUTES.QUIZ);
  };

  const rules = [
    { icon: "⏱️", title: "Time Limit", desc: `You have ${QUIZ_CONFIG.TIME_LIMIT_MINUTES} minutes to complete ${QUIZ_CONFIG.TOTAL_QUESTIONS} questions.` },
    { icon: "📱", title: "No Tab Switching", desc: `Switching tabs/windows is tracked. After ${QUIZ_CONFIG.MAX_TAB_SWITCHES} switches, quiz auto-submits.` },
    { icon: "🚫", title: "No Copying", desc: "Right-click, copy/paste, and screenshots are disabled." },
    { icon: "📝", title: "One Attempt", desc: "You can only take this quiz once. Make it count!" },
    { icon: "🔄", title: "Navigate Freely", desc: "You can move between questions and flag them for review." },
    { icon: "✅", title: "Scoring", desc: `Each question is worth 1 point. Pass mark: ${QUIZ_CONFIG.PASSING_PERCENTAGE}%.` },
  ];

  return (
    <div className="animate-slide-in">
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-green-deep px-6 py-6 text-center">
          <h2 className="text-2xl font-bold text-white">Quiz Instructions</h2>
          {candidateName && (
            <p className="text-yellow-accent mt-1 text-sm">
              Welcome, {candidateName.split(" ")[0]}!
            </p>
          )}
        </div>

        {/* Rules */}
        <div className="p-6 space-y-4">
          <div className="bg-yellow-light border-2 border-yellow-accent rounded-xl p-4">
            <p className="text-sm text-gray-700 font-medium text-center">
              ⚠️ Please read all instructions carefully before starting.
            </p>
          </div>

          <div className="space-y-3">
            {rules.map((rule, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 bg-green-pale rounded-xl"
              >
                <span className="text-2xl flex-shrink-0">{rule.icon}</span>
                <div>
                  <h3 className="font-semibold text-gray-800 text-sm">{rule.title}</h3>
                  <p className="text-gray-600 text-xs mt-0.5">{rule.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Important Notice */}
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mt-4">
            <p className="text-sm text-red-700 font-semibold text-center">
              🔒 Anti-cheating measures are active throughout the quiz.
            </p>
            <p className="text-xs text-red-600 text-center mt-1">
              Any suspicious activity will be flagged and may lead to automatic submission.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => router.push(ROUTES.HOME)}
              className="flex-1 border-2 border-gray-200 text-gray-600 font-semibold py-3 px-4 rounded-xl hover:bg-gray-50 transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={handleStartQuiz}
              className="flex-[2] bg-green-deep hover:bg-green-medium text-white font-bold py-3 px-4 rounded-xl transition-all duration-200 hover:shadow-lg active:scale-[0.98] text-lg"
            >
              Start Quiz 🚀
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
