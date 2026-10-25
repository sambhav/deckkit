---
name: talkdown
description: Use when creating or editing slide decks, presentations or talks; writes a single-file talkdown deck (Markdown in an HTML page) that presents as slides and reads as an article.
---

# talkdown

By default, deliver one `.html` file: a boilerplate plus Markdown in a `<script type="text/markdown">` block. It opens as slides on desktop and as a scrolling article on phones. Use the phone's visible Previous/Next buttons to move between entries or steps. Open its menu for **Slides / Article**, or **R** on desktop, to switch at the current section. Shared speaker notes become article prose. Share `?view=read#section-id` for a direct article link; use `<html data-view="read">` or `<html data-view="present">` when the author wants to override the device default. Write Markdown, not hand-built HTML: it is shorter, and a human can tweak it by hand.

## File boilerplate

```html
<!DOCTYPE html>
<html lang="en" data-theme="clean">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Deck title</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/sambhav/talkdown@main/deck.css">
<script src="https://cdn.jsdelivr.net/gh/sambhav/talkdown@main/deck.js"></script>
</head>
<body>
<script type="text/markdown">
...slides...
</script>
</body>
</html>
```

Inside the Markdown block write `<\/script>` for a literal closing script tag. Open the file in a browser; refresh to preview. Self-hosting: put `deck.css` and `deck.js` beside the file.

To keep content in a separate file, use `<script type="text/markdown" data-src="talk.md"></script>` and serve it over HTTP. Keep inline Markdown as the default for a single-file deliverable; it also works from disk with local runtime assets. Prefer a referenced `.md` file for code-heavy or frequently edited source when HTTP serving is available. References and inline/HTML slides can be mixed in document order. Resolve media paths relative to the HTML wrapper.

## Recommended defaults

- Use the two root asset URLs in the boilerplate; no author build or extra parser script is needed. For a published deck, pin both URLs to the same existing release tag or commit SHA; `@main` tracks changes.
- Prefer `::: notes`, `::: say`, and `::: read` blocks in new content. Keep shared notes as readable prose and keep delivery cues out of the article.
- Use `::: chart` with one dataset. Choose a Markdown table for small hand-edited data; choose fenced CSV for spreadsheet exports, quoted commas, or multiline cells.
- Omit chart `view` or use `view=auto` for plot-on-stage and plot-plus-table-in-article. Use `view=both` only when exact values belong on the slide and fit comfortably.
- Use bar/hbar for categories, line for ordered trends, and donut for shares of one nonnegative series. Put units in the caption and keep numeric cells plain. Set `series="Column"` when selecting a donut series.
- Keep ordinary `{.step}`, `{.explain}`, and `{.class #id}` attributes. They are not legacy syntax.
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
- Chart: `::: chart` around a table or a ` ```csv ` block; column one = labels, other columns = plain numbers (units go in `title`). Options: `type=bar|hbar|line|donut`, `view=auto|chart|table|both`, `title="…"`, `series="Column"` (donuts need one series). Readers can inspect the data and download CSV; never duplicate the dataset to make a separate table.
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
- Stats: `::: stats` around `- **42%** faster first response`.
- Callout: `> [!NOTE]`, `[!TIP]`, `[!WARNING]`, `[!IMPORTANT]`, `[!CAUTION]`.
- Pull quote: a `>` quote whose last line is `> — Name`.
- Flip card: `::: flip`; the `###` is the front, the rest the back.
- Diagram: a ` ```mermaid ` fence (add `{source}` to show the text beside it).
- Terminal: a ` ```terminal ` fence; each `$ cmd` line types out per step, then its output.
- Also: `- [x]` checklists, `text[^1]` + `[^1]: source` footnotes, `$x^2$` / `$$..$$` maths, `:rocket:` Lucide icons, `::: agenda` (links every section), `::: qr` (QR of the deck URL), `![](youtube-or-.mp4-link)` video, `![](demo.cast)` recording.

## Themes and mode

Set on `<html>`: `data-theme="rose"`. Themes: clean (default), paper, slate, ledger, noir, editorial, swiss, atelier, mocha, rose, sunset, chalk, clinic, forest, ocean, nord, solar, terminal, ai, blueprint, punk, volt, synth. Every theme has light and dark; decks open dark, `data-mode="light"` flips the default. `data-theme-picker` adds a viewer picker. `?theme=rose&mode=light` in the URL overrides both.

## Rules for agents

1. One idea per slide; at most about 6 bullets, each a short line.
2. Put the explanation in `::: notes` blocks as full sentences. Use `::: say` for delivery cues and `::: read` for article-only detail.
3. Prefer Markdown widgets over raw HTML. Drop to hand-written HTML slides only when Markdown cannot express it. Keep native scrolling and browser gestures; do not add page-wide swipe or edge-tap navigation.
4. Do not add custom CSS or restyle; choose a theme instead, unless asked.
5. Start with a `layout: title` slide, use `layout: section` slides for chapters, end with a `layout: center` slide.
6. Keep the file small. To edit, change the Markdown in place; do not regenerate the whole deck.
7. Escape literal closing script tags as `<\/script>` in embedded Markdown. A referenced `.md` source does not need that HTML raw-text escape.
8. Check desktop present view, phone-width read view, notes, chart data/download, and source copying before delivery. Fix visible diagnostics; do not switch to legacy charts to bypass numeric validation.

## Existing decks

Preserve comment notes (`<!-- ... -->`, including `say:` / `read:`) and `{.chart}` / `{.chart .line}` tables when maintaining old decks. These remain supported for compatibility, including legacy formatted numbers and first-series donuts. For newly written content, use note blocks and explicit `::: chart` containers with plain numeric data. Do not rewrite valid old decks solely to modernize their syntax.

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

