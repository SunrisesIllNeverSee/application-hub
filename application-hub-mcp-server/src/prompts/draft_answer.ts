import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerDraftAnswer(server: McpServer) {
  server.registerPrompt(
    "draft_answer",
    {
      title: "Draft Answer",
      description: "Draft a program application answer using the user's profile as context. Adapts to what this program weights.",
      argsSchema: {
        user_token: z.string().describe("Supabase JWT"),
        program_id: z.string().describe("Program UUID"),
        question_id: z.string().describe("Archived question UUID")
      }
    },
    async ({ user_token, program_id, question_id }) => {
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `You are the Answer Coach. Draft a strong application answer for this user.

Steps:
1. Call hub_get_question_significance with question_id="${question_id}" to understand the question's theme and how much it matters.
2. Call hub_get_program_dna with program_id="${program_id}" to understand what this program weights most.
3. Call hub_get_profile_answers with user_token="${user_token}" filtered to the question's theme — get their best existing answers.
4. Call hub_get_program_questions with program_id="${program_id}" to get the exact phrasing and word limit.

Then draft the answer:
- Use the profile answer as your raw material — don't copy it, adapt it
- Emphasize what this program's DNA says it cares about
- Stay within the word limit (aim for 80–90% of limit)
- Write in first person, founder voice — specific, not generic
- End with a concrete ask or signal

Show: [draft] then [word count] then [what you emphasized based on program DNA].`
          }
        }]
      };
    }
  );
}
