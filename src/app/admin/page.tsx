"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { getAllResults } from "@/lib/quiz-store";
import { ADMIN_PASSWORD, QUIZ_CONFIG } from "@/lib/constants";
import { QuizResult } from "@/lib/types";

/** Check if Supabase env vars are set (client-side) */
function isSupabaseReady(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<QuizResult[]>([]);
  const [generating, setGenerating] = useState(false);
  const [dataSource, setDataSource] = useState<"local" | "supabase">("local");

  /** Load results — try Supabase API first, fall back to localStorage */
  const loadResults = useCallback(async () => {

    // Try Supabase first
    if (isSupabaseReady()) {
      try {
        const res = await fetch("/api/admin/results", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.results && data.results.length > 0) {
            const sorted = data.results.sort((a: QuizResult, b: QuizResult) => {
              if (b.percentage !== a.percentage) return b.percentage - a.percentage;
              return a.timeTaken - b.timeTaken;
            });
            setResults(sorted);
            setDataSource("supabase");
            return;
          }
        }
      } catch (err) {
        console.warn("[admin] Supabase fetch failed, falling back to localStorage:", err);
      }
    }

    // Fallback: localStorage
    const all = getAllResults();
    all.sort((a, b) => {
      if (b.percentage !== a.percentage) return b.percentage - a.percentage;
      return a.timeTaken - b.timeTaken;
    });
    setResults(all);
    setDataSource("local");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password]);

  useEffect(() => {
    if (authenticated) {
      loadResults();
    }
  }, [authenticated, loadResults]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setAuthenticated(true);
      setError("");
    } else {
      setError("Incorrect password. Access denied.");
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const getCheatingRemark = (result: QuizResult): string => {
    const events = result.cheatingEvents || [];
    if (events.length === 0 && result.tabSwitches === 0) return "No suspicious activity";

    const summary: string[] = [];

    const tabSwitches = events.filter((e) => e.type === "tab_switch" || e.type === "window_blur");
    if (tabSwitches.length > 0 || result.tabSwitches > 0) {
      summary.push(`Tab/window switches: ${result.tabSwitches}`);
    }

    const copyAttempts = events.filter((e) => e.type === "copy_attempt");
    if (copyAttempts.length > 0) summary.push(`Copy attempts: ${copyAttempts.length}`);

    const pasteAttempts = events.filter((e) => e.type === "paste_attempt");
    if (pasteAttempts.length > 0) summary.push(`Paste attempts: ${pasteAttempts.length}`);

    const rightClicks = events.filter((e) => e.type === "right_click");
    if (rightClicks.length > 0) summary.push(`Right-click attempts: ${rightClicks.length}`);

    const printScreen = events.filter((e) => e.type === "print_screen");
    if (printScreen.length > 0) summary.push(`Screenshot attempts: ${printScreen.length}`);

    const devtools = events.filter((e) => e.type === "devtools_attempt");
    if (devtools.length > 0) summary.push(`DevTools attempts: ${devtools.length}`);

    const autoSubmit = events.filter((e) => e.type === "auto_submit_cheat");
    if (autoSubmit.length > 0) summary.push("AUTO-SUBMITTED due to cheating");

    return summary.length > 0 ? summary.join("; ") : "No suspicious activity";
  };

  const getCheatingLevel = (result: QuizResult): { label: string; color: string } => {
    const events = result.cheatingEvents || [];
    const total = events.length + result.tabSwitches;
    if (total === 0) return { label: "Clean", color: "text-green-600 bg-green-50" };
    if (total <= 2) return { label: "Low Risk", color: "text-yellow-700 bg-yellow-50" };
    if (total <= 5) return { label: "Moderate", color: "text-orange-600 bg-orange-50" };
    return { label: "High Risk", color: "text-red-600 bg-red-50" };
  };

  const generatePDF = useCallback(async () => {
    setGenerating(true);
    try {
      const { jsPDF } = await import("jspdf");
      const autoTableModule = await import("jspdf-autotable");
      const autoTable = autoTableModule.default;

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;

      // Helper: add watermark to current page
      const addWatermark = () => {
        try {
          const logoImg = document.createElement("img");
          logoImg.src = "/logo.png";
          // We'll add a light watermark in the center
          doc.saveGraphicsState();
          // @ts-expect-error - setGState is available in jsPDF
          doc.setGState(new doc.GState({ opacity: 0.06 }));
          const wmSize = 80;
          doc.addImage(
            logoImg,
            "PNG",
            (pageWidth - wmSize) / 2,
            (pageHeight - wmSize) / 2,
            wmSize,
            wmSize
          );
          doc.restoreGraphicsState();
        } catch {
          // Watermark is optional, skip if image can't load
        }
      };

      // ===== PAGE 1: TITLE & SUMMARY =====
      addWatermark();

      // Title Header
      doc.setFillColor(0, 100, 0); // green-deep
      doc.rect(0, 0, pageWidth, 35, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("UNTH SCHOOL OF NURSING", pageWidth / 2, 14, { align: "center" });
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text("2nd Year Nursing Quiz – Cardiovascular Disorders Results", pageWidth / 2, 22, { align: "center" });
      doc.setFontSize(9);
      doc.text(`Generated on ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} at ${new Date().toLocaleTimeString()}`, pageWidth / 2, 30, { align: "center" });

      // Summary box
      doc.setTextColor(0, 0, 0);
      let y = 45;
      doc.setFillColor(232, 245, 233); // green-pale
      doc.roundedRect(margin, y, pageWidth - 2 * margin, 28, 3, 3, "F");

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Summary", margin + 5, y + 8);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);

      const totalCandidates = results.length;
      const passed = results.filter((r) => r.percentage >= QUIZ_CONFIG.PASSING_PERCENTAGE).length;
      const failed = totalCandidates - passed;
      const avgScore = totalCandidates > 0 ? Math.round(results.reduce((s, r) => s + r.percentage, 0) / totalCandidates) : 0;
      const cheaters = results.filter((r) => (r.cheatingEvents?.length || 0) + r.tabSwitches > 0).length;

      doc.text(`Total Candidates: ${totalCandidates}`, margin + 5, y + 15);
      doc.text(`Passed: ${passed} (${QUIZ_CONFIG.PASSING_PERCENTAGE}% pass mark)`, margin + 60, y + 15);
      doc.text(`Failed: ${failed}`, margin + 130, y + 15);
      doc.text(`Average Score: ${avgScore}%`, margin + 5, y + 22);
      doc.text(`Cheating Incidents: ${cheaters} candidate(s) flagged`, margin + 60, y + 22);

      y = 82;

      // ===== RESULTS TABLE =====
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("RESULTS RANKED BY SCORE", margin, y);
      y += 6;

      const tableData = results.map((r, idx) => [
        (idx + 1).toString(),
        r.candidate.fullName,
        r.candidate.studentId,
        `${r.correctAnswers}/${r.totalQuestions}`,
        `${r.percentage}%`,
        formatTime(r.timeTaken),
        r.percentage >= QUIZ_CONFIG.PASSING_PERCENTAGE ? "PASS" : "FAIL",
      ]);

      autoTable(doc, {
        startY: y,
        head: [["#", "Full Name", "Student ID", "Score", "%", "Time", "Status"]],
        body: tableData,
        margin: { left: margin, right: margin },
        theme: "grid",
        headStyles: {
          fillColor: [0, 100, 0],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 8,
          halign: "center",
        },
        bodyStyles: { fontSize: 7.5, cellPadding: 2 },
        columnStyles: {
          0: { halign: "center", cellWidth: 8 },
          1: { cellWidth: 45 },
          2: { cellWidth: 30, halign: "center" },
          3: { halign: "center", cellWidth: 18 },
          4: { halign: "center", cellWidth: 14 },
          5: { halign: "center", cellWidth: 16 },
          6: { halign: "center", cellWidth: 16 },
        },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        didParseCell: (data: any) => {
          if (data.section === "body" && data.column.index === 6) {
            const result = results[data.row.index];
            if (result && result.percentage >= QUIZ_CONFIG.PASSING_PERCENTAGE) {
              data.cell.styles.textColor = [0, 128, 0];
              data.cell.styles.fontStyle = "bold";
            } else {
              data.cell.styles.textColor = [220, 50, 50];
              data.cell.styles.fontStyle = "bold";
            }
          }
        },
      });

      // ===== CHEATING REPORT (new page) =====
      doc.addPage();
      addWatermark();

      // Header bar
      doc.setFillColor(0, 100, 0);
      doc.rect(0, 0, pageWidth, 20, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("CHEATING & INTEGRITY REPORT", pageWidth / 2, 13, { align: "center" });

      doc.setTextColor(0, 0, 0);
      y = 30;

      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      doc.text(
        "This report details all detected cheating attempts and suspicious activity for each candidate.",
        margin, y
      );
      y += 8;

      const cheatingData = results.map((r, idx) => {
        const level = getCheatingLevel(r);
        const remark = getCheatingRemark(r);
        return [
          (idx + 1).toString(),
          r.candidate.fullName,
          r.candidate.studentId,
          r.tabSwitches.toString(),
          (r.cheatingEvents?.length || 0).toString(),
          level.label,
          remark,
        ];
      });

      autoTable(doc, {
        startY: y,
        head: [["#", "Candidate", "ID", "Tab\nSwitches", "Total\nEvents", "Risk\nLevel", "Detailed Remarks"]],
        body: cheatingData,
        margin: { left: margin, right: margin },
        theme: "grid",
        headStyles: {
          fillColor: [180, 30, 30],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 7.5,
          halign: "center",
        },
        bodyStyles: { fontSize: 7, cellPadding: 2, valign: "top" },
        columnStyles: {
          0: { halign: "center", cellWidth: 8 },
          1: { cellWidth: 30 },
          2: { cellWidth: 22, halign: "center" },
          3: { halign: "center", cellWidth: 14 },
          4: { halign: "center", cellWidth: 14 },
          5: { halign: "center", cellWidth: 18 },
          6: { cellWidth: 0 }, // auto
        },
        alternateRowStyles: { fillColor: [255, 245, 245] },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        didParseCell: (data: any) => {
          if (data.section === "body" && data.column.index === 5) {
            const r = results[data.row.index];
            const level = getCheatingLevel(r);
            if (level.label === "High Risk") {
              data.cell.styles.textColor = [220, 50, 50];
              data.cell.styles.fontStyle = "bold";
            } else if (level.label === "Moderate") {
              data.cell.styles.textColor = [200, 120, 0];
              data.cell.styles.fontStyle = "bold";
            } else if (level.label === "Low Risk") {
              data.cell.styles.textColor = [180, 150, 0];
            }
          }
        },
      });

      // Footer on all pages
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(128, 128, 128);
        doc.text(
          `UNTH School of Nursing – Confidential Results Report – Page ${i} of ${totalPages}`,
          pageWidth / 2,
          pageHeight - 8,
          { align: "center" }
        );
      }

      doc.save("UNTH_Nursing_Quiz_Results.pdf");
    } catch (err) {
      console.error("PDF generation error:", err);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setGenerating(false);
    }
  }, [results]);

  // ===== LOGIN SCREEN =====
  if (!authenticated) {
    return (
      <div className="animate-slide-in">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden max-w-md mx-auto">
          <div className="bg-green-deep px-6 py-8 text-center">
            <div className="w-20 h-20 mx-auto mb-4 bg-white rounded-full p-2 shadow-lg">
              <Image
                src="/logo.png"
                alt="UNTH School of Nursing"
                width={64}
                height={64}
                className="rounded-full object-contain"
              />
            </div>
            <h2 className="text-xl font-bold text-white">Admin Access</h2>
            <p className="text-green-light text-xs mt-1">Enter password to view all results</p>
          </div>

          <form onSubmit={handleLogin} className="p-6 space-y-4">
            <div>
              <label htmlFor="adminPw" className="block text-sm font-semibold text-gray-700 mb-1">
                🔒 Password
              </label>
              <input
                id="adminPw"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                placeholder="Enter admin password"
                autoFocus
                className={`w-full px-4 py-3 border-2 rounded-xl text-gray-900 placeholder-gray-400 transition-colors focus:outline-none focus:border-green-deep ${
                  error ? "border-red-400 bg-red-50" : "border-gray-200 focus:bg-green-pale"
                }`}
              />
              {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
            </div>
            <button
              type="submit"
              className="w-full bg-green-deep hover:bg-green-medium text-white font-bold py-3 px-6 rounded-xl transition-all duration-200 hover:shadow-lg active:scale-[0.98]"
            >
              Access Results
            </button>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="w-full border-2 border-gray-200 text-gray-500 font-semibold py-2.5 rounded-xl hover:bg-gray-50 text-sm"
            >
              ← Back to Home
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ===== RESULTS DASHBOARD =====
  const totalCandidates = results.length;
  const passedCount = results.filter((r) => r.percentage >= QUIZ_CONFIG.PASSING_PERCENTAGE).length;
  const failedCount = totalCandidates - passedCount;
  const avgScore = totalCandidates > 0 ? Math.round(results.reduce((s, r) => s + r.percentage, 0) / totalCandidates) : 0;

  return (
    <div className="animate-slide-in space-y-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-green-deep px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Logo" width={40} height={40} className="rounded-sm" />
            <div>
              <h2 className="text-xl font-bold text-white">All Candidates Results</h2>
              <p className="text-green-light text-xs">Ranked by Score – Admin View {dataSource === "supabase" ? "☁️ (Supabase)" : "💾 (Local)"}</p>
            </div>
          </div>
          <button
            onClick={generatePDF}
            disabled={generating || results.length === 0}
            className="bg-yellow-accent hover:bg-yellow-500 text-green-deep font-bold py-2 px-4 rounded-xl transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {generating ? (
              <>⏳ Generating...</>
            ) : (
              <>📄 Download PDF</>
            )}
          </button>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-4 gap-3 p-4">
          <div className="bg-green-pale rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-green-deep">{totalCandidates}</div>
            <div className="text-xs text-gray-600">Total</div>
          </div>
          <div className="bg-green-pale rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-green-600">{passedCount}</div>
            <div className="text-xs text-gray-600">Passed</div>
          </div>
          <div className="bg-red-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-red-500">{failedCount}</div>
            <div className="text-xs text-gray-600">Failed</div>
          </div>
          <div className="bg-yellow-light rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-yellow-700">{avgScore}%</div>
            <div className="text-xs text-gray-600">Avg Score</div>
          </div>
        </div>
      </div>

      {/* No results state */}
      {results.length === 0 && (
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="text-4xl mb-3">📭</div>
          <h3 className="text-lg font-bold text-gray-700">No Results Yet</h3>
          <p className="text-gray-500 text-sm mt-1">No candidates have completed the quiz yet.</p>
        </div>
      )}

      {/* Results Table */}
      {results.length > 0 && (
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-green-deep text-white text-xs">
                  <th className="px-3 py-3 text-center">#</th>
                  <th className="px-3 py-3 text-left">Full Name</th>
                  <th className="px-3 py-3 text-center">Student ID</th>
                  <th className="px-3 py-3 text-center">Score</th>
                  <th className="px-3 py-3 text-center">%</th>
                  <th className="px-3 py-3 text-center">Time</th>
                  <th className="px-3 py-3 text-center">Status</th>
                  <th className="px-3 py-3 text-center">Integrity</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, idx) => {
                  const passed = r.percentage >= QUIZ_CONFIG.PASSING_PERCENTAGE;
                  const level = getCheatingLevel(r);
                  return (
                    <tr
                      key={idx}
                      className={`border-b border-gray-100 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-green-pale/30 transition-colors`}
                    >
                      <td className="px-3 py-2.5 text-center font-bold text-gray-400">{idx + 1}</td>
                      <td className="px-3 py-2.5 font-medium text-gray-800">{r.candidate.fullName}</td>
                      <td className="px-3 py-2.5 text-center text-gray-600">{r.candidate.studentId}</td>
                      <td className="px-3 py-2.5 text-center font-semibold">{r.correctAnswers}/{r.totalQuestions}</td>
                      <td className={`px-3 py-2.5 text-center font-bold ${passed ? "text-green-600" : "text-red-500"}`}>{r.percentage}%</td>
                      <td className="px-3 py-2.5 text-center text-gray-500">{formatTime(r.timeTaken)}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${passed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                          {passed ? "PASS" : "FAIL"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${level.color}`}>
                          {level.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cheating Details */}
      {results.some((r) => (r.cheatingEvents?.length || 0) + r.tabSwitches > 0) && (
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-red-500 px-6 py-3">
            <h3 className="text-white font-bold">🚨 Cheating & Integrity Details</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {results
              .filter((r) => (r.cheatingEvents?.length || 0) + r.tabSwitches > 0)
              .map((r, idx) => {
                const level = getCheatingLevel(r);
                return (
                  <div key={idx} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-semibold text-gray-800">{r.candidate.fullName}</span>
                        <span className="text-gray-400 text-xs ml-2">({r.candidate.studentId})</span>
                      </div>
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${level.color}`}>
                        {level.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3">
                      {getCheatingRemark(r)}
                    </p>
                    {(r.cheatingEvents?.length || 0) > 0 && (
                      <div className="mt-2 space-y-1">
                        {r.cheatingEvents.map((evt, eidx) => (
                          <div key={eidx} className="text-xs text-gray-500 flex items-start gap-2">
                            <span className="text-gray-300 font-mono shrink-0">
                              {new Date(evt.timestamp).toLocaleTimeString()}
                            </span>
                            <span className="font-medium text-red-400">[{evt.type.replace(/_/g, " ")}]</span>
                            <span>{evt.details}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Back Button */}
      <div className="text-center pb-4">
        <button
          onClick={() => {
            setAuthenticated(false);
            setPassword("");
            router.push("/");
          }}
          className="text-gray-400 hover:text-gray-600 text-sm underline"
        >
          ← Logout & Back to Home
        </button>
      </div>
    </div>
  );
}
