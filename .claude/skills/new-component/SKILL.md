---
name: new-component
description: Use when adding a new widget or component to talkdown, usually from a GitHub issue labelled `component`. Designs Markdown-friendly syntax, implements it in the runtime, updates the docs and gallery, runs the QA audit across themes, modes and devices, then ships it as a PR with preview images and merges it once CI and review are clean.
---

# Adding a talkdown component

One component per run, end to end: issue → syntax → code → docs → QA → PR with previews → CI and review → merge. The input is usually an issue number in `sambhav/talkdown`.

Ground rules:

- `gh` defaults to another host on some machines: prefix every GitHub command with `GH_HOST=github.com`.
- Commit as `sambhav <sambhavs.email@gmail.com>` (repo-local `git config`). End commit messages with the Co-Authored-By line from your instructions and PR bodies with the Generated-with line.
- Open-source content only: no internal names, decks or screenshots of anything but the gallery.
- Never push to `main` directly or force-push it. Only touch your own branch and the `previews` branch.

## 1. Start clean

```sh
GH_HOST=github.com gh issue view N -R sambhav/talkdown            # the proposal: why, syntax, present/read behaviour
GH_HOST=github.com gh pr list -R sambhav/talkdown --state all --search "N in:body"   # someone already on it? stop and report
git fetch origin && git switch -c component/<slug> origin/main
npm ci && npm run build && npm test                               # baseline must pass before you change anything
```

Read the issue's related issues (it links them) so shared pieces, such as one sandbox or one stored preference, are built once.

## 2. Design the syntax

The syntax is the product. Agents write it and people tweak it by hand, so it must be short, guessable and still read well as plain Markdown, for example on GitHub, where talkdown does not run.

Reuse the shapes talkdown already has, in this order of preference:

1. **Plain Markdown that just gets styled**: lists, tables, quotes, images, headings. For example `::: stats` is a list with bold numbers.
2. **A container**: `::: name option=value flag`, with `### Heading` starting each item, the way `tabs`, `timeline`, `accordion` and `features` do. Options are parsed by `directive()` in `src/markdown.js` and arrive as `data-*` attributes.
3. **A fenced block**: ` ```name {options} `, for content with its own mini-format (terminal, mermaid, csv). Options go in `{…}` after the language, like `{steps: 1-2 | 3}`.
4. **An inline form** only for something used mid-sentence, such as `==mark==` or `:icon:`. It needs a delimiter that never occurs in normal prose or code.

Rules:

- One obvious way to write it. Defaults cover the common case, and options are rare refinements.
- No new punctuation when a heading, list item or table row will do. Borrow known conventions (GitHub, Obsidian, MDX, Mermaid) over invented ones.
- Fail visibly: bad input renders a `td-error` with `role="alert"` naming the problem, never a blank or a crash.
- Follow the issue's proposed syntax unless you find something clearly better. If you change it, say why in the PR.

## 3. Implement

Read a similar existing widget first and copy its shape: `timeline()` and `panes()` for heading-based steppers, `flip()` for a two-state card, `terminal()` for a fence, `stats()` for a styled list. The header comment of `src/deck.js` explains steps.

| Piece | Where |
|---|---|
| Fence or inline syntax | `src/markdown.js`: `md.renderer.rules.fence`, `talkdown_inline` |
| Container to widget | `src/deck.js`: a function plus one line in `widgets()` |
| Steps (present view) | `steps(el, n, show, { read })`. ↓ advances, click jumps, and `read: 'end'` shows the last step in read view |
| Styles | `deck.css` widgets section, plus `[data-view=read]` rules and the phone/tall rules near the end |
| Doc comment | the widget list at the top of `src/deck.js` |
| Unit tests | `tests/parser.test.cjs`: parsing, options, diagnostics |
| Browser checks | `tests/browser.cjs` or a gallery assertion, if the widget is interactive |

Behaviour every component needs:

- **Present view**: fits the 16:9 stage, steps with ↓ when there is a sequence, and is usable with mouse, touch and keyboard.
- **Read view**: everything expanded and readable as an article. No hidden state, nothing that needs a click to understand.
- **Theme tokens only**: `--fg --muted --faint --bg --surface --surface-2 --line --accent --accent-ink --on-accent --accent-soft` and the type and spacing tokens (`--t-body`, `--t-card`, `--t-gap`, `--radius`, …). No hard-coded colours or fonts, so all 23 themes and both modes work for free.
- **Accessibility**: real buttons, `aria-*` where state changes, a visible focus style, text contrast of at least 4.5:1, touch targets of at least 24px (aim for 32px or more), and `prefers-reduced-motion` respected.
- **Weight**: no new runtime dependency unless it is lazy-loaded only by decks that use it, like Mermaid and KaTeX in `load()`. Keep the code proportional to the idea.

## 4. Docs and gallery

- `gallery.html`: add a slide with `id: w-<slug>`, a short heading and a realistic example, plus a `::: notes` sentence. The QA step targets this slide.
- `skills/talkdown/SKILL.md`: one bullet under Widgets with the syntax and options, in the same terse style. This is what agents read, so keep it accurate and short.
- `README.md` Widgets section: one line or a small example. `llms.txt` only if it lists widgets by name.
- `index.html` (the demo) only for a flagship feature. Do not grow the demo for every widget.

## 5. QA: run it, look at it, fix it, repeat

```sh
npm run build && npm test && npm run test:browser
npm run qa                                                         # every gallery and demo slide: must stay at 0 failures
node scripts/qa.cjs --slide w-<slug> --selector .w-<slug> --name "<Component name>" [--steps N]
```

`--slide` checks the slide in six representative themes, light and dark, on desktop, laptop, iPad in both orientations and three phone sizes, in present and read views. It checks contrast, clipping, overflow, touch targets, focus and step count, and writes screenshots plus `preview.png` to `playwright-output/qa/w-<slug>/`. Add `--themes all` before merging anything colour-heavy.

The script catches measurable problems. Then **open `preview.png` and the screenshots and judge them like a designer**:

- Spacing balanced, edges aligned with the slide's text column, nothing cramped or floating.
- It looks native in every theme shown, light and dark, with no off-theme colour.
- Phone and article views read naturally, not like a squeezed slide.
- First step and last step both make sense.
- It looks like it belongs next to the existing widgets: plain, no gimmicks.

Fix and re-run until the script reports 0 failures and the screenshots are something you would show off. Warnings are fine when you understand them.

## 6. Pull request

```sh
git add -A && git commit                                           # "Add <component>: <one line>"; body says what and why
git push -u origin component/<slug>
```

Previews go on the `previews` branch, never in `main`:

```sh
git clone --depth 1 --branch previews https://github.com/sambhav/talkdown /tmp/previews   # once; afterwards git -C /tmp/previews pull
mkdir -p /tmp/previews/component-<slug>
cp playwright-output/qa/w-<slug>/{preview.png,step-first.png,step-last.png} /tmp/previews/component-<slug>/
git -C /tmp/previews add -A && git -C /tmp/previews commit -m "Previews for component/<slug>" && git -C /tmp/previews push
# link images as https://raw.githubusercontent.com/sambhav/talkdown/<previews commit sha>/component-<slug>/preview.png
```

PR body, plainly worded:

````md
Adds `::: <name>`: <what it is for, one sentence>. Closes #N.

### Usage
```md
<the smallest real example>
```
<one sentence on what it renders to>

| Option | Default | Meaning |   (only if it has options)

**Presenting:** <what ↓ does>. **Article:** <how it reads>.

![Preview: desktop, iPad and phone, light and dark themes](…/preview.png)

### Notes
<syntax changes from the issue and why; anything left for later>

Validation: unit tests, browser suite, `npm run qa` (0 failures), `qa.cjs --slide w-<slug>` (0 failures).
````

## 7. Review, CI, merge

1. **Independent review**: have a fresh agent with no context review `git diff origin/main...` for correctness bugs, syntax edge cases (empty input, nesting, code fences inside), read-view behaviour and theme-token use. Fix what is real.
2. **CI**: `GH_HOST=github.com gh pr checks <pr> -R sambhav/talkdown --watch`. On failure, read `gh run view <run-id> --log-failed`, fix, push, and watch again.
3. **Review comments**: read `gh api repos/sambhav/talkdown/pulls/<pr>/comments` and `…/reviews`. Address each comment, reply saying what changed, and resolve it.
4. **Main moved**: `git fetch origin && git rebase origin/main`, resolve conflicts while keeping both sides' intent, rebuild, re-run the tests and `npm run qa`, then `git push --force-with-lease`.
5. **Merge** when CI is green, no comments are unresolved and QA is clean: `GH_HOST=github.com gh pr merge <pr> -R sambhav/talkdown --squash --delete-branch`.
6. In the tracking issue (#37), tick the box: edit the body and change `- [ ] #N` to `- [x] #N`.

If the component turns out to be a bad fit (it needs a heavy dependency, duplicates an existing widget, or the syntax cannot be made clean), do not force it. Comment on the issue with what you found and a recommendation, leave it open, and report back.

## 8. Report

Return the PR URL, the merge commit, the final syntax in one line, and anything skipped or deferred.
