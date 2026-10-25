# Rendering and authoring review

Reviewed 25 October 2026 against `1c9b5cb596a68a65929417b7f02336ce51a6b065`.

The visual system already works well as a slide deck and as a readable mobile article. The highest-value changes are parser predictability, preserving literal examples, and making dense slides reachable on small screens. This branch keeps the existing layouts, themes, and inline deck format.

## Changes prepared

| Area | Reproduced problem | Change |
| --- | --- | --- |
| Literal syntax | `\*literal\*` became italic text with visible slashes; double-backtick code spans broke | Respect punctuation escapes and matching-length code spans |
| Code fences | A fence with trailing text could close a block; `:::` inside a code example closed its enclosing widget | Require a bare matching closing fence and track fences within containers |
| Tables and links | A code span containing `a|b` created extra table cells; parenthesized URL paths were truncated | Protect code spans while splitting cells and scan balanced link destinations |
| Notes and footnotes | Footnote definitions inside code were removed; separators inside notes split slides; inline code could interfere with notes extraction | Preserve fenced examples and treat complete notes as units, including inline code |
| Source copying | Source viewer displayed an escaped script tag but Copy used the unescaped underlying source | Copy exactly what the source viewer displays |
| Separate Markdown | Inline HTML raw-text scripts require special closing-tag escaping | Optional `data-src="talk.md"` loads plain Markdown over HTTP; includes an example and a visible load error |
| Desktop charts | The accessible source table contributed overflow beyond the stage | Keep that table in a clipped 1px block without affecting layout |
| Dense phone slides | Feature-card content extended below the fixed presentation viewport | Allow vertical scrolling within fluid phone slides; preserve the presentation dock |
| Read view | Long tokens could overflow; selected code lines could retain presentation emphasis | Allow prose to wrap and explicitly clear stepped-code styling in read view |
| Interaction | Nested tabs could capture one another's controls; flip cards were focusable but lacked keyboard activation | Scope controls, link tabs to panels, add tab arrow keys and flip-card Enter/Space activation |
| Edge cases | Empty terminals could stop startup; huge code step ranges allocated arrays based on author input | Skip empty terminal steppers and bound line ranges to the actual code block |
| Attributes | Media figures could have duplicate class attributes; standalone block IDs were dropped | Emit one class attribute and apply standalone IDs to the previous block |
| Touch controls | Article toolbar buttons were 34px | Use 44px targets on small screens |

## Verification

- `node --check deck.js` and `git diff --check` pass.
- Seven dependency-free Node regression tests pass: `node --test tests/parser.test.cjs`.
- Browser checks passed in connected Chromium against the live demo HTML, with the branch's JS and CSS supplied through Playwright request interception. No live deployment was changed.
- All 42 demo slides were checked on a 1440 × 900 desktop stage. The overflow check passes after the chart-table fix.
- Presentation checks passed at 320 × 740, 390 × 844, and 768 × 1024. Dense content has a scrollable area instead of being clipped.
- Light and dark article checks verified visible tab panes, expanded accordion content, hidden chart source tables, and wrapped paragraph/heading widths at 390px.
- Browser fixtures verify actual external Markdown loading, literal closing script tags, code/notes/footnote boundaries, nested tabs, bounded line ranges, empty terminals, and keyboard interaction. No page errors were recorded.
- Desktop chart and mobile feature-card article screenshots were visually inspected.

The browser regression runner is `tests/browser.cjs`. Install Playwright and its Chromium, serve the repository over HTTP, and run `node tests/browser.cjs`. `TALKDOWN_URL` overrides its default `http://127.0.0.1:8000`. CI runs the dependency-free syntax and parser checks.

## Recommendations after this branch

1. **Keep the current syntax, but document its limits.** A compatibility-preserving fix is preferable to introducing another widget delimiter. The README now distinguishes this parser from complete CommonMark. If syntax continues to grow, evaluate a tokenizer or CommonMark parser with explicit talkdown extensions and run the existing decks as compatibility fixtures.
2. **Prefer external Markdown for code-heavy decks.** Inline HTML remains convenient for a single-file deck. A `.md` source avoids HTML raw-text closing-tag hazards and is easier to edit and lint. External source requires HTTP; image and recording paths remain relative to the HTML wrapper.
3. **Expand browser coverage before release.** Add Firefox, Safari/WebKit, actual Android and iOS scrolling/swiping, landscape phones, screen-reader checks, and all theme/font combinations. Chromium viewport emulation is useful evidence but does not establish physical-device compatibility.
4. **Review print as its own output.** Check PDF pagination, presenter/read-only content, expanded widgets, article notes, and fixed figures in both modes. This change does not claim a completed print/export audit.
5. **Validate chart input explicitly.** Missing or nonnumeric cells currently become zero; negative values and mixed units need a defined contract and visible author diagnostics.
6. **Ship a tagged release after review.** Production wrappers should pin JS and CSS to the same released version instead of `@main`. Refresh the demo's cache version when publishing the release.

No public site was deployed or default branch updated as part of this review.
