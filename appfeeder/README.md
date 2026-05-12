# Application Hub — Browser Extension

Pre-fill accelerator and grant applications from your answer bank.

## Setup (dev)

1. `chrome://extensions` → Enable Developer Mode
2. Click **Load unpacked** → select this `appfeeder/` folder
3. Open the extension popup → paste your credentials:
   - **Session token** — copy from [mos2es.xyz/profile/settings](https://mos2es.xyz/profile/settings)
   - **Supabase anon key** — copy from your Supabase project settings (it's the public key)

## Supported portals (V1)

- Y Combinator (`ycombinator.com/apply`)
- Techstars (`apply.techstars.com`)
- a16z Speedrun (`speedrun.a16z.com/apply`)
- 500 Global (`500.co/*/apply`)
- Solofounders (`apply.solofounders.com`)

## How it works

1. When you open a supported portal, the extension scans the page for question labels
2. Each question is matched against your answer bank in Supabase
3. A small overlay appears: click **Fill N fields** to pre-fill matched answers
4. Review everything before submitting — the extension is a starting point, not a final draft

## Full spec

See [docs/BROWSER_EXTENSION.md](../docs/BROWSER_EXTENSION.md)
