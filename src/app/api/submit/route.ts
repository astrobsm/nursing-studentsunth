import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

// POST /api/submit — Submit a quiz attempt + cheating events
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      candidateId,
      studentId,
      fullName,
      email,
      totalQuestions,
      correctAnswers,
      score,
      percentage,
      timeTaken,
      tabSwitches,
      answers,
      cheatingEvents,
      startedAt,
      submittedAt,
    } = body;

    if (!studentId || !totalQuestions) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Step 1: Ensure candidate exists (upsert)
    let resolvedCandidateId = candidateId;
    if (!resolvedCandidateId) {
      const { data: candidate, error: candErr } = await supabase
        .from("candidates")
        .upsert(
          { full_name: fullName, student_id: studentId, email },
          { onConflict: "student_id" }
        )
        .select("id")
        .single();

      if (candErr || !candidate) {
        console.error("Candidate upsert error:", candErr);
        return NextResponse.json(
          { error: "Failed to register candidate" },
          { status: 500 }
        );
      }
      resolvedCandidateId = candidate.id;
    }

    // Step 1.5: Duplicate check — prevent re-sync of the same attempt
    // Match on candidate + submittedAt timestamp (unique per real submission)
    if (submittedAt) {
      const { data: existing } = await supabase
        .from("attempts")
        .select("id")
        .eq("candidate_id", resolvedCandidateId)
        .eq("submitted_at", submittedAt)
        .maybeSingle();

      if (existing) {
        // Already synced — return success without inserting duplicate
        return NextResponse.json(
          { success: true, attemptId: existing.id, candidateId: resolvedCandidateId, duplicate: true },
          { status: 200 }
        );
      }
    }

    // Step 2: Insert the attempt
    const resolvedStartedAt = startedAt || new Date().toISOString();
    const resolvedSubmittedAt = submittedAt || new Date().toISOString();

    const { data: attempt, error: attemptErr } = await supabase
      .from("attempts")
      .insert({
        candidate_id: resolvedCandidateId,
        total_questions: totalQuestions,
        correct_answers: correctAnswers,
        score,
        percentage,
        time_taken: timeTaken,
        tab_switches: tabSwitches,
        is_passed: percentage >= 50,
        started_at: resolvedStartedAt,
        submitted_at: resolvedSubmittedAt,
        answers: answers || {},
      })
      .select("id")
      .single();

    if (attemptErr || !attempt) {
      console.error("Attempt insert error:", attemptErr);
      return NextResponse.json(
        { error: "Failed to save attempt" },
        { status: 500 }
      );
    }

    // Step 3: Insert cheating events (if any)
    if (cheatingEvents && cheatingEvents.length > 0) {
      const events = cheatingEvents.map(
        (evt: { type: string; details: string; timestamp: string }) => ({
          attempt_id: attempt.id,
          candidate_id: resolvedCandidateId,
          event_type: evt.type,
          details: evt.details,
          occurred_at: evt.timestamp,
        })
      );

      const { error: evtErr } = await supabase
        .from("cheating_events")
        .insert(events);

      if (evtErr) {
        console.error("Cheating events insert error:", evtErr);
        // Non-fatal — attempt was saved
      }
    }

    return NextResponse.json(
      {
        success: true,
        attemptId: attempt.id,
        candidateId: resolvedCandidateId,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
