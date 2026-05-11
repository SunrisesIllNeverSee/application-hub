import followUpData from "../../data/stress_test_follow_ups.json" with { type: "json" };

export const STRESS_DEPTHS = ["light", "medium", "deep"] as const;

export type FollowUpTemplate = {
  focus: string;
  prompt: string;
  expected_evidence: string[];
  risk_if_unanswered: string;
};

const THEME_FOLLOW_UPS = followUpData.themeFollowUps as Record<string, FollowUpTemplate[]>;
const GENERAL_FOLLOW_UPS = followUpData.generalFollowUps as FollowUpTemplate[];

export function followUpCount(depth: typeof STRESS_DEPTHS[number]): number {
  if (depth === "light") return 3;
  if (depth === "deep") return 5;
  return 4;
}

export function compactSignals(answerContent: string) {
  const numeric_claims = Array.from(answerContent.matchAll(/\b(?:\$?\d[\d,]*(?:\.\d+)?%?|\d+x)\b/gi))
    .map((match) => match[0])
    .slice(0, 12);
  const likely_urls = Array.from(answerContent.matchAll(/https?:\/\/\S+/gi))
    .map((match) => match[0])
    .slice(0, 5);

  return {
    word_count_estimate: answerContent.trim().split(/\s+/).filter(Boolean).length,
    numeric_claims,
    likely_urls
  };
}

export function buildFollowUps(
  theme: string | null,
  topDnaThemes: string[],
  depth: typeof STRESS_DEPTHS[number]
) {
  const preferredThemes = [theme, ...topDnaThemes].filter(Boolean) as string[];
  const templates: FollowUpTemplate[] = [];

  for (const preferredTheme of preferredThemes) {
    for (const item of THEME_FOLLOW_UPS[preferredTheme] ?? []) {
      if (!templates.some((existing) => existing.focus === item.focus)) {
        templates.push(item);
      }
    }
  }

  for (const item of GENERAL_FOLLOW_UPS) {
    if (!templates.some((existing) => existing.focus === item.focus)) {
      templates.push(item);
    }
  }

  return templates.slice(0, followUpCount(depth)).map((item, index) => ({
    id: `stress_follow_up_${index + 1}`,
    ...item,
    response_type: "free_text",
    founder_response: null
  }));
}
