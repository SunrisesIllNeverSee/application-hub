// Local-first write boundary (LF-25).
//
// When AQUA_LOCAL_FIRST=1 (or 'true'), tools that persist private user
// content server-side (answer bodies, pasted application text, review
// content derived from answers, draft-run payloads) refuse honestly.
// Read-only tools and metadata stays available.

export const LOCAL_FIRST_REFUSAL_MESSAGE =
  "local-first mode: private content stays on device";

export function isLocalFirst(): boolean {
  const v = process.env.AQUA_LOCAL_FIRST;
  return v === "1" || v === "true";
}

/** MCP tool-result refusal for private-content writes under local-first. */
export function privateWriteRefusalResult(detail?: string) {
  return {
    content: [
      {
        type: "text" as const,
        text: `Refused: ${LOCAL_FIRST_REFUSAL_MESSAGE}${detail ? ` — ${detail}` : ""}`,
      },
    ],
    isError: true,
  };
}
