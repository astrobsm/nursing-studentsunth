export const QUIZ_CONFIG = {
  TOTAL_QUESTIONS: 20,
  TIME_LIMIT_MINUTES: 30,
  TIME_LIMIT_SECONDS: 30 * 60,
  MAX_TAB_SWITCHES: 3,
  PASSING_PERCENTAGE: 50,
  APP_NAME: "2nd Year Nursing Quiz",
  INSTITUTION: "School of Nursing",
  COURSE: "Cardiovascular Disorders",
} as const;

export const ROUTES = {
  HOME: "/",
  INSTRUCTIONS: "/instructions",
  QUIZ: "/quiz",
  RESULTS: "/results",
  ADMIN: "/admin",
} as const;

export const ADMIN_PASSWORD = "blackvelvet";
