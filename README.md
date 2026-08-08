# Halstead Glass — Product Advice Guide

Interactive advice tool embedded on Webflow product overview pages. Asks four
questions, scores the product range against the answers, and presents the top
three with a lead capture form.

Live on `/windows/windows-overview`.

## Files

| File | Purpose |
|---|---|
| `window-guide.js` | The tool. This is the deployed artefact. |
| `harness.html` | Standalone dev rig — runs the tool outside Webflow. |
| `success.html` | Dev rig for the success page branch. |
| `test-matrix.mjs` | Node runner that walks every answer path headlessly. |
| `test-success.mjs` | Node runner for the success-page handoff. |
| `_style-snippet.txt` | The one CSS rule that must stay in the Webflow embed. |

## Two pages, one script

The same file runs on both the product overview page and the form success page,
and decides which job to do by whether `#window-guide` exists.

The form redirects to `/windows-advice-success`, so Webflow's inline
`.w-form-done` block never appears — anything shown after conversion has to live
on the success page. The guide writes the recommendation to `sessionStorage`
under `wg_handoff` on submit; the success page reads it and renders the product
links. Deliberately not a query string, so the redirect URL stays clean.

The success page shows **all three recommended products**, not only the ones the
customer ticked — they have already converted, so give them more to explore. The
ticks are stored alongside in case that is revisited.

Both success-page embeds need only a `#wg-done-links` div containing one
`.wg-result-link` prototype, plus the same script tag.

## Deploying

The Webflow page needs an HTML Embed containing:

```html
<style>
  #window-guide .wg-result-checkbox { accent-color: #E4291E; }
</style>
<script src="https://cdn.jsdelivr.net/gh/madewithpixels/Halstead-Glass-Product-Advice-Tools@v1.0.0/window-guide.js"></script>
```

Pin to a **tag**, not a branch. jsDelivr caches branch URLs aggressively and you
will chase phantom bugs otherwise. Cut a new tag to release, and bump the version
in the embed.

The repository must be **public** — jsDelivr's `gh/` endpoint cannot read private
repos and returns a 404 with no explanation if it is private.

Release steps:

```bash
git add -A && git commit -m "..." && git push
git tag v1.0.1 && git push --tags
```

Then update the version in the Webflow embed and publish.

Then publish the Webflow site — Analyze goal data is not retrospective.

## Required Webflow markup

The script binds to these selectors. Renaming any of them in the Designer breaks
it silently rather than loudly.

- `#window-guide` — root
- `[data-wg="start"]` — start button
- `.wg-stages`, `.wg-progress`, `.wg-progress-fill`, `#wg-progress-text`
- `.wg-stage[data-step="1..4"]`, each containing `.wg-badge`, `.wg-options`
  with `.wg-option[data-value]`, `.wg-summary` > `.wg-summary-text`, and
  `[data-wg="change"]`
- `#wg-result` > `.wg-result-options` > `.wg-result-option` (card template,
  cloned) containing `.wg-result-checkbox`, `.wg-result-name`, `.wg-price-band`,
  `.wg-result-desc`, `.wg-result-tags` > `.wg-tag`, `.wg-result-caveat`
- `#wg-done-links` > `.wg-result-link` (prototype, cloned on submit)
- A `form` with hidden inputs named exactly:
  `Property` `Priority` `Budget` `Style` `Recommended` `Selected` `Changed` `Source`

Those eight names become the labels in the Webflow notification email. Webflow
collapses newlines inside a single field value, which is why the summary is
spread across fields rather than built as one block of text.

## Local development

```bash
npx serve .          # file:// blocks the script fetch, so use a static server
open http://localhost:3000/harness.html
```

The harness has a source box at the top. Point it at `./window-guide.js` for
local work, or at a jsDelivr URL to verify a release before publishing Webflow.

It also shows the eight hidden field values live, so the enquiry email content
can be checked without submitting anything.

## Testing

```bash
npm i jsdom
node test-matrix.mjs     # all 336 answer paths
node test-success.mjs    # success-page handoff
```

`test-success.mjs` covers the normal handoff plus three failure modes: a direct
visit with nothing stored, malformed JSON in storage, and an unknown product key.
All three should degrade to no links rather than an empty box or an exception.

Walks all 336 answer paths (3 × 4 × 4 × 7) through the real UI and reports:

- how often each product is recommended
- any product that never appears
- any path returning fewer than three results
- any path where the customer named a style and nothing recommended supports it

Last run — 336 paths, 0 style mismatches, 0 short results:

| Product | Appears in |
|---|---|
| Origin Aluminium Windows | 248 (73.8%) |
| Masterframe NEOsash uPVC Windows | 223 (66.4%) |
| Quickslide uPVC Sliding Sash Windows | 203 (60.4%) |
| REHAU Flush uPVC Casement Windows | 190 (56.5%) |
| Granada Secondary Glazing | 144 (42.9%) |

Note that `STYLE_SUPPORT` in both `harness.html` and `test-matrix.mjs` mirrors
`META.styles` from the tool. It exists only to flag mismatches in testing. If the
styles list changes in `window-guide.js`, update those copies or the flags lie.

## Notes on the model

Scoring lives in `propertyScores()`, `priorityScores()` and `budgetFit()`, with
`META` holding each product's price band, supported styles and material.

Two deliberate behaviours to know before changing anything:

1. **Granada is force-eligible whenever property = conservation**, regardless of
   the style asked for, and the +5 conservation weight usually puts it top. A
   conscious commercial choice, under review pending client feedback on the
   enquiries it produces. Note the matrix confirms this does not crowd out the
   requested style — a sash request still returns sash products alongside it.
2. **Budget "open" returns 0 for every product** (`BUDGET_TARGET.open = null`),
   so that answer deliberately has no influence on ranking.

Hidden fields are **output only**. The script holds working state in
`lastRecommendedKeys` and `defaultSelectedKeys`. Do not go back to reading
product keys out of the form fields — those now contain prose, and parsing them
would break the success-message links silently while the email still looked
correct.

## Measurement

Webflow Analyze goals on the live page:

| Goal | Fires on |
|---|---|
| Windows Advice Tool - Start | Click on "Get instant Advice" |
| Windows Advice Tool - Q1..Q4 | Answering each stage (all options in one goal) |
| Windows Advice Tool - Enquiry | View of `/windows-advice-success` |

Goals record **answered**, not reached. Q4 answered means the recommendation was
shown, so `Q4 − Enquiry` is the count who got advice and did not submit.

Per-option popularity is not available from goals, since a goal aggregates its
elements — but every option button is recorded as an individual event, so the
breakdown can be pulled from the Analyze top events report.

## Planned

Doors and conservatories versions, then a merged variant inside the main
Get a quote form covering all three ranges. At that point `PRODUCT`, `META` and
the scoring weights should be split into per-range config, leaving the engine
generic.
