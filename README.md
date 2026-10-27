<div align="center">

<img src="docs/logo.svg" width="88" height="88" alt="">

# talkdown

**Interactive presentations in Markdown. Present as slides. Share as an article.**

Write Markdown or let an agent write it · themes and widgets built in · HTML and JavaScript when you need them

[**Live demo**](https://sambhav.dev/talkdown/) &nbsp;·&nbsp; [**Widget gallery**](https://sambhav.dev/talkdown/gallery.html) &nbsp;·&nbsp; [Quick start](#quick-start) &nbsp;·&nbsp; [For agents](#for-agents) &nbsp;·&nbsp; [Writing slides](#writing-slides) &nbsp;·&nbsp; [Widgets](#widgets) &nbsp;·&nbsp; [Themes](#themes) &nbsp;·&nbsp; [API](#api)

![version](https://img.shields.io/badge/version-0.4.0-F1B000?style=flat-square) ![status](https://img.shields.io/badge/status-pre--release-555?style=flat-square) ![license](https://img.shields.io/badge/license-MIT-3C9A5F?style=flat-square)

<br>

<img src="docs/hero.png" alt="A talkdown slide on a laptop, and the same deck as an article on a phone" width="900">

</div>

<br>

## Why talkdown

Agents have gotten really good at building slides, and I make more and more of my talks that way. The results are great: interactive, quick to build, pretty, easy to iterate on with the agent, and easy to host as a static page.

But every deck is a pile of generated HTML:

- **Only an agent can maintain it.** The markup, styling and navigation are regenerated for every talk.
- **No two decks look the same.** Each one, and often each slide, invents its own layout and spacing.
- **A small edit means digging through markup.** Fixing a word or a number by hand is harder than it should be.
- **Every change burns tokens.** Even a typo goes back through the agent.

I also wanted things slide apps don't do, and agents only do with a lot of prompting:

- **Slides that work as a blog post**, so the link I share after a talk carries the whole idea, not just the bullets.
- **Themes** that restyle the whole deck at once.
- **Widgets** for technical talks: terminals, tables, charts, code walkthroughs and diagrams.
- **No build step, and nothing to host but static files.**

So I built talkdown:

- **Write Markdown, get interactive slides.** The agent writes only the content, so it uses far fewer tokens, and talkdown supplies the layout, theme, keyboard controls and phone layout, so every deck is consistent. The source is small enough to edit by hand.
- **One link, two formats.** Present it as slides. Afterwards, readers skim the slides or switch to an article where your speaker notes become the prose.
- **Themes and widgets built in.** 23 themes, each light and dark, and widgets that are a few lines of Markdown each.
- **Escape hatches when Markdown runs out.** Inline HTML, hand-built slides with your own JavaScript, CSS tokens, different words for slides and article, a small API, and a pinned or self-hosted runtime. Drop down for one slide; the rest stays Markdown.
- **No build, static hosting.** One HTML file and one script tag. GitHub Pages, a bucket or an intranet share all work.

The [live demo](https://sambhav.dev/talkdown/) is itself a talkdown deck: the pitch above, then a live tour of every feature. **← →** move between slides, **↑ ↓** step through a slide, **S** shows a slide's Markdown, **R** switches to the article and **T** toggles light and dark. The [widget gallery](https://sambhav.dev/talkdown/gallery.html) shows every widget and chart type with its Markdown.

## Quick start

Create `talk.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Dynamic Tools</title>
  <script src="https://sambhav.dev/talkdown/latest.js"></script>
</head>
<body>
<script type="text/markdown">
layout: title
---
# Dynamic Tools

What happens when the tool you need arrives halfway through.

September 2026 · 15 minutes {.meta}

::: notes
These notes become the prose beneath this slide in the article.
:::

---
## One idea per slide

- Big type
- Short lines
- Press ↓ to step, → to move on
</script>
</body>
</html>
```

Open it in a browser and press →. That's the whole setup: one HTML file, one script tag, nothing to install. To publish, put the file anywhere that serves static files, like GitHub Pages or a bucket.

`latest.js` always loads the current release, so a published deck picks up fixes the next time someone opens it. To work offline or pin a version, see [Hosting and versions](#hosting-and-versions).

## For agents

Give your agent one URL and it learns the whole format:

```
https://sambhav.dev/talkdown/skills/talkdown/SKILL.md
```

The same file is on the CDN at `https://cdn.jsdelivr.net/gh/sambhav/talkdown@main/skills/talkdown/SKILL.md`, and [`llms.txt`](https://sambhav.dev/talkdown/llms.txt) is the short index for tools that look for one.

A prompt that works:

> Read https://sambhav.dev/talkdown/skills/talkdown/SKILL.md and make me a 10-slide talkdown deck about how our cache invalidation works. Put what you'd say in speaker notes so it also reads as an article.

**In Claude Code**, copy the [`skills/talkdown`](skills/talkdown) folder into `~/.claude/skills/` (or a project's `.claude/skills/`) and ask for a talkdown deck. It loads when needed.

## Writing slides

A deck is Markdown inside a `<script type="text/markdown">` block.

```md
---
kicker: Results
build: true
---
## Latency fell by half

|||

- p50: 180 ms → 90 ms
- p99: 1.2 s → 480 ms {.step}

|||

::: card
**What changed:** the cache moved to the edge.
:::

::: notes
p50 halved once the cache moved to the edge; p99 improved even more.
:::
```

| Syntax | Effect |
|---|---|
| `---` | Starts a new slide |
| `key: value` lines between two `---` | Settings for the next slide (see below) |
| `::: notes` … `:::` | Speaker notes, and the prose under the slide in the article |
| `::: say` … `:::` · `::: read` … `:::` | Only in speaker notes · only in the article |
| `\|\|\|` | Starts a column. Text before the first one spans the slide |
| `::: name` … `:::` | Wraps blocks in `<div class="name">`. Blocks nest. `::: grid` makes balanced rows |
| `{.step}` | Reveals that block on ↓ |
| `{.class #id}` | Adds a class or id. On its own line, applies to the block above |
| `==text==` | Accent-coloured text |
| `[text](#id)` | Links to the slide with that `id` |
| `::: present-only` · `::: read-only` | Content for the slides only, or the article only |

Inline HTML works anywhere. `---` always starts a new slide, so use `#` headings rather than underlined ones. Write notes as full sentences: they are what turns the deck into an article.

<details>
<summary><b>Frontmatter keys</b></summary>

<br>

| Key | Values |
|---|---|
| `layout` | `title`, `section`, `statement`, `center`, `image` or `default` |
| `section` | Shown in the top bar. It carries over until changed; a `section` slide sets it to its heading |
| `kicker` | A small label above the heading |
| `build` | `true` reveals each block after the heading, and each list item, one step at a time |
| `id` | A name for deep links (`#id`) and slide links (`[text](#id)`) |
| `class` | Extra classes on the slide |
| `name` | The slide's name in the overview. Defaults to its first heading |
| `takeaway` | One line shown above the speaker notes |
| `read` | `hide` leaves the slide out of the article. `text` shows only its prose in the article, not the slide |
| `present` | `hide` makes an article-only slide: skipped when presenting |
| `image` | A background picture. With `layout: image`, the text sits over it on a dark scrim |
| `glossary` | `inline` annotates glossary terms on the slide too, not only in the article |

</details>

### Slides and article

Presenting and reading want different things, so you can control each:

| Write | Presenting | Article |
|---|---|---|
| `::: notes` … `:::` | Speaker notes | Prose under the slide |
| `::: say` … `:::` | Speaker notes | Left out |
| `::: read` … `:::` | Left out | Prose under the slide |
| `::: present-only` … `:::` | Shown | Left out |
| `::: read-only` … `:::` | Left out | Shown |
| `read: hide` in frontmatter | Shown | The slide is left out |
| `read: text` in frontmatter | Shown | Only its prose, not the slide |
| `present: hide` in frontmatter | Skipped | Shown: an article-only section |

`{.present-only}` and `{.read-only}` do the same for a single block, and work in HTML slides too.

The article always shows a thin reading-progress bar at the top. Add `data-read-progress` to `<html>` (`<html data-read-progress>`) to also float a section list beside the text on screens 1480px wide or more: it lists the deck's sections (or each slide when there is one section), highlights the one being read and jumps on click. Slides are unchanged.

```md
---
read: text
---
## Cache hit rate

![chart](hit-rate.png)

::: say
Pause here and ask who has seen this graph.
:::

::: read
The hit rate rose from 61% to 94% once the cache moved to the edge.
:::
```

### One file or several

Markdown, chart data, hand-built slides and your own JavaScript can all live in one HTML file. Inside the Markdown block, write `<\/script>` for a literal closing script tag; **S → Copy** keeps that escape.

To keep the Markdown in its own file, reference it (the page then needs to be served over HTTP):

```html
<script type="text/markdown" data-src="talk.md"></script>
```

Image and recording paths are relative to the HTML file.

## Widgets

<img src="docs/widgets.png" alt="Tabs, a chart, stepped code and a Mermaid diagram" width="900">

Each widget is a few lines of Markdown. Interactive ones step with ↑ ↓ and show everything in the article. The [gallery](https://sambhav.dev/talkdown/gallery.html) has live examples, grouped the same way.

### Visual charts

| Widget | Write |
|---|---|
| **Charts** | `::: chart type=line` around a table or CSV block. Twelve types; see [Charts](#charts) |
| **Quadrant** | `::: quadrant x="Effort" y="Impact"`, four `###` headings (top-left, top-right, bottom-left, bottom-right), then optional `- Label [0.2, 0.8]` points on 0–1 axes. ↓ reveals points; the article groups them by quadrant |
| **Stats** | `::: stats` around a list like `- **42%** faster first response` |
| **Meter / counter** | `::: meter value=72 max=100 label="Migration done" unit=%` (empty block) or `[1.2M]{count}` in text. ↓ animates once; articles show final values. `max` defaults to 100 |
| **Magnitude** | `::: magnitude unit=s` around a table of label and positive number (`0.5e-9`, `150e-6`). Log-scale bars with readable ns/µs/ms/s labels; ↓ reveals rows, articles add the table |
| **Sparklines** | A code span like `spark:9,8,8,6,5,5` draws an inline trend in prose or tables |
| **Benchmark** | A ` ```bench unit=ms ` fence of `name  12.1 ± 0.4` lines (or hyperfine `--export-json`): ranked bars, whiskers and "N× slower" labels; `better=higher` for throughput. The article adds a table and CSV download |
| **Marks** | ✓ ◐ ✗ at the start of a cell become icons in the theme's green, accent and red |

### Interactive content

| Widget | Write |
|---|---|
| **Tabs** | `::: tabs`, then a `###` heading per tab. `::: toggle` is the same, styled as a switch |
| **Accordion** | `::: accordion`, then a `###` heading per item; ↓ opens them in turn |
| **Walkthrough** | `::: steps`, then a `###` heading per step. Adds a counter, progress dots and Next |
| **Flip cards** | `::: flip`: the `###` heading is the front, the rest is the back |
| **Before / after** | `::: compare` around two images with alt text; drag or use the range keys, ↓ reveals 0 / 50 / 100% |
| **Image hotspots** | `::: hotspots`, one image, then `- [12%, 30%] Label` bullets (x/y from left/top). ↓ walks numbered pins; the article shows the legend |
| **Quiz** | `::: quiz`: one `###` question, `- [ ]` choices and one `- [x]` answer, then optional explanation after a blank line. ↓ reveals the answer; nothing is stored or sent |
| **Explorable numbers** | `::: explorable` around prose with `[qps=1000]{range=100..10000 step=100}` and `{qps*40/1000}`. Sliders update the arithmetic in both views |
| **Glossary** | `::: glossary` with one `Term: Definition` per line. Articles annotate the first use per slide and end with the definitions; frontmatter `glossary: inline` annotates the slide too |
| **Explained table** | `{.explain}` after a table. The last column becomes the detail for the selected row |
| **Timer** | `::: timer 10m` around instructions. ↓ or Start begins; Pause and Reset control it. `30s` to `24h` |

### Code and diagrams

| Widget | Write |
|---|---|
| **Copy buttons** | Every code block gets a **Copy** button, shown on hover and always on touch screens |
| **Stepped code** | ` ```python {steps: 1-2 \| 3-4} ` lights up each group of lines in turn |
| **Annotated code** | ` ```python {annotate} ` turns `# (1)` comments into numbered pins, explained by the `1.` `2.` list after the block; ↓ walks them |
| **Code groups** | `::: code-group` around one fence per language makes language tabs. A pick switches every group in the deck and is remembered; ` ```js [Node.js] ` names a tab |
| **Terminal** | A ` ```terminal ` block: each `$ command` types out on ↓, and the lines after it are its output |
| **Recordings** | `![title](demo.cast)` plays an [asciinema](https://asciinema.org/) recording without the player. A file needs http; a ` ```cast ` block plays anywhere |
| **Logs** | ` ```log {steps: 3 \| 5-6} ` numbers log lines, dims timestamps and styles levels. ↓ highlights line groups; Copy keeps the raw log |
| **Diffs** | ` ```diff {steps: hunks} title="api.py" ` tints changes and highlights each `@@` hunk on ↓. `view=split` shows old beside new; **Copy** takes the new code |
| **HTTP exchange** | A ` ```http ` fence: request and headers, a blank line, then `HTTP/1.1 200 OK` and the response. ↓ reveals the response |
| **Bit layout** | A ` ```bitfield bits=32 ` fence with one `0-3 Version` (or `7 Flag`) line per field: packet headers, registers, structs. Rows wrap at `bits`; ↓ highlights each field; the article adds an offset and width table |
| **API endpoint** | `::: endpoint GET /v1/users/{id}` around a description and parameter table; path parameters are highlighted, with a permalink in the article |
| **Prompt / output** | `::: prompt model="any-model" temperature=0` (both optional), then `### Prompt` and `### Output`. Side by side on the stage; ↓ reveals the output |
| **Model comparison** | `::: versus` with 2-4 `### Model` headings, an optional leading `> prompt` quote and a final `### Verdict`. Equal columns on the stage; ↓ adds one at a time |
| **Chat transcript** | `::: chat` with lines starting `**user:**`, `**assistant:**`, `**system:**` or `**tool**`. ↓ reveals messages; tool calls expand |
| **Environment diff** | `::: envdiff` around a table: a key column plus two or more environments. Differing values are highlighted; ↓ or Differences only hides the rest |
| **Keyboard shortcuts** | `[[Ctrl+Shift+P]]` renders keycaps. `[[Mod+K]]` shows ⌘ on Apple platforms and Ctrl elsewhere; `Plus` is the + key |
| **Diagrams** | ` ```mermaid `: flowcharts, sequence, architecture, state and more. `{source}` shows the text beside it; click to zoom |
| **Flow / stack** | `::: flow` or `::: stack` around a list. `::: flow vertical` points down; `build: true` or `{.step}` reveals boxes on ↓ |
| **Device frames** | `::: browser url="https://example.com"`, `::: window title="Terminal"` or `::: phone` around an image, code or Markdown |
| **Maths** | `$x^2$` inline or a `$$ … $$` block, typeset by [KaTeX](https://katex.org/) |
| **Stepped equations** | `$$ {steps}`, TeX rows separated by `\\`, then `$$`. Align with `&`, explain with `\text{…}`; ↓ reveals one row at a time |
| **Array stepper** | ` ```array `: the first line is the data (`[1, 3, 5, 7]`), each later line one step of pointers (`lo=0 hi=3 mid=1`), and `*7` marks a found value. ↓ moves the pointers; the article is a table with one row per step |
| **Sequence diagram** | ` ```sequence ` with `Browser -> Server: Hello` lines; `-->` is a reply, `note: text` adds a note, `note over A,B: text` spans lifelines. ↓ draws the next message; articles add a numbered list |
| **Runnable JS** | ` ```js {run} ` is editable; **Run** (or ↓) shows `console` output from a sandboxed iframe with no page access, and the article keeps it |
| **Live preview** | `::: live` around ` ```html `, ` ```css ` and ` ```js ` fences: editors beside a sandboxed preview that redraws as you type, stacked in the article |

### Presentation components

| Widget | Write |
|---|---|
| **Feature cards** | `::: features`, then a `###` heading per card. An `:icon:` or image at the start of the heading becomes its icon. Up to three per row |
| **Speaker card** | `::: speaker` around an optional photo, one `### Name`, role and links. A compact author box in the article |
| **Timeline** | `::: timeline`, then a `###` heading per milestone. Vertical on phones |
| **Roadmap board** | `::: board`, then a `###` heading and list of cards per column. ↓ reveals columns; keep to 2–4 short columns |
| **Changelog** | `::: changelog`, `### v0.4.0 · 2026-10-25` per release, `#### Added` / `#### Fixed` labels. One release per step; give the slide an `id:` for stable links |
| **Link cards** | `::: links` around `- [Title](URL) Description` items: further-reading cards with the domain, no metadata requests |
| **Image gallery** | `::: gallery` around images; ↓ highlights each, click opens a lightbox with captions |
| **Citations** | `[@key]` in prose and a `::: references` list of `- key: Reference` lines. Citations number by first use as `[1]` links; hover shows the entry; `[@a; @b]` cites several |
| **Image slides** | `layout: image` and `image: path.jpg` in the frontmatter: a full-bleed picture with the text over it |
| **Video** | `![title](youtube, vimeo or .mp4 link)` embeds a player |
| **Callouts** | `> [!NOTE]`, `[!TIP]`, `[!WARNING]`, `[!IMPORTANT]`, `[!CAUTION]` |
| **Pull quotes** | A `>` quote whose last line starts with `—` becomes a large quote with that attribution |
| **Checklists** | `- [x] done` and `- [ ] to do` |
| **Footnotes** | `text[^1]` and a `[^1]: source` line anywhere on the slide; set small at its foot |
| **Sidenotes** | `text.[>a margin note]` inline: a numbered mark that opens a popover; in the article, a note in the margin beside the line on wide screens, a tap-to-open note on phones |
| **Icons** | `:rocket:` anywhere: any [Lucide](https://lucide.dev/icons) icon, in the theme's colours |
| **Emphasis marks** | `[closer to users]{.circle .step}`: a hand-drawn `.underline`, `.circle`, `.box`, `.highlight`, `.strike` or `.bracket` around a phrase. `.step` draws it in on ↓; articles show it drawn |
| **Agenda** | An empty `::: agenda` lists every section slide, each linking to it |
| **Audience questions** | `::: ask url="https://example.com/questions"` (empty block): a large QR on the slide, a link in the article |
| **QR code** | `::: qr` draws a QR code of the deck's link, or of a URL written inside it |

```md
::: tabs
### Present
The 16:9 stage, scaled to the screen.
### Read
One column. Notes become the prose.
:::
```

### Charts

A chart is one table or one CSV block. The first column holds the labels and the other columns hold numbers. The chart, its data table and the CSV download all come from that one source.

````md
::: chart type=line title="Median latency (ms)"
```csv
Quarter,Before,After
Q1,180,90
Q2,160,80
Q3,140,70
```
:::
````

Numbers must be plain: `42`, not `42%` or `1,200`. Put units in the title or column header. Invalid data shows an error on the slide rather than plotting wrong values.

| Type | Data |
|---|---|
| `bar` (default), `hbar`, `line` | Labels, then up to six numeric series. Negative values work |
| `donut` | One non-negative series; pick it with `series="Column"` if there are several |
| `heatmap` | Labels, then numeric columns, shown as coloured cells with their values. `total="Score"` prints a totals column on the right, outside the colour scale. A header like `Login (15%)` puts the bracketed part on a second line |
| `scatter`, `bubble` | Labels, then `x` and `y` columns (pick them with `x="…" y="…"`). Bubbles add `size="…"`, drawn as circle area |
| `waterfall` | Label, value and an optional `Kind` column: `change` (default), `subtotal` or `total` |
| `timeline` | Label, `Start` and optional `End` as `YYYY-MM-DD`. No end date makes a milestone |
| `sankey` | `Source`, `Target` and `Value` columns, with no cycles |
| `treemap` | Paths like `Compute/GPU` in the first column and a `Value` column |
| `range` | Label, `Min`, `Max` and an optional `Median` |

Options: `type`, `title="…"` and `view=auto|chart|table|both`. `auto` shows the chart on slides and the chart plus table in the article. Readers can switch views, download the CSV, and click a chart to open it full screen. Charts take up to 1,000 rows.

Native HTML uses the same component:

```html
<figure data-chart="line" data-chart-view="both">
  <figcaption>Median latency (ms)</figcaption>
  <table>
    <thead><tr><th>Quarter</th><th>Before</th><th>After</th></tr></thead>
    <tbody><tr><th>Q1</th><td>180</td><td>90</td></tr></tbody>
  </table>
</figure>
```

Place it inside a slide's `.content`. The native table remains useful before enhancement; `Deck.chart(element)` can enhance a chart added later by custom JavaScript.

<details>
<summary><b>Code highlighting, diagrams and maths</b></summary>

<br>

Fenced code is highlighted by [highlight.js](https://highlightjs.org/), [Mermaid](https://mermaid.js.org/) draws diagrams, and [KaTeX](https://katex.org/) typesets maths. Both use the theme's colours and fonts, and redraw when the theme or mode changes. Each library, and the QR code generator, and icons, is fetched from jsDelivr only if the deck needs it. To self-host one or turn it off:

```html
<html data-highlight="/vendor/highlight.min.js" data-diagrams="off" data-math="off">
```

With diagrams off, or offline, the Mermaid source is shown instead.

</details>

## Themes

<img src="docs/themes.png" alt="Twelve of the 23 themes, in light and dark" width="900">

Themes apply across slides and built-in components, including charts, code highlighting, callouts and diagrams. One attribute picks the look:

```html
<html lang="en" data-theme="rose">
```

| | |
|---|---|
| **Everyday** | `clean` (default) · `paper` · `slate` · `ledger` · `noir` ☾ |
| **Editorial & craft** | `editorial` · `swiss` · `atelier` · `mocha` |
| **Warm & friendly** | `rose` · `sunset` · `chalk` ☾ · `clinic` |
| **Nature & calm** | `forest` · `ocean` · `nord` ☾ |
| **Tech** | `solar` ☾ · `terminal` ☾ · `ai` ☾ · `blueprint` ☾ |
| **Loud** | `punk` · `volt` ☾ · `synth` ☾ |

Every theme is a light and dark pair; ☾ marks the ones designed dark first, and the picker shows the same mark. Decks open in the viewer's system light or dark mode; `<html data-mode="light">` or `"dark"` fixes the default. Viewers switch with **T**, and their choice is remembered.

- `?theme=rose` and `?mode=dark` in the URL override both. Handy for sharing.
- `<html data-theme="paper" data-theme-dark="clean">` opens in paper for light-mode viewers and clean for dark-mode ones, and **T** switches between them (until the viewer picks a theme).
- `<html data-theme-picker>` adds a picker to the top bar so viewers can choose.
- Typefaces load from Google Fonts for the active theme only. `<html data-fonts="off">` keeps system fonts.

<details>
<summary><b>Make your own</b></summary>

<br>

Every colour, typeface and size is a CSS custom property. Override them after `deck.css`:

```css
:root {
  --accent: #F1B000; --accent-soft: #FFF3CC; --on-accent: #161514; --accent-ink: #8D6700;
  --sans: "Space Grotesk", system-ui, sans-serif;
}
[data-mode=dark] { --accent: #FFC94D; --accent-ink: #F5C542; }
```

| Token | Use |
|---|---|
| `--bg` `--surface` `--surface-2` `--line` | Background, cards, insets, hairlines |
| `--fg` `--muted` | Text and secondary text |
| `--faint` | Decorative lines and dots, never text |
| `--accent` `--accent-soft` `--on-accent` | Accent, its tint, and text on an accent fill |
| `--accent-ink` | The accent as text: links, kickers, highlights |
| `--inv` `--on-inv` `--inv-muted` | Inverted blocks (`.card.inv`) and their text |
| `--red` `--green` `--blue` `--orange` | Status colours, used by callouts, marks and diagrams |
| `--mark-yes` `--mark-part` `--mark-no` | ✓ ◐ ✗ colours |
| `--chart-1` … `--chart-6` | Chart series colours. Default to the accent, then the theme's code and status colours |
| `--c-key` `--c-str` `--c-com` `--c-num` `--c-fn` `--c-type` `--c-tag` | Code highlighting |
| `--sans` `--display` `--mono` | Body, heading and mono typefaces |
| `--grid` | A colour draws a background grid; `transparent` turns it off |
| `--t-title` `--t-h2` `--t-body` … | The type scale. The article and phone slides redefine it |

</details>

## Presenting

| Key | |
|---|---|
| `←` `→` `Space` | Previous / next slide |
| `↑` `↓` `Enter` | Previous / next step, then on to the next slide |
| `1`–`9` | Jump to a step on this slide |
| `R` | Article ⇄ slides |
| `T` | Light ⇄ dark |
| `O` · `N` · `F` · `?` | Overview · speaker notes · fullscreen · all keys |
| `P` | Presenter view: a second window with the next slide, your notes and a timer, kept in step with the audience screen |
| `L` · `D` | Laser pointer · draw on the slide (cleared on the next slide) |
| `S` | Show the current slide's Markdown (view source) |
| Click a diagram or chart | Open it full screen: scroll or pinch to zoom, drag to move, hover for values, `Esc` to close |
| Click a link to a slide | Jumps there; the browser's Back button returns to the slide you were on |

On a phone the deck opens as slides, with **Previous**, **Next** and **Menu** buttons near the bottom. The arrows move through steps, then slides. The menu switches between **Slides** and **Article**, goes **Home**, and jumps to any section or slide. Switching views keeps your place, and normal scrolling, zoom and back gestures keep working.

## Reading

<img src="docs/phones.png" alt="Three phones: a vertical slide, a walkthrough, and the article view" width="760">

Press **R**, or choose **Article** in the phone menu, to read the deck as one column of text:

- Slides reflow into article typography, with a chapter label on each.
- **Notes become the prose.** Timing cues like `[~60s]` are dropped.
- Step-by-step builds and widgets show everything.
- Hand-built slides become figures with a **Present** button.

Share `?view=read` to open the article directly, or `?view=present` for slides; add a slide id like `#widgets` to jump to it. Set `<html data-view="read">` to make the article the default.

## HTML slides

When a slide needs something Markdown can't express, write it by hand, anywhere between Markdown blocks:

```html
<section class="slide" data-section="Architecture" data-name="The pipeline">
  <div class="content">
    <h2>How a request flows</h2>
    <div id="pipe">…</div>
    <button data-next></button>
  </div>
  <aside class="notes">What to say over this slide.</aside>
</section>

<script>
  Talkdown.onReady(Deck => {
    Deck.steps(document.getElementById('pipe'), 4, i => {
      // draw step i; ↑ ↓, the step counter and the URL all follow along
    }, { read: 'end' });   // show the last step in the article
  });
</script>
```

Add the class `flow` if the slide can reflow in the article; otherwise it appears there as a scaled figure. A slide can have several step sequences. `<div data-build>` with `[data-step]` children and `<button data-next>` work without any script.

### Your own top bar

The top bar shows `document.title`, the current section and the deck's buttons. To use your own name or add links, put a `#bar` anywhere in the page:

```html
<div id="bar">
  <div class="title">My talk</div>
  <a href="https://github.com/you/repo">GitHub</a>
</div>
```

Links show as small pills beside the title, and talkdown still adds the section label and buttons. There is no footer slot.

## API

| | |
|---|---|
| `Deck.steps(el, n, show, { read })` | Add `n` steps to a slide's ↑ ↓ navigation. `show(i)` renders step `i` |
| `Deck.tabs(container, onPick)` | Make each button in a container a step |
| `Deck.go(i, step?)` · `Deck.next()` · `Deck.prev()` | Move the deck |
| `Deck.cur` · `Deck.slide` · `Deck.slides` | Current index, current slide, all slides |
| `Deck.on('slide', (slide, i) => …)` | Runs when the slide changes |
| `Deck.on('ready', () => …)` | Runs once Markdown slides exist |
| `Deck.key('d', e => …)` | Bind a key |
| `Deck.setView('read' \| 'present')` | Switch views |
| `Deck.markdown(text)` | Render Markdown to HTML |
| `Deck.chart(element)` | Enhance a chart container added by custom JavaScript |
| `Deck.store.get(k, fallback)` · `.set(k, v)` | localStorage, namespaced `talkdown:` |
| `Deck.choice.get(group, options)` · `.set(group, v)` · `.on(group, f)` | A remembered pick shared by widgets, such as code groups' `'lang'` |

## Hosting and versions

- **Always current:** `<script src="https://sambhav.dev/talkdown/latest.js"></script>` checks for the latest release each time the page opens and loads it. Updates arrive on reload, never mid-talk. While it loads, readers see a spinner in their light or dark mode; if it can't load, they get an error with a Reload button. Your own scripts should wait for it with `Talkdown.onReady(Deck => { … })`.
- **Offline or self-hosted:** download [`deck.js`](https://sambhav.dev/talkdown/deck.js) and [`deck.css`](https://sambhav.dev/talkdown/deck.css), or take them from a [release](https://github.com/sambhav/talkdown/releases), and link them next to your HTML. [`examples/starter.html`](examples/starter.html) is a starting point.
- **Pinned:** each [release](https://github.com/sambhav/talkdown/releases) includes a `latest.json` naming an exact JavaScript and CSS pair with integrity hashes. Link that pair to freeze a deck on one version.
- **CDN:** the built files are on the `gh-pages` branch, e.g. `https://cdn.jsdelivr.net/gh/sambhav/talkdown@gh-pages/deck.js`. jsDelivr caches branch links for hours, so prefer `latest.js` or a pinned pair.

## Browser support

Current Chrome, Edge, Firefox and Safari, on desktop and mobile. Print from the browser for a PDF with one slide per page and every step shown.

## Contributing

The engine is `src/` (JavaScript) and `deck.css`. Run `npm ci`, then `npm run build` and `npm test`; for the browser suite (it drives your installed Google Chrome), run `npm run test:browser`. Don't commit `deck.js`, `latest.json` or `dist/`: they're built.

Releases are automatic. When the checks pass on `main`, CI adds the site and runtime to the `gh-pages` branch and deploys that tree to [sambhav.dev/talkdown](https://sambhav.dev/talkdown/). Older builds stay available there, so decks that loaded them keep working. Push a `vX.Y.Z` tag to also create a GitHub Release with the files attached.

talkdown is pre-release (0.4.0), so the syntax may still change before 1.0.

## License

[MIT](LICENSE) © Sambhav Kothari
