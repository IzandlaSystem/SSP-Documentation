# Stop-Slop Editor Brief (technical documentation calibration)

You are applying the **stop-slop** skill to engineering documentation pages in a VitePress site. The skill removes predictable AI-writing patterns from prose. But this is API/architecture **documentation**, not a blog essay — so apply the rules with technical-doc judgment. Accuracy and clarity beat punchiness.

## Repo
`/Users/nduzi/Documents/IzandlaSystems/SSP-Docs` — your assigned files are listed in your task. Edit them in place with the Edit tool.

## What to CUT (apply aggressively)
1. **Adverbs.** Remove filler -ly words and hedges: really, just, simply, actually, fully, completely, truly, genuinely, honestly, literally, deeply, fundamentally, inherently, inevitably, interestingly, importantly, crucially, essentially, basically, effectively, significantly (as adverb). Keep an adverb ONLY if removing it changes the technical meaning (rare).
2. **Throat-clearing openers.** "It's worth noting that", "Note that", "Importantly,", "It turns out", "The truth is", "Here's the thing", "It's important to note", "This matters because", "At its core". Cut to the point.
3. **Business jargon.** leverage→use, navigate (challenges)→handle/address, unpack→explain/examine, lean into→accept, landscape→field/context, game-changer→significant, deep dive→examination, moving forward→next, circle back→return to, on the same page→aligned.
4. **Vague declaratives.** "This is significant", "The implications are significant", "The stakes are high", "This matters", "This is important" with no specific referent — cut or replace with the specific fact.
5. **Meta-commentary.** "In this section, we'll...", "As we'll see...", "Let me walk you through...", "The rest of this page...", "Hint:", "Spoiler:". Delete; let the doc move.
6. **Binary contrasts.** "not X, it's Y", "isn't X, it's Y", "The answer isn't X. It's Y." → state Y directly. (But keep a genuine technical negation like "does NOT cascade" or "is NOT admitted" — those are precise, not rhetorical.)
7. **Lazy extremes.** every, always, never, everyone, nobody used for vague authority → replace with the specific case. (Keep "never" in precise technical rules like "never invents benchmarks".)
8. **Em dashes.** Remove ALL em dashes — both the unicode `—` and the HTML entity `&mdash;`. Replace with a comma, colon, period, or parentheses, whichever reads best. This is the single biggest change in these docs. Examples:
   - `**Source file &mdash; root-mounted.** These handlers...` → `**Source file (root-mounted).** These handlers...`
   - `manual access check via ensureSessionAccess &mdash; super admin, ...` → `manual access check via ensureSessionAccess (super admin, ...)`
   - `Roles are loaded ... on every request (joined to ... with revoked_at IS NULL), not from JWT app_metadata.roles, so grants take effect immediately` (the `&mdash;` → comma or parens)
9. **False agency / narrator-from-distance.** "The data tells us", "the market rewards", "the culture shifts" — name the actor if one exists; if not, leave (technical docs often describe systems, which is fine).
10. **Dramatic fragmentation / staccato.** Merge `X. And Y. And Z.` punchy stacks into normal sentences where it doesn't lose precision.

## What to PRESERVE (do not "fix" these — they are correct doc register)
- **Technical passive voice.** "Routes are mounted at `/sessions`", "JWTs are verified locally with jose", "the field is nullable", "is required", "may be null", "is set by the ingestion pipeline". This is correct, actor-neutral documentation. Do NOT invent an actor ("The developer mounts routes...") just to force active voice. Convert passive→active ONLY where a clear, real technical actor exists AND it reads better (e.g. "The gateway verifies JWTs with jose" is fine; "The field is nullable" must stay).
- **Code, file paths, endpoints, HTTP verbs, field names, types, versions, UUIDs, constants, byte offsets, hex values.** Never alter.
- **Tables** (their data and structure). You may tighten a table cell's prose but never change a value, status code, path, or type.
- **Frontmatter** (`title`/`description`/`outline`). You may trim slop from a `description` but keep it accurate and a single line.
- **Mermaid blocks.** Do not edit diagram content.
- **Genuine technical negations.** "does NOT cascade", "is NOT admitted", "sub_coach is NOT admitted", "isAthlete does not cascade" — these are precise. Keep them.
- **VitePress callouts** (`> [!TIP]`, `> [!WARNING]`, `> **Note.**`). Keep the callout; trim slop from its body. Keep `<code v-pre>` escapes intact (do not reintroduce `{{ }}`).
- **The meaning.** After edits, every technical fact must still be true. This is a prose-quality pass, not a rewrite of the content.

## How to edit
- Use the Edit tool with precise `old_string`→`new_string` replacements. Edit prose sentences; leave code/tables/paths alone.
- Prefer small, surgical edits over rewrites. If a sentence is already clean, leave it.
- Do NOT change headings unless they contain a banned phrase (rare). Heading IDs are used by sidebar anchors and `#section` links — changing a heading breaks links.
- Do NOT touch `#`-level section anchors that the sidebar links to.
- Work through your assigned files top to bottom. Skip files that are already clean.

## After editing
Re-read each edited file once to confirm: no remaining em dashes (`—` / `&mdash;`), no filler adverbs, no throat-clearing, facts intact, build still valid (no broken `{{ }}`, no broken markdown tables). Then report per-file: count of edits made + 1-2 line summary of what kind of slop you removed. If a file needed no changes, say so.

## Scoring (use as a guide, not a gate)
Rate the worst-affected file you edited 1-10 on Directness / Rhythm / Trust / Authenticity / Density. If still <35/50 after your edits, do another pass. (Most docs will be 40+ because they're reference material, not essays — don't force essay rhythm onto reference docs.)