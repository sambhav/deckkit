---
name: talkdown
description: Use when creating or editing slide decks, presentations or talks; writes a single-file talkdown deck (Markdown in an HTML page) that presents as slides and reads as an article.
---

# talkdown

By default, deliver one `.html` file: a boilerplate plus Markdown in a `<script type="text/markdown">` block. It opens as slides on desktop and mobile. Use the phone's floating Previous/Next buttons for steps, then slides. Do not add inline navigation bars to code or terminal examples. Open its menu for **Slides / Article**, or **R** on desktop, to switch at the current section. Shared speaker notes become article prose. Share `?view=read#section-id` for a direct article link; use `<html data-view="read">` or `<html data-view="present">` when the author wants to override the device default. Write Markdown, not hand-built HTML: it is shorter, and a human can tweak it by hand.

## File boilerplate

```html
<!DOCTYPE html>
<html lang="en" data-theme="clean">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Deck title</title>
<script src="https://sambhav.dev/talkdown/latest.js"></script>
</head>
<body>
<script type="text/markdown">
...slides...
</script>
</body>
</html>
```

Inside the Markdown block write `<\/script>` for a literal closing script tag. Open the file in a browser; refresh to preview. Self-hosting: download `https://sambhav.dev/talkdown/deck.css` and `deck.js` and put them beside the file.

To keep content in a separate file, use `<script type="text/markdown" data-src="talk.md"></script>` and serve it over HTTP. Keep inline Markdown as the default for a single-file deliverable; it also works from disk with local runtime assets. Prefer a referenced `.md` file for code-heavy or frequently edited source when HTTP serving is available. References and inline/HTML slides can be mixed in document order. Resolve media paths relative to the HTML wrapper.

## Recommended defaults

- Load the runtime with `latest.js` as in the boilerplate: it always loads the current release. Wrap custom JavaScript in `Talkdown.onReady(Deck => { ... })` because loading is asynchronous. For offline decks link local `deck.js` and `deck.css`; to freeze a deck, link the exact pair named in a release's `latest.json`.
- Write notes in `::: notes`, `::: say` and `::: read` blocks. Keep shared notes as readable prose and keep delivery cues out of the article.
- Use `::: chart` with one dataset. Choose a Markdown table for small hand-edited data; choose fenced CSV for spreadsheet exports, quoted commas, or multiline cells.
- Omit chart `view` or use `view=auto` for plot-on-stage and plot-plus-table-in-article. Use `view=both` only when exact values belong on the slide and fit comfortably.
- Use bar/hbar for categories, line for ordered trends, and donut for shares of one nonnegative series. Put units in the caption and keep numeric cells plain. Set `series="Column"` when selecting a donut series.
- Keep single-file authoring distinct from offline packaging: CDN assets and optional fonts/diagrams/media need a connection or local/self-hosted copies.

## Slides

`---` starts a new slide. `key: value` lines between two `---` are that slide's frontmatter (the first slide's frontmatter may come before its first `---`).

```md
layout: title
---
# Talk title

One-sentence subtitle.

Name · Date {.meta}

---
section: Results
kicker: Latency
build: true
---
## Latency fell by half

- p50: 180 ms to 90 ms
- p99: 1.2 s to 480 ms
```

Frontmatter keys:

| Key | Meaning |
|---|---|
| `layout` | `title`, `section`, `statement`, `center`, `image` (with `image: url`, text over a full-bleed picture), `default` |
| `section` | Label in the top bar; carries forward until changed. A `layout: section` slide sets it from its heading |
| `name` | Name in the overview (default: first heading) |
| `kicker` | Small label above the heading |
| `build` | `true`: each block and list item appears one step at a time |
| `class` / `id` | Extra classes / deep-link name (`#id`, and `[text](#id)` links) |
| `takeaway` | One line shown above the speaker notes |
| `image` | Background picture |
| `read` | `hide` (not in the article) or `text` (only its notes) |
| `present` | `hide` (article-only slide) |

Other syntax: `|||` starts a column (text before the first one spans the slide); `::: name` ... `:::` wraps blocks in `<div class="name">` (`::: card`, `::: grid`); `{.step}` at the end of a block reveals it on a step; `{.class #id}` styles a block (alone on a line it applies to the block above); `==text==` is accent-coloured.

```md
## Before and after

|||
### Before
- Manual deploys
|||
### After
- One command
```

## Speaker notes and the two formats

- `::: notes` ... `:::` is shared presenter notes and article prose.
- `::: say` ... `:::` is speaker-only; `::: read` ... `:::` is article-only.
- `::: present-only` / `::: read-only` wrap visible slide content for one view. They do not replace note blocks.

```md
::: notes
The cache moved closer to users, reducing round trips.
:::

::: say
Pause for questions.
:::
```

Notes can span lines. Timing cues like `[~60s]` are dropped from the article. Controls: ← → slides, ↑ ↓ steps then slides, **N** notes, **R** read/present, **O** overview, **T** light/dark, **P** presenter view, **S** shows the Markdown source of the current slide, **?** all keys.

## Widgets (plain Markdown)

Stateful widgets step with ↓ and expand in the article; charts follow their `view` setting.

- Image hotspots: `::: hotspots` around one `![Alt text](image.png)` followed by `- [12%, 30%] Label` bullets. Coordinates are x from the left and y from the top, each 0–100%. No options; labels accept inline formatting and links. The first pin starts selected; ↓ or a pin button selects the next label. Article view shows the image with all pins and a numbered legend.

- Quadrant: `::: quadrant x="Effort" y="Impact"`, four consecutive `###` headings in top-left, top-right, bottom-left, bottom-right order, then optional `- Label [0.2, 0.8]` points. Coordinates range from 0 to 1, increasing right/up; 0.5 belongs to the right/top. ↓ reveals points (or quadrants when empty). Article shows the full matrix and points grouped by quadrant. Keep labels short and use a few points per slide. Axis labels default to X/Y; no other options.

- Chat: `::: chat` with `**user:** Text`, `**assistant:** Text`, `**system:** Text` or ``**tool** `command` → result`` on separate lines. Blank lines, lists and fences continue the preceding message. ↓ reveals one message per step; articles show all messages with expandable tool calls. Keep slide transcripts short. No options.
- Board: `::: board`, a `### Column` heading per column and a Markdown list per column (each top-level item is a card). ↓ reveals each column; article view shows every card, stacking columns on phones. Keep slides to 2–4 short columns; use a new slide for more. No options.

- Flow / stack: `::: flow` or `::: stack` around a bulleted list, one box per item. `::: flow vertical` points down. Slide frontmatter `build: true` reveals every box on ↓; `{.step}` marks individual items. Article view shows all boxes; narrow screens stack flows vertically. No options besides `flow vertical`.
- Tabs: `::: tabs` then a `### Heading` per tab. `::: toggle`, `::: steps` (walkthrough), `::: accordion`, `::: timeline`, `::: features` (cards) use the same shape.
```md
::: tabs
### Present
The stage.
### Read
The article.
:::
```
- Explained table: `{.explain}` on the line after a table; the last column is the detail for the selected row. Cells starting `✓ ◐ ✗` become marks.
- Chart: `::: chart` around a table or a ` ```csv ` block; column one = labels, other columns = plain numbers (units go in `title`). Options: `type=bar|hbar|line|donut` (or one of the native SVG types below), `view=auto|chart|table|both`, `title="…"`, `series="Column"` (donuts need one series). Readers can inspect the data, download CSV and click a chart to open it full screen; never duplicate the dataset to make a separate table.
````md
::: chart type=line title="Users per quarter"
```csv
Quarter,Users
Q1,120
Q2,340
```
:::
````
- Stepped code: ` ```python {steps: 1-2 | 3} ` highlights those lines, one group per step.
- Annotated code: ` ```python {annotate} ` with a `# (1)` (or `// (1)`, `-- (1)`, `/* (1) */`, `<!-- (1) -->`) comment ending a line, then a `1.` `2.` list right after the fence, one item per number. Pins replace the comments; each step lights one line and its note; the article puts the notes beside the code (below it on phones).
- Diff: a ` ```diff ` fence of `+`/`-`/` ` lines, tinted green and red; `@@ label` starts a hunk. Options: `{steps: hunks}` highlights one hunk per step (or `{steps: 1-2 | 3}` by line), `title="api.py"` (default: the `+++` file name), `view=split` for old beside new on the slide (unified on phones and in the article). Copy takes the new code.
- API endpoint: `::: endpoint GET /v1/users/{id}` around any Markdown description and parameter table. Use an uppercase HTTP method and a slash-prefixed path; `{name}` highlights path parameters. No options. Both views show all content; the article path is a permalink. Use a `http` fence inside for a request/response example.
- HTTP exchange: a ` ```http ` fence with a request (`GET /users HTTP/1.1`), headers/body, a blank line, then the response (`HTTP/1.1 200 OK`) and its headers/body. No options. ↓ reveals the response; the article stacks both; each message has Copy.
- Glossary: `::: glossary` with plain `Term: Definition` lines (one per line, unique case-sensitive terms, no options). First whole-word use per slide gets a hover/focus/tap definition in articles; `glossary: inline` in slide frontmatter opts the stage in. Articles end with every definition expanded. Links, code and speaker-only notes are skipped.
- Speaker: `::: speaker` around an optional `![Portrait](photo.jpg)`, one `### Name`, role text and Markdown links. Links get icons; the article shows a compact author box.
- Link cards: `::: links` around a bulleted list of `- [Title](URL) Description` items. Shows title, domain and authored description; no options, no metadata requests. Use HTTP(S), relative URLs or `#section` links; descriptions can use inline emphasis/code but no additional links, HTML or images. Cards stack on phones.
- Stats: `::: stats` around `- **42%** faster first response`.
- Callout: `> [!NOTE]`, `[!TIP]`, `[!WARNING]`, `[!IMPORTANT]`, `[!CAUTION]`.
- Pull quote: a `>` quote whose last line is `> — Name`.
- Image comparison: `::: compare` around exactly two `![Caption](image.png)` images, before then after. No options. Drag the divider or focus the range and use arrows / Home / End; ↓ reveals 0%, 50%, 100%. Articles show both images and captions side by side, stacked on phones. Use images with matching dimensions for an aligned wipe.
- Flip card: `::: flip`; the `###` is the front, the rest the back.
- Diagram: a ` ```mermaid ` fence (add `{source}` to show the text beside it). Readers can click it to open it full screen and zoom, so dense diagrams are fine.
- Device frames: `::: browser url="https://example.com/settings"`, `::: window title="Terminal"` or `::: phone` around an image, code or Markdown. URL/title are optional captions, not live embeds; full content expands in the article.
- Terminal: a ` ```terminal ` fence; each `$ cmd` line types out per step, then its output.
- Keyboard shortcuts: `[[Ctrl+Shift+P]]` or `[[Enter]]`; `Mod` becomes ⌘ on Apple platforms and Ctrl elsewhere. Use `Plus` for the + key. Inline keycaps stay visible in both views.
- Also: `- [x]` checklists, `text[^1]` + `[^1]: source` footnotes, `$x^2$` / `$$..$$` maths, `:rocket:` Lucide icons, `::: agenda` (links every section), `::: qr` (QR of the deck URL), `![](youtube-or-.mp4-link)` video, `![](demo.cast)` recording.

## Themes and mode

Set on `<html>`: `data-theme="rose"`. Themes: clean (default), paper, slate, ledger, noir, editorial, swiss, atelier, mocha, rose, sunset, chalk, clinic, forest, ocean, nord, solar, terminal, ai, blueprint, punk, volt, synth. Every theme has light and dark; decks open in the viewer's system mode, `data-mode="light"` or `"dark"` fixes the default. `data-theme-dark="clean"` is the theme for dark mode (T switches between the two). `data-theme-picker` adds a viewer picker. For a custom top bar (name plus links), put `<div id="bar"><div class="title">Name</div><a href="…">Link</a></div>` in the page. `?theme=rose&mode=light` in the URL overrides both.

## Rules for agents

1. One idea per slide; at most about 6 bullets, each a short line.
2. Put the explanation in `::: notes` blocks as full sentences. Use `::: say` for delivery cues and `::: read` for article-only detail.
3. Prefer Markdown widgets over raw HTML. Drop to hand-written HTML slides only when Markdown cannot express it. Keep native scrolling and browser gestures; do not add page-wide swipe or edge-tap navigation.
4. Do not add custom CSS or restyle; choose a theme instead, unless asked.
5. Start with a `layout: title` slide, use `layout: section` slides for chapters, end with a `layout: center` slide.
6. Keep the file small. To edit, change the Markdown in place; do not regenerate the whole deck.
7. Escape literal closing script tags as `<\/script>` in embedded Markdown. A referenced `.md` source does not need that HTML raw-text escape.
8. Check desktop present view, phone-width read view, notes, chart data/download, and source copying before delivery. Fix any error shown on a slide.

## Complete example

The Markdown that goes inside the boilerplate above:

```md
layout: title
---
# Why we moved to the edge

Latency, cost and what we learned.

Platform team · October 2026 {.meta}

::: notes
Welcome. This talk covers one migration: why we did it and what it bought us.
:::

---
layout: section
---
## The problem

::: notes
Everything started with a slow first page load.
:::

---
kicker: Symptom
---
## Pages loaded slowly

- p50 180 ms, p99 1.2 s
- Most time spent far from users
- Users on mobile hurt most

::: notes
Our origin sat in one region. Users on other continents paid for every round trip.
:::
::: say
Mention the support tickets here.
:::

---
section: Results
---
## Latency fell by half

::: chart title="Latency (ms)"
| Percentile | Before | After |
|---|---|---|
| p50 | 180 | 90 |
| p99 | 1200 | 480 |
:::

> [!TIP]
> The cache moved to the edge; nothing else changed.

::: read
The chart shows both percentiles, before and after the migration.
:::

---
## What we would do again

::: tabs
### Keep
Cache at the edge, measure p99.
### Change
Roll out region by region.
:::

---
layout: center
---
## Questions?
```


### Native SVG charts

Use `::: chart type=heatmap|scatter|bubble|waterfall|timeline|sankey|treemap|range` around one Markdown table or fenced CSV block. Keep units in headers/titles and numeric cells plain. These share `view=auto|chart|table|both`, `title`, and CSV export with the other charts. Dense plots scroll on phones; keep examples small and verify both views.

- Heatmap: first column labels rows, all others are numeric; cells show their values. `total="Score"` prints that column as totals on the right, outside the colour scale. A header like `Login (15%)` puts the bracketed part on a second line.
- Scatter/bubble: first column labels points; `x="Header" y="Header"` default to the second/third columns. Bubble requires `size="Header"` (defaults to fourth column); circle area encodes nonnegative size. No `group` option.
- Waterfall: label, value, optional `Kind` column (`change`, `total`, `subtotal`). Changes accumulate; total/subtotal sets the running total to the supplied absolute value.
- Timeline chart: label, required `Start`, optional `End`; valid `YYYY-MM-DD` dates. Missing End is a milestone. This differs from the heading-based `::: timeline` widget.
- Sankey: required `Source`, `Target`, `Value`; nonnegative acyclic flows, at least one positive value.
- Treemap: slash-separated paths in the first column, required `Value`; nonnegative with positive total. Never mix parent totals with child entries or repeat paths.
- Range: label, required `Min`, `Max`, optional `Median` inside the range.

Header names are case-sensitive. Limits: 1,000 rows, 20,000 cells; treemap path depth 32. Unsupported options and invalid data show an error. See the widget gallery for complete examples.
