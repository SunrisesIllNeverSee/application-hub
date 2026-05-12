AQUA UX Restructure — Sidebar, Routes, and Branding
Repository: SunrisesIllNeverSee/application-hub
Context
Rebrand from "Application Hub" to "AQUA" (Applications. Questions. Answers.) with a simplified 4-pillar navigation structure:
Dash — states, challenges, rewards, interactions
Applications — program discovery + workspace combined
Questions — Question Bank + Archive merged
Answers — Answer Bank (VS Code-style captured moments)
This aligns with the core concept: "A database of Applications, Questions, and Answers."
Changes to Make
1. Update Sidebar Navigation (app/components/Sidebar.tsx)
Lines 26-97: Replace the NAV array with the new 4-pillar structure:

const NAV = [  
  {  
    href: '/dash',  
    label: 'Dash',  
    icon: (dashboard icon),  
  },  
  {  
    href: '/applications',  
    label: 'Applications',  
    icon: (grid/list icon),  
  },  
  {  
    href: '/questions',  
    label: 'Questions',  
    icon: (question icon),  
  },  
  {  
    href: '/answers',  
    label: 'Answers',  
    icon: (database/stack icon),  
  },  
]
Lines 149-159: Update logo branding from "Application Hub" to "AQUA" with tagline:

<span className="text-sm font-semibold text-white tracking-tight">AQUA</span>  
<span className="text-xs text-neutral-400 ml-1">Applications. Questions. Answers.</span>
Lines 298: Update mobile top bar branding similarly.
Lines 132-144: Update isNavActive() function to handle new routes:
/dash matches exactly
/applications matches /applications and /applications/* (including workspace)
/questions matches /questions and /questions/*
/answers matches /answers exactly
Remove: Funders and Archive from main nav (move Funders into Applications as a filter/view, merge Archive into Questions).
2. Route Restructuring
Create new route: /dash
Rename app/app/(app)/today/page.tsx to app/app/(app)/dash/page.tsx
Update metadata title to "Dash"
Keep existing functionality (stats, in-progress apps, deadlines, question bank nudge, top matches)
This becomes the command center for states, challenges, rewards
Create new route: /applications
Rename app/app/(app)/hub/page.tsx to app/app/(app)/applications/page.tsx
Update metadata title to "Applications"
Keep existing Hub functionality (program discovery, filters, cards/timeline views)
Funders can be added as a tab or filter within this route later
Update workspace routing
Keep app/app/(app)/workspace/[program_id]/page.tsx as-is for now
Update the "Back" link (line 113) from /workspace to /applications
Future: merge workspace into /applications with tabs (Discover / My Applications)
Create new route: /questions
Rename app/app/(app)/bank/page.tsx to app/app/(app)/questions/page.tsx
Update metadata title to "Questions"
Keep existing Question Bank functionality (drip/unlock, theme tabs, AnswerEditor)
Add a tab or section for the full Archive (currently at /archive/questions)
Merge the archive view into this route with tabs: "My Questions" / "Full Archive"
Keep existing route: /answers
Keep app/app/(app)/answers/page.tsx as-is
Update metadata title to "Answers"
Future: implement VS Code-style file tree UI (Phase 2 of the earlier plan)
Remove or redirect:
/funders → redirect to /applications?view=funders or merge as a filter
/archive/questions → redirect to /questions?view=archive
/today → redirect to /dash
/hub → redirect to /applications
/bank → redirect to /questions
3. Update Root Layout Metadata (app/app/layout.tsx)
Lines 12-45: Update branding:

export const metadata: Metadata = {  
  metadataBase: new URL('https://mos2es.xyz'),  
  title: {  
    default: 'AQUA',  
    template: '%s — AQUA',  
  },  
  description:  
    'Applications. Questions. Answers. A structured intelligence system for reusable applications. Fill once, improve continuously, apply everywhere.',  
  keywords: [  
    'applications',  
    'questions',  
    'answers',  
    'accelerator',  
    'grants',  
    'fellowship',  
    'startup',  
    'YC',  
    'Techstars',  
    'job applications',  
    'school applications',  
    'common app',  
  ],  
  authors: [{ name: 'Ello Cello LLC' }],  
  openGraph: {  
    type: 'website',  
    url: 'https://mos2es.xyz',  
    siteName: 'AQUA',  
    title: 'AQUA — Applications. Questions. Answers.',  
    description:  
      'Applications. Questions. Answers. A structured intelligence system for reusable applications. Fill once, improve continuously, apply everywhere.',  
  },  
}
4. Update App Layout (app/app/(app)/layout.tsx)
No changes needed to the layout structure itself, but ensure the new routes work correctly with the existing auth guard and data fetching.
5. Update Internal Links
Search and replace internal links throughout the codebase:
/today → /dash
/hub → /applications
/bank → /questions
/archive/questions → /questions?view=archive
/funders → /applications?view=funders (or remove if not needed)
Key files to check:
app/app/(app)/dash/page.tsx (formerly today) — update links to other routes
app/app/(app)/applications/page.tsx (formerly hub) — update links
app/app/(app)/questions/page.tsx (formerly bank) — update links
app/app/(app)/answers/page.tsx — update links
Any components with hardcoded links (e.g., empty states, CTAs)
6. Update OG Image Route (if exists)
If there's an /api/og route for generating OG images, update the default branding from "Application Hub" to "AQUA" with the new tagline.
7. Testing Checklist
After implementing:
 Sidebar shows 4 items: Dash, Applications, Questions, Answers
 Logo displays "AQUA" with "Applications. Questions. Answers." tagline
 /dash loads the former Today page with all functionality
 /applications loads the former Hub page with all functionality
 /questions loads the former Question Bank page
 /answers loads the Answer Bank page
 Workspace (/workspace/[program_id]) still works, back link goes to /applications
 Old routes redirect correctly (/today → /dash, /hub → /applications, /bank → /questions)
 Mobile sidebar shows updated branding
 Page titles and metadata reflect AQUA branding
 All internal links point to new routes
8. Future Work (Out of Scope for This Plan)
These are for later phases, not this restructure:
Split-screen editor (Overleaf/Prism-style) — Phase 3 of the earlier plan
VS Code-style Answer Bank file tree — Phase 2 of the earlier plan
Dash as full command center with challenges/rewards — Phase 1 of the earlier plan
Merge workspace into /applications with tabs
Merge Funders as a filter/view within Applications
Merge Archive as a tab within Questions
Expected Outcome
After this restructure:
Clean 4-pillar navigation matching the AQUA concept
Simplified user mental model (Applications. Questions. Answers.)
Foundation for the split-screen editor and VS Code-style Answer Bank
Consistent branding across all surfaces
No functionality lost — all existing features preserved under new routes