import LoginClient from './LoginClient'

// M09b B0.4 — /login is a client component, so without JavaScript (curl,
// fetch-only agents, text browsers) it rendered nothing but a title. This
// server wrapper puts plain guidance in the SSR HTML inside <noscript>:
// how a human signs in, and where agents should go instead.
export default function LoginPage() {
  return (
    <>
      <noscript>
        <div style={{ maxWidth: 640, margin: '3rem auto', padding: '0 1.5rem', fontFamily: 'system-ui, sans-serif', lineHeight: 1.6 }} data-testid="login-noscript">
          <h1>Sign in to AQUA</h1>
          <p>
            Signing in needs JavaScript. Open https://aquaidp.xyz/login in a regular web browser, then sign in with
            your email and password, a one-time email link, or a connected provider. New users can create an account
            on the same page.
          </p>
          <p>
            Your private answers live in an encrypted vault in your browser, not on AQUA&rsquo;s servers. After signing
            in you unlock the vault with your own secret on the AQUA Local page (/aqua-local).
          </p>
          <h2>Are you an AI agent?</h2>
          <p>
            Agents do not sign in here and never need a user&rsquo;s password or token. Read the agent guide at{' '}
            <a href="/agents">https://aquaidp.xyz/agents</a> (Markdown: <a href="/agents.md">/agents.md</a>) and{' '}
            <a href="/llms.txt">/llms.txt</a>: an agent helps through the local AQUA companion, and the human approves
            answers in this browser app.
          </p>
        </div>
      </noscript>
      <LoginClient />
    </>
  )
}
