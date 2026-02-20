import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { ADMIN_PASSWORD } from "@/lib/constants";

// POST /api/admin/results — Get all results (requires password)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password } = body;

    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate server-side env vars
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[admin/results] Missing Supabase env vars");
      return NextResponse.json(
        { error: "Server misconfigured: missing Supabase credentials", results: [] },
        { status: 503 }
      );
    }

    let supabase;
    try {
      supabase = createServerClient();
    } catch (err) {
      console.error("[admin/results] Failed to create Supabase client:", err);
      return NextResponse.json(
        { error: "Failed to initialize database connection", results: [] },
        { status: 503 }
      );
    }

    // Get all attempts with candidate info, ordered by score desc
    const { data: attempts, error: attemptErr } = await supabase
      .from("attempts")
      .select(`
        id,
        total_questions,
        correct_answers,
        score,
        percentage,
        time_taken,
        tab_switches,
        is_passed,
        answers,
        started_at,
        submitted_at,
        candidate_id,
        candidates (
          id,
          full_name,
          student_id,
          email
        )
      `)
      .order("submitted_at", { ascending: false });

    if (attemptErr) {
      console.error("Fetch attempts error:", attemptErr);
      return NextResponse.json({ error: attemptErr.message }, { status: 500 });
    }

    // Get all cheating events grouped by attempt
    const { data: events, error: evtErr } = await supabase
      .from("cheating_events")
      .select("*")
      .order("occurred_at", { ascending: true });

    if (evtErr) {
      console.error("Fetch cheating events error:", evtErr);
    }

    // Map events to their attempts
    const eventsByAttempt: Record<string, typeof events> = {};
    (events || []).forEach((evt) => {
      if (!eventsByAttempt[evt.attempt_id]) {
        eventsByAttempt[evt.attempt_id] = [];
      }
      eventsByAttempt[evt.attempt_id]!.push(evt);
    });

    // Build the response in the QuizResult format the frontend expects
    const results = (attempts || []).map((a) => {
      const candidate = a.candidates as unknown as {
        id: string;
        full_name: string;
        student_id: string;
        email: string;
      };
      const cheatingEvents = (eventsByAttempt[a.id] || []).map((evt) => ({
        type: evt.event_type,
        timestamp: evt.occurred_at,
        details: evt.details,
      }));

      return {
        candidate: {
          fullName: candidate?.full_name || "Unknown",
          studentId: candidate?.student_id || "N/A",
          email: candidate?.email || "",
        },
        totalQuestions: a.total_questions,
        correctAnswers: a.correct_answers,
        score: a.score,
        percentage: a.percentage,
        timeTaken: a.time_taken,
        tabSwitches: a.tab_switches,
        answers: a.answers,
        submittedAt: a.submitted_at,
        cheatingEvents,
      };
    });

    return NextResponse.json({ results }, { status: 200 });
  } catch (err) {
    console.error("API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
