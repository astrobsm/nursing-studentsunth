"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { QuizResult } from "./types";
import { QUIZ_CONFIG } from "./constants";

export function generateResultsPDF(results: QuizResult[]): void {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  // --- Header ---
  doc.setFillColor(0, 100, 0); // #006400
  doc.rect(0, 0, pageWidth, 40, "F");

  doc.setTextColor(255, 215, 0); // Yellow accent
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("QUIZ RESULTS REPORT", pageWidth / 2, 16, { align: "center" });

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(
    `${QUIZ_CONFIG.APP_NAME} — ${QUIZ_CONFIG.COURSE}`,
    pageWidth / 2,
    24,
    { align: "center" }
  );
  doc.text(
    `${QUIZ_CONFIG.INSTITUTION}`,
    pageWidth / 2,
    30,
    { align: "center" }
  );

  doc.setFontSize(9);
  doc.text(
    `Generated: ${new Date().toLocaleString()}  |  Total Candidates: ${results.length}`,
    pageWidth / 2,
    37,
    { align: "center" }
  );

  // --- Rankings Table ---
  let currentY = 48;

  doc.setTextColor(0, 100, 0);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("CANDIDATE RANKINGS (Sorted by Score)", margin, currentY);
  currentY += 6;

  // Sort results by percentage descending
  const sorted = [...results].sort((a, b) => b.percentage - a.percentage);

  const tableBody = sorted.map((r, idx) => {
    const minutes = Math.floor(r.timeTaken / 60);
    const seconds = r.timeTaken % 60;
    const timeStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;
    const status = r.percentage >= QUIZ_CONFIG.PASSING_PERCENTAGE ? "PASS" : "FAIL";
    const cheatingCount = r.cheatingEvents?.length || 0;

    return [
      (idx + 1).toString(),
      r.candidate.fullName,
      r.candidate.studentId,
      `${r.correctAnswers}/${r.totalQuestions}`,
      `${r.percentage}%`,
      timeStr,
      status,
      cheatingCount.toString(),
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [
      [
        "#",
        "Full Name",
        "Student ID",
        "Score",
        "%",
        "Time",
        "Status",
        "Cheat Flags",
      ],
    ],
    body: tableBody,
    theme: "grid",
    headStyles: {
      fillColor: [0, 100, 0],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
      halign: "center",
    },
    bodyStyles: {
      fontSize: 8,
      halign: "center",
    },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { halign: "left", cellWidth: 38 },
      2: { halign: "left", cellWidth: 28 },
      3: { cellWidth: 18 },
      4: { cellWidth: 14 },
      5: { cellWidth: 16 },
      6: { cellWidth: 16 },
      7: { cellWidth: 20 },
    },
    alternateRowStyles: {
      fillColor: [232, 245, 233], // green-pale
    },
    didParseCell: (data) => {
      // Color PASS green, FAIL red
      if (data.section === "body" && data.column.index === 6) {
        const val = data.cell.raw as string;
        if (val === "FAIL") {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = "bold";
        } else {
          data.cell.styles.textColor = [0, 100, 0];
          data.cell.styles.fontStyle = "bold";
        }
      }
      // Color cheating flags red if > 0
      if (data.section === "body" && data.column.index === 7) {
        const val = parseInt(data.cell.raw as string);
        if (val > 0) {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
    margin: { left: margin, right: margin },
  });

  // --- Cheating Report Section ---
  // Get Y position after the table
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } })
    .lastAutoTable.finalY;
  currentY = finalY + 12;

  // Check if we have any cheating events at all
  const candidatesWithCheating = sorted.filter(
    (r) => r.cheatingEvents && r.cheatingEvents.length > 0
  );

  if (candidatesWithCheating.length > 0) {
    // Check if we need a new page
    if (currentY > 250) {
      doc.addPage();
      currentY = 20;
    }

    doc.setTextColor(220, 38, 38);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("⚠ CHEATING DETECTION REPORT", margin, currentY);
    currentY += 3;

    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(0.5);
    doc.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 6;

    candidatesWithCheating.forEach((r) => {
      // Check if we need a new page
      if (currentY > 260) {
        doc.addPage();
        currentY = 20;
      }

      // Candidate header
      doc.setTextColor(0, 100, 0);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(
        `${r.candidate.fullName} (${r.candidate.studentId})`,
        margin,
        currentY
      );
      currentY += 5;

      // Group events by type
      const eventCounts: Record<string, number> = {};
      const eventDetails: string[] = [];

      r.cheatingEvents.forEach((ev) => {
        const label = formatCheatingType(ev.type);
        eventCounts[label] = (eventCounts[label] || 0) + 1;
      });

      Object.entries(eventCounts).forEach(([type, count]) => {
        eventDetails.push(`• ${type}: ${count} occurrence(s)`);
      });

      // Summary
      doc.setTextColor(80, 80, 80);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");

      const totalEvents = r.cheatingEvents.length;
      doc.text(
        `Total suspicious events: ${totalEvents} | Tab switches: ${r.tabSwitches}/${QUIZ_CONFIG.MAX_TAB_SWITCHES}`,
        margin + 2,
        currentY
      );
      currentY += 4;

      eventDetails.forEach((detail) => {
        if (currentY > 275) {
          doc.addPage();
          currentY = 20;
        }
        doc.text(detail, margin + 4, currentY);
        currentY += 3.5;
      });

      // Severity assessment
      currentY += 1;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      if (totalEvents >= 8) {
        doc.setTextColor(220, 38, 38);
        doc.text("SEVERITY: HIGH — Multiple cheating attempts detected", margin + 2, currentY);
      } else if (totalEvents >= 4) {
        doc.setTextColor(234, 179, 8);
        doc.text("SEVERITY: MEDIUM — Several suspicious activities detected", margin + 2, currentY);
      } else {
        doc.setTextColor(100, 100, 100);
        doc.text("SEVERITY: LOW — Minor suspicious activity", margin + 2, currentY);
      }
      currentY += 7;
    });
  } else {
    if (currentY > 260) {
      doc.addPage();
      currentY = 20;
    }
    doc.setTextColor(0, 100, 0);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("✓ No cheating attempts were detected for any candidate.", margin, currentY);
  }

  // --- Footer on every page ---
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();

    doc.setFillColor(0, 100, 0);
    doc.rect(0, pageHeight - 12, pageWidth, 12, "F");

    doc.setTextColor(144, 238, 144);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(
      `© 2026 ${QUIZ_CONFIG.INSTITUTION} — ${QUIZ_CONFIG.APP_NAME} | CONFIDENTIAL`,
      pageWidth / 2,
      pageHeight - 6,
      { align: "center" }
    );
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 6, {
      align: "right",
    });
  }

  // Download
  const timestamp = new Date().toISOString().slice(0, 10);
  doc.save(`Nursing_Quiz_Results_${timestamp}.pdf`);
}

function formatCheatingType(type: string): string {
  const labels: Record<string, string> = {
    tab_switch: "Tab Switch / Left Quiz",
    window_blur: "Window Lost Focus",
    copy_attempt: "Copy/Cut Attempt",
    paste_attempt: "Paste Attempt",
    right_click: "Right-Click Context Menu",
    print_screen: "Screenshot Attempt",
    devtools_attempt: "Developer Tools / Shortcut Blocked",
    auto_submit_cheat: "Auto-Submitted (Excessive Tab Switches)",
  };
  return labels[type] || type;
}
