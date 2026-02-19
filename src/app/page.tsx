"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { setCandidate, clearQuizState } from "@/lib/quiz-store";
import { ROUTES } from "@/lib/constants";

export default function Home() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!fullName.trim()) errs.fullName = "Full name is required";
    if (!studentId.trim()) errs.studentId = "Student ID is required";
    if (!email.trim()) {
      errs.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = "Enter a valid email address";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    clearQuizState();
    setCandidate({ fullName: fullName.trim(), studentId: studentId.trim(), email: email.trim() });
    router.push(ROUTES.INSTRUCTIONS);
  };

  return (
    <div className="animate-slide-in">
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Card Header */}
        <div className="bg-green-deep px-6 py-8 text-center">
          <div className="w-24 h-24 mx-auto mb-4 bg-white rounded-full p-2 shadow-lg">
            <Image
              src="/logo.png"
              alt="UNTH School of Nursing"
              width={80}
              height={80}
              className="rounded-full object-contain"
              priority
            />
          </div>
          <h2 className="text-2xl font-bold text-white">Welcome, Nursing Student!</h2>
          <p className="text-green-light mt-2 text-sm">
            Cardiovascular Disorders Assessment
          </p>
        </div>

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <p className="text-gray-500 text-sm text-center">
            Please enter your details to begin the quiz.
          </p>

          {/* Full Name */}
          <div>
            <label htmlFor="fullName" className="block text-sm font-semibold text-gray-700 mb-1">
              Full Name
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Jane Namulondo"
              className={`w-full px-4 py-3 border-2 rounded-xl text-gray-900 placeholder-gray-400 transition-colors focus:outline-none focus:border-green-deep ${
                errors.fullName ? "border-red-400 bg-red-50" : "border-gray-200 focus:bg-green-pale"
              }`}
            />
            {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName}</p>}
          </div>

          {/* Student ID */}
          <div>
            <label htmlFor="studentId" className="block text-sm font-semibold text-gray-700 mb-1">
              Student ID
            </label>
            <input
              id="studentId"
              type="text"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="e.g. NSG/2024/001"
              className={`w-full px-4 py-3 border-2 rounded-xl text-gray-900 placeholder-gray-400 transition-colors focus:outline-none focus:border-green-deep ${
                errors.studentId ? "border-red-400 bg-red-50" : "border-gray-200 focus:bg-green-pale"
              }`}
            />
            {errors.studentId && <p className="text-red-500 text-xs mt-1">{errors.studentId}</p>}
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-1">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. jane@student.ac.ug"
              className={`w-full px-4 py-3 border-2 rounded-xl text-gray-900 placeholder-gray-400 transition-colors focus:outline-none focus:border-green-deep ${
                errors.email ? "border-red-400 bg-red-50" : "border-gray-200 focus:bg-green-pale"
              }`}
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full bg-green-deep hover:bg-green-medium text-white font-bold py-4 px-6 rounded-xl transition-all duration-200 hover:shadow-lg active:scale-[0.98] text-lg"
          >
            Proceed to Instructions →
          </button>

          <p className="text-center text-xs text-gray-400">
            By proceeding, you agree to the quiz rules and anti-cheating policy.
          </p>
        </form>
      </div>
    </div>
  );
}
