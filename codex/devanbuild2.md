Bolt On 8 Future Work Features to AQUA
Repository: SunrisesIllNeverSee/application-hub
Context
This plan adds 8 future work features on top of the AQUA UX restructure. The AQUA restructure (sidebar: Dash/Applications/Questions/Answers) should be completed first as the foundation. These features build on that new structure.
The 8 Features to Bolt On
1. Split-Screen Editor (Overleaf/Prism-style)
Location: New /workspace/[program_id]/page.tsx redesign
What to build:
Two-panel layout: left panel (question tree + answer bank matches + persona), right panel (editor + compiled output)
Left panel shows collapsible question tree grouped by section
Each question in tree shows: theme tag, significance stars, answered status indicator
Clicking a question loads it in the right panel editor
Right panel has two tabs: "Editor" and "Compiled Output"
Editor tab uses existing AnswerEditor component
Compiled Output tab shows formatted answer ready for copy-paste (Markdown rendered)
Panel width is resizable (drag handle between panels)
Mobile: stacks vertically with toggle between panels
Key files:
Create app/app/(app)/workspace/[program_id]/page.tsx (redesign)
Create app/components/SplitScreenWorkspace.tsx (new component)
Create app/components/QuestionTree.tsx (new component)
Create app/components/CompiledOutput.tsx (new component)
Reference: codex/feedback.md lines 35-37 for the vision
2. VS Code-Style Answer Bank File Tree
Location: /answers route redesign
What to build:
Left sidebar: collapsible file tree grouped by theme (Team, Traction, Problem, Solution, etc.)
Each file in tree shows: question text preview (truncated), confidence badge (Draft/Solid/Locked), timestamp
Clicking a file opens it in the main editor panel
Main panel shows full question + AnswerEditor + version history
File tree supports: expand/collapse all, search/filter by text or theme
Each answer shows as a "captured moment" with hash, timestamp, version count
Add "New Answer" button that opens a modal to select from unlocked questions
Key files:
Redesign app/app/(app)/answers/page.tsx
Create app/components/AnswerFileTree.tsx (new component)
Create app/components/AnswerFileNode.tsx (new component)
Reference: codex/feedback.md lines 61-65 for the vision
3. Dash as Full Command Center (States, Challenges, Rewards)
Location: /dash route enhancement
What to build:
Add "YOUR STATE" section: applications in progress, questions answered this week, Pro credit earned, MoatScore (when available)
Add "ACTIVE CHALLENGES" section: dynamic challenges based on user profile (e.g., "Answer 3 questions in Traction theme", "Stress-test your Problem answer for YC")
Add "REWARDS UNLOCKED" section: achievements from user_achievements table with icons and descriptions
Add "DEADLINES" section: next 14 days deadlines with urgency indicators
Each challenge has a progress bar and completion action
Rewards show unlock date and shareable OG card link
Integrate with existing credits system (migration 032) and achievements table
Key files:
Enhance app/app/(app)/dash/page.tsx (formerly today)
Create app/components/DashStateCard.tsx (new)
Create app/components/DashChallengeCard.tsx (new)
Create app/components/DashRewardCard.tsx (new)
Reference: codex/feedback.md lines 71-77 and VISION.md lines 567-582
4. Merge Workspace into /applications with Tabs
Location: /applications route enhancement
What to build:
Add tabs to /applications page: "Discover" (current Hub), "My Applications" (workspace list)
"Discover" tab: existing Hub functionality (program discovery, filters, cards/timeline)
"My Applications" tab: list of user's applications with status, progress, deadlines
Clicking an application in "My Applications" opens the split-screen workspace inline (modal or slide-over)
Keep /workspace/[program_id] route for direct links and deep sharing
Add "Start New Application" button that opens program selector modal
Key files:
Enhance app/app/(app)/applications/page.tsx (formerly hub)
Create app/components/ApplicationsTab.tsx (new)
Create app/components/MyApplicationsTab.tsx (new)
Create app/components/ApplicationWorkspaceModal.tsx (new)
5. Merge Funders as Filter/View within Applications
Location: /applications route enhancement
What to build:
Add "Funders" as a filter tab or dropdown in /applications
When Funders filter is active, show funder cards (existing /funders functionality)
Each funder card shows: name, type, location, program count
Clicking a funder shows their programs in a sub-view or modal
Remove standalone /funders route (redirect to /applications?view=funders)
Keep funder detail page /funders/[slug] for now (can be merged later)
Key files:
Enhance app/app/(app)/applications/page.tsx
Reuse existing app/app/(app)/funders/page.tsx logic as a component
Create redirect from /funders to /applications?view=funders
6. Merge Archive as Tab within Questions
Location: /questions route enhancement
What to build:
Add tabs to /questions page: "My Questions" (current Question Bank), "Full Archive" (existing archive functionality)
"My Questions" tab: existing Question Bank with drip/unlock, theme grouping, AnswerEditor
"Full Archive" tab: existing archive with theme tabs, significance/popular sort, lock/unlock state
Keep the "Answer" button in archive that links to Question Bank
Remove standalone /archive/questions route (redirect to /questions?view=archive)
Archive tab shows all 225 questions with unlock state per user
Key files:
Enhance app/app/(app)/questions/page.tsx (formerly bank)
Reuse existing app/app/(app)/archive/questions/page.tsx logic as a component
Create redirect from /archive/questions to /questions?view=archive
7. Onboarding Gate
Location: New /onboarding route + middleware guard
What to build:
Create app/app/(app)/onboarding/page.tsx with entry gate flow
User must either: fill out "our application" (5-10 high-significance questions) OR upload an existing application
Select questions from archived_questions where is_universal = true and significance_score is high
Each answered question saves to profile_answers via existing save mechanism
After completion, analyze answers to detect theme profile (founder/student/researcher/job-seeker)
Store detected theme in user_profiles table
Add middleware guard in app/app/(app)/layout.tsx: redirect new users to /onboarding until completed
Grandfather existing users (skip gate if they have any profile_answers)
Show "Based on your answers, here's what we found for you" transition with fit scores
Key files:
Create app/app/(app)/onboarding/page.tsx
Modify app/app/(app)/layout.tsx to add onboarding guard
Reference: codex/feedback.md lines 51-57 and addendum lines 19-21
8. Persona Profiles
Location: New /profile/persona route + integration
What to build:
Create app/app/(app)/profile/persona/page.tsx showing distilled persona profile
Three-layer display: Answer Bank (raw capture) → Persona Profile (distilled output) → Recruiter Scoring (monetization surface)
Persona profile shows: theme strengths (radar chart), answer quality distribution, fit signals, composite score
Add "Profile Strength" meter: how complete is your profile (questions answered, stress-tested, confidence levels)
Show "Delta to next tier": "Answer 3 more questions in Vision to jump 12 places"
Integrate with existing user_profiles table (migration 011)
Link persona to fit scoring and program recommendations
Future: B2B surface where programs post applications and get ranked recommendations from persona profiles
Key files:
Create app/app/(app)/profile/persona/page.tsx
Enhance existing DnaRadarChart component for persona visualization
Create app/components/PersonaStrengthMeter.tsx (new)
Reference: codex/feedback.md lines 31-33 and lines 73-77
Implementation Order
Phase 1: Foundation (Features 4, 5, 6)
Merge workspace into Applications with tabs
Merge Funders as filter within Applications
Merge Archive as tab within Questions
These are UI consolidations that simplify the structure
Phase 2: Core UX (Features 1, 2)
Split-screen editor
VS Code-style Answer Bank file tree
These are the major UX overhauls that define the AQUA experience
Phase 3: Engagement (Features 3, 7)
Dash as command center with challenges/rewards
Onboarding gate
These drive user engagement and retention
Phase 4: Intelligence (Feature 8)
Persona profiles
This is the culmination of the data layer
Dependencies
Features 4, 5, 6 can be built in parallel (independent UI consolidations)
Feature 1 (split-screen) should come before Feature 2 (file tree) to establish the two-panel pattern
Feature 3 (Dash) depends on Feature 8 (Persona) for MoatScore display
Feature 7 (Onboarding) should come after Feature 8 (Persona) to have something to detect
Feature 8 (Persona) depends on having enough user data (answers, stress tests)
Testing Checklist
After each feature:
 Feature works on desktop and mobile
 Feature integrates with existing auth and data fetching
 Feature respects Pro/Free tier gates where applicable
 Feature has proper loading and error states
 Feature is accessible (keyboard navigation, screen readers)
 Feature has proper metadata and SEO tags
 Feature links correctly to other parts of the app
Expected Outcome
After all 8 features are bolted on:
AQUA has a complete, cohesive UX matching the vision
Split-screen editor makes BYOK and draft feel like a coherent workflow
VS Code-style Answer Bank makes answers feel like captured moments
Dash drives engagement with challenges and rewards
Onboarding gate gives every downstream data point context
Persona profiles distill accumulated data into actionable intelligence
All routes are consolidated into the 4-pillar structure (Dash/Applications/Questions/Answers)
The product is ready for public launch with a differentiated experience