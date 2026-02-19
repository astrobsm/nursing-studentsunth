import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

// POST /api/candidates — Register a new candidate
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fullName, studentId, email } = body;

    if (!fullName || !studentId || !email) {
      return NextResponse.json(
        { error: "fullName, studentId, and email are required" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Upsert: insert or return existing candidate
    const { data, error } = await supabase
      .from("candidates")
      .upsert(
        { full_name: fullName, student_id: studentId, email },
        { onConflict: "student_id" }
      )
      .select()
      .single();

    if (error) {
      console.error("Supabase error (candidates):", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ candidate: data }, { status: 201 });
  } catch (err) {
    console.error("API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
