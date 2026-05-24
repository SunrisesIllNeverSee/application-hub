# KASSA — Voice-AI Commitment Kernel Demo

**Live, cached, no authentication required.**

→ **Try the demo:** <https://sunrisesillneversee.github.io/KASSA/demo/commitment_kernel_demo_v7.html>

**Source / repo:** <https://github.com/SunrisesIllNeverSee/KASSA>

## What it shows

KASSA is the voice-AI implementation of MO§ES™'s commitment kernel.
Conventional voice agents re-run natural-language inference on every turn,
because they have no mechanism to preserve commitment across the
conversation. The commitment kernel changes that: once a signal's
commitment has been compressed and verified, downstream turns operate on
the kernel itself, not on the raw input.

**Empirical result, demonstrated in the demo:**

- Conventional NLU re-inference per call: **~50 seconds**
- KASSA with commitment kernel: **~6.5 seconds**

The same conservation principle that holds in the published paper — that
commitment is preserved under governed transformation — manifests as an
~8× latency reduction in voice. The demo isn't a benchmark you have to
trust; it's a thing you can hear.

## How to read the demo

1. Open the link. No login. No setup.
2. Listen to the cached interaction. Notice that the system isn't
   re-deriving meaning each turn — it's operating on the preserved
   commitment kernel.
3. The latency delta isn't optimization. It's what happens when meaning
   doesn't have to be reconstructed from scratch every cycle.

## How it ties into the broader framework

The same constitutional substrate that governs KASSA's voice loop also
governs the agent-marketplace, headless-software, and FDE-deployment
surfaces described in the field-sheet and the Conservation Law paper.
KASSA is the most immediately *experienceable* surface — but the
underlying physics is the same.

---

**Filed:** PPA #2 (SCS Engine, 63/883,018, Sep 17, 2025), among others.
**Patent + trademark portfolio:** See `01-field-sheet.md` for full IP table.
**Theoretical foundation:** Conservation Law of Commitment, V.05, Zenodo
DOI 10.5281/zenodo.20029607.
