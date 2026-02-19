export interface Question {
  id: number;
  question: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  answer: string;
  explanation: string;
}

export interface Candidate {
  fullName: string;
  studentId: string;
  email: string;
}

export interface CheatingEvent {
  type:
    | "tab_switch"
    | "window_blur"
    | "copy_attempt"
    | "paste_attempt"
    | "right_click"
    | "print_screen"
    | "devtools_attempt"
    | "auto_submit_cheat";
  timestamp: string;
  details: string;
}

export interface QuizState {
  candidate: Candidate | null;
  currentQuestion: number;
  answers: Record<number, string>;
  startTime: number | null;
  endTime: number | null;
  tabSwitchCount: number;
  isSubmitted: boolean;
  flaggedQuestions: number[];
  cheatingEvents: CheatingEvent[];
}

export interface QuizResult {
  candidate: Candidate;
  totalQuestions: number;
  correctAnswers: number;
  score: number;
  percentage: number;
  timeTaken: number;
  tabSwitches: number;
  answers: Record<number, string>;
  submittedAt: string;
  cheatingEvents: CheatingEvent[];
}
