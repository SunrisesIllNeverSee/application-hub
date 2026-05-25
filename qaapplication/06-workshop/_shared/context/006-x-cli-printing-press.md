**Yes, it actually works.** 

The `pp-x-twitter` (part of the broader **Printing Press** project by @mvanhorn) is a real, recently shipped CLI tool specifically built for creating and publishing **X Articles** (long-form posts) directly from Markdown or via commands. Cathryn Lavery (@cathrynlavery) published it by reverse-engineering X's internal editor endpoints since there's no official public Articles API.

### Quick Setup to Ship Your Article
1. **Install it** (easiest way):
   ```
   npx -y @mvanhorn/printing-press-library install x-twitter
   ```
   This grabs the CLI + agent skill.

   (Go-only alternative: `go install github.com/mvanhorn/printing-press-library/library/social-and-messaging/x-twitter/cmd/x-twitter-pp-cli@latest`)

2. **Auth**:
   - Run `x-twitter-pp-cli auth set-token YOUR_X_OAUTH2_USER_TOKEN`
   - Or set the env var `X_OAUTH2_USER_TOKEN`.

3. **Key commands for Articles**:
   - `x-twitter-pp-cli articles create_draft` — Start a draft.
   - `x-twitter-pp-cli articles update_title` / `update_content` — Edit (supports Markdown).
   - `x-twitter-pp-cli articles set-cover` / `upload_media` — Add images/cover.
   - `x-twitter-pp-cli articles publish` — Ship it live.
   - `x-twitter-pp-cli articles list` — Check your drafts/published ones.

It’s designed to be **agent-friendly** (works great with Claude, Cursor, etc. via skills), so you can even have an AI handle the full flow from your Markdown file.

### Tips for Your Article
- Prepare your content in Markdown — the tool handles conversion well.
- Test with a draft first (`create_draft` + `publish`).
- If you hit any snags (auth, rate limits, or endpoint changes), the community around Printing Press is active — check the repo or Cathryn’s recent posts.

If you run into issues during install/auth or want help scripting the full publish from a local Markdown file, paste the error/output here and I’ll walk you through it. Go ship that article! 🚀