// WebMCP: Register browser-native tools for AI agents
// Spec: https://developer.chrome.com/docs/ai/webmcp/imperative-api
// Feature-detect both document.modelContext and navigator.modelContext

(function () {
  'use strict';

  const mc =
    (typeof document !== 'undefined' && document.modelContext) ||
    (typeof navigator !== 'undefined' && navigator.modelContext);

  if (!mc || typeof mc.registerTool !== 'function') {
    // WebMCP not supported in this browser — silently exit
    return;
  }

  // Tool: Search AQUA content
  mc.registerTool({
    name: 'search_aqua',
    description: 'Search the AQUA Application Hub for features, concepts, guides, or pages. Returns relevant page URLs and titles.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query for AQUA content'
        }
      },
      required: ['query']
    },
    annotations: { readOnlyHint: true },
    async execute({ query }) {
      // Use AI Search (RAG) endpoint for semantic search
      try {
        const resp = await fetch('https://moses-analytics.sigrank.workers.dev/api/search?q=' + encodeURIComponent(query) + '&limit=5', {
          headers: { 'X-Original-Host': 'sigeconomy.com' }
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data.results && data.results.length > 0) {
            const results = data.results.map(r =>
              '- [score=' + r.score.toFixed(2) + '] ' + r.text.substring(0, 120) + '...'
            ).join('\n');
            return { content: [{ type: 'text', text: 'Results for "' + query + '":\n' + results }] };
          }
        }
      } catch (e) { /* fall through to keyword search */ }
      // Fallback: keyword matching
      const q = String(query || '').toLowerCase();
      const pages = [
        { url: '/', title: 'AQUA Home', keywords: ['home', 'aqua', 'application', 'hub', 'answer', 'bank'] },
        { url: '/about', title: 'About AQUA', keywords: ['about', 'aqua', 'what', 'founder', 'infrastructure'] },
        { url: '/about/scoring', title: 'Scoring', keywords: ['scoring', 'fit', 'score', 'opportunity', 'match'] },
        { url: '/application-infrastructure', title: 'Application Infrastructure', keywords: ['infrastructure', 'application', 'reuse', 'lineage', 'graph'] },
        { url: '/concepts/answer-lineage', title: 'Answer Lineage', keywords: ['lineage', 'answer', 'source', 'provenance', 'variant'] },
        { url: '/concepts/answer-reuse', title: 'Answer Reuse', keywords: ['reuse', 'answer', 'repeat', 'accelerator', 'grant'] },
        { url: '/concepts/application-graph', title: 'Application Graph', keywords: ['graph', 'application', 'network', 'question', 'answer'] },
        { url: '/concepts/fit-score', title: 'Fit Score', keywords: ['fit', 'score', 'opportunity', 'readiness', 'match'] },
        { url: '/concepts/smart-matcher', title: 'Smart Matcher', keywords: ['smart', 'matcher', 'fit', 'opportunity', 'recommend'] },
        { url: '/guides', title: 'Guides', keywords: ['guide', 'how', 'tutorial', 'help'] },
        { url: '/guides/how-to-build-an-answer-bank', title: 'Build an Answer Bank', keywords: ['build', 'answer', 'bank', 'guide'] },
        { url: '/guides/how-to-compare-accelerator-fit', title: 'Compare Accelerator Fit', keywords: ['compare', 'accelerator', 'fit', 'guide'] },
        { url: '/guides/how-to-reuse-application-answers', title: 'Reuse Application Answers', keywords: ['reuse', 'answer', 'application', 'guide'] },
        { url: '/faq', title: 'FAQ', keywords: ['faq', 'question', 'help', 'support'] },
        { url: '/contact', title: 'Contact', keywords: ['contact', 'email', 'message', 'support'] },
        { url: '/developers', title: 'Developers', keywords: ['developer', 'api', 'mcp', 'integration', 'npm'] },
        { url: '/privacy', title: 'Privacy', keywords: ['privacy', 'policy', 'data'] },
        { url: '/vs', title: 'Comparisons', keywords: ['vs', 'compare', 'alternative', 'founderapp', 'spreadsheet'] },
        { url: '/login', title: 'Login', keywords: ['login', 'sign', 'auth', 'account'] }
      ];
      const matches = pages.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.keywords.some(k => k.includes(q) || q.includes(k))
      );
      if (matches.length === 0) {
        return { content: [{ type: 'text', text: 'No results found for: ' + query + '. Try: answer bank, fit score, smart matcher, guides, lineage.' }] };
      }
      const results = matches.map(p => '- [' + p.title + '](https://mos2es.xyz' + p.url + ')').join('\n');
      return { content: [{ type: 'text', text: 'Results for "' + query + '":\n' + results }] };
    }
  });

  // Tool: Get AQUA concept
  mc.registerTool({
    name: 'get_concept',
    description: 'Get an AQUA concept definition. Available concepts: answer-lineage, answer-reuse, application-graph, fit-score, smart-matcher.',
    inputSchema: {
      type: 'object',
      properties: {
        concept: {
          type: 'string',
          enum: ['answer-lineage', 'answer-reuse', 'application-graph', 'fit-score', 'smart-matcher'],
          description: 'The concept to retrieve'
        }
      },
      required: ['concept']
    },
    annotations: { readOnlyHint: true },
    async execute({ concept }) {
      const concepts = {
        'answer-lineage': 'Answer Lineage: every answer traces its origin and variants, enabling provenance tracking and reuse without losing source context. See: https://mos2es.xyz/concepts/answer-lineage',
        'answer-reuse': 'Answer Reuse: reuse application answers across accelerators, grants, fellowships, and jobs. One answer bank for every application. See: https://mos2es.xyz/concepts/answer-reuse',
        'application-graph': 'Application Graph: a portable network of questions, answers, fit signals, and review history that spans all your applications. See: https://mos2es.xyz/concepts/application-graph',
        'fit-score': 'Fit Score: opportunity fit and readiness signals that help you understand which programs match your profile. See: https://mos2es.xyz/concepts/fit-score',
        'smart-matcher': 'Smart Matcher: recommends opportunities based on your answer bank and fit signals. See: https://mos2es.xyz/concepts/smart-matcher'
      };
      const result = concepts[concept] || 'Unknown concept: ' + concept;
      return { content: [{ type: 'text', text: result }] };
    }
  });

  // Tool: Navigate to an AQUA page
  mc.registerTool({
    name: 'navigate_to',
    description: 'Navigate the browser to an AQUA Application Hub page. Use this when the user wants to view a specific page.',
    inputSchema: {
      type: 'object',
      properties: {
        page: {
          type: 'string',
          enum: ['home', 'about', 'application-infrastructure', 'guides', 'faq', 'contact', 'developers', 'privacy', 'login', 'smart-matcher'],
          description: 'The page to navigate to'
        }
      },
      required: ['page']
    },
    async execute({ page }) {
      const pages = {
        'home': '/',
        'about': '/about',
        'application-infrastructure': '/application-infrastructure',
        'guides': '/guides',
        'faq': '/faq',
        'contact': '/contact',
        'developers': '/developers',
        'privacy': '/privacy',
        'login': '/login',
        'smart-matcher': '/smart-matcher'
      };
      const path = pages[page] || '/';
      if (typeof window !== 'undefined') {
        window.location.href = path;
      }
      return { content: [{ type: 'text', text: 'Navigating to ' + page + ' (' + path + ')' }] };
    }
  });

  // Tool: Get AQUA ecosystem info
  mc.registerTool({
    name: 'get_ecosystem',
    description: 'Get information about the AQUA ecosystem: related projects, platforms, and tools.',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    annotations: { readOnlyHint: true },
    async execute() {
      const ecosystem = [
        'AQUA Application Hub (mos2es.xyz): Founder-first application infrastructure',
        'MO§ES™ (mos2es.com): Sovereign signal governance framework',
        'SigRank (signalaf.com): Public leaderboard and benchmark for AI operator evaluation',
        'Upsilon: Enterprise measurement engine for AI operations',
        'SIGNOMY (signomy.xyz): Governed AI agent marketplace',
        'MCP Server: application-hub-mcp-server (npm package)',
        'Features: Reusable answer bank, question archive, fit signals, answer lineage, review history'
      ];
      return { content: [{ type: 'text', text: 'AQUA Ecosystem:\n' + ecosystem.join('\n') }] };
    }
  });
})();
