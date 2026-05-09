export const CHARACTER_LIMIT = 25_000;

export enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json"
}

export enum ProgramType {
  GRANT = "grant",
  ACCEL = "accel",
  VC = "vc",
  CORP = "corp",
  UNI = "uni",
  JOB = "job",
  FELLOWSHIP = "fellowship",
  OTHER = "other"
}

export enum ProgramStatus {
  UPCOMING = "upcoming",
  OPEN = "open",
  CLOSED = "closed",
  RESULTS = "results"
}

export enum AnswerConfidence {
  DRAFT = "draft",
  SOLID = "solid",
  LOCKED = "locked"
}

export const PROGRAM_TYPES = ["grant", "accel", "vc", "corp", "uni", "job", "fellowship", "other"] as const;
export const PROGRAM_STATUSES = ["upcoming", "open", "closed", "results"] as const;
export const SORT_OPTIONS = ["heat_score", "program_value_score", "deadline", "acceptance_rate"] as const;
export const ANSWER_CONFIDENCES = ["draft", "solid", "locked"] as const;

export const QUESTION_THEMES = [
  "mission", "problem", "solution", "traction", "team",
  "market", "financials", "ask", "fit", "impact", "diversity", "stage"
] as const;
