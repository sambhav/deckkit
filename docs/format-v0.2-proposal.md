# v0.2 proposal: single-file decks, structured widgets, reusable data

Status: design proposal and development spike. The new chart syntax, CSV loading,
standalone export, and parser migration described here are not shipped features.
The current rendering fixes and optional external Markdown loader remain in PR #1.

## Product contract

The primary workflow remains **write one `index.html`, link one script and one
stylesheet, and open it**. Authors and agents do not need npm, a bundler, a server,
an external Markdown file, or a conversion step. Keep hand-written HTML slides,
embedded Markdown, mixed decks, and the `Deck` extension API.

External Markdown is an alternative for authors who prefer it, not the new default.
This supersedes the earlier suggestion to make separate `.md` files the default.
Only external-file loading needs HTTP; embedded Markdown must continue to work
from `file://` with local JS and CSS.

Distinguish two useful meanings of single-file:

| Delivery | What the author shares | Requirements |
| --- | --- | --- |
| Linked HTML (default) | One authored HTML file containing its content and custom JS | One script and one stylesheet URL, or local copies of those assets. No author build. CDN links need a network connection. |
| Standalone HTML (optional export) | One physical HTML file containing content, runtime, CSS, and packaged assets | No network for packaged features. Use system fonts or embed permitted fonts; embed or pre-render optional libraries and diagrams. Report unresolved remote assets. |
| Separate source (optional) | HTML wrapper plus `.md` and/or `.csv` files | HTTP and normal fetch/CORS rules. Useful during editing, never required for the default path. |

The initial release should preserve linked HTML first. Standalone export is a
separate, testable capability; it should not delay or complicate opening an HTML
deck directly. Authors should not manually base64-encode content or JSON-escape
the whole deck. The existing `<\/script>` convention remains available in embedded
Markdown; an exporter should serialize embedded source safely for the author.

## One dataset, multiple views

A chart should own a dataset, not consume and visually discard its only table.
The same normalized rows should drive the plot, the table, and CSV download.
Accept either a Markdown table or a fenced CSV block inside the widget:

````md
::: chart type=line view=both title="Median latency (ms)"
```csv
Quarter,Before,After
Q1,180,90
Q2,160,80
Q3,140,70
```
:::
````

This entire block can live inside the existing `text/markdown` script in
`index.html`. It needs no external CSV, fetch request, or extra authoring step.

The equivalent small-table input is:

```md
::: chart type=line view=both title="Median latency (ms)"
| Quarter | Before | After |
|---------|--------|-------|
| Q1      | 180    | 90    |
| Q2      | 160    | 80    |
| Q3      | 140    | 70    |
:::
```

Use exactly one source per widget. External CSV can later use
`::: chart src="latency.csv" type=line view=both`, with the same dataset model.
Inline data takes priority as the first implementation target. Supplying both
`src` and inline data should be an error rather than an undocumented precedence.

| Option | Behavior |
| --- | --- |
| `view=chart` | Plot with an accessible **View data** action |
| `view=table` | Data table with a **View chart** action |
| `view=both` | Plot and table together, without duplicating source data |
| Omitted `view` | Plot first when presenting; plot and table in read view |
| `type=bar\|hbar\|line\|donut` | Explicit plot type, using the existing chart types |

Explicit `view=both` is honored in both modes. Desktop presentation can place plot
and table side by side; phone/read view stacks them. Large tables scroll locally
on a phone. Opening data from a plot-only presentation should use a focused dialog
or an explicit view switch, rather than silently growing a fixed slide past its
stage. Print/export should contain complete data when requested and finish builds.

Use a real table with a caption and header associations. Keep controls keyboard
operable, label the plot, and avoid making color the only series identifier. An
accessible data action remains available even when the table is not initially
visible. Data downloads are generated locally from the same rows.

## CSV contract

Use a tested CSV decoder such as Papa Parse, configured for comma-separated
strings with dynamic typing disabled. Parse text first, then validate the chart
schema explicitly. Do not use `split(',')`, Markdown rendering, or typographic
substitutions on CSV payloads.

- Support quoted commas, doubled quotes, quoted newlines, UTF-8/BOM, LF and CRLF.
- Require a header row and consistent column counts. Diagnose blank or duplicate
  headers instead of silently renaming them.
- For the first version, column one is a label; remaining columns are numeric
  series. Keep original strings as well as parsed numeric values so table labels,
  leading zeros, and downloadable data are preserved.
- Accept documented decimal/scientific notation. Keep display units in the
  caption/options; do not infer `1.2k`, `25%`, or `£100` by stripping characters.
- Missing or invalid values must not silently become zero. Show the table/source
  with a clear row/column diagnostic when the chart cannot be rendered.
- Bar/line charts need signed-axis support before accepting negatives. Donuts
  reject negatives and require one explicitly selected series when there are
  multiple numeric columns. Do not silently discard additional series.
- Put row/cell limits on rendering and offer the full data through download.
  Slides are not a replacement for a large-data spreadsheet viewer.

CSV cells are data, not executable HTML or JavaScript. Escape them when rendering
DOM. Define spreadsheet-safe download behavior for formula-like text without
mutating the dataset or turning actual negative numeric values into strings.

RFC 4180 describes the common quoting rules. Papa Parse documents string parsing,
parse errors, explicit typing, and CSV output:

- <https://www.rfc-editor.org/info/rfc4180/>
- <https://www.papaparse.com/docs>

## Keep HTML as a first-class authoring surface

Markdown should compile to the same widget DOM that an HTML author can write.
For example, the proposed HTML equivalent can use a native table:

```html
<section class="slide flow">
  <div class="content">
    <h2>Latency fell by half</h2>
    <figure data-chart="line" data-chart-view="both">
      <figcaption>Median latency (ms)</figcaption>
      <table>
        <thead><tr><th scope="col">Quarter</th><th scope="col">Before</th><th scope="col">After</th></tr></thead>
        <tbody><tr><th scope="row">Q1</th><td>180</td><td>90</td></tr></tbody>
      </table>
    </figure>
  </div>
</section>
```

This uses ordinary HTML; it does not introduce a second mandatory data language.
The widget enhancer should read the same dataset and mount the same component.
Preserve the table as a useful fallback before JavaScript runs. Custom HTML/JS
remains supported for trusted, author-written decks.

## Parser recommendation

Use **markdown-it plus a small talkdown extension layer**. Its configurable block
and inline rules, tokens, and source line maps fit containers, diagnostics, and
safe preservation of fenced data. Marked is also extensible; markdown-it is the
preferred starting point for this project, not a claimed size/performance winner.

The pipeline should be:

1. Read embedded Markdown, optional external Markdown, or native HTML slides.
2. Tokenize Markdown with explicit talkdown marker rules. Fenced code, HTML
   blocks, and CSV remain opaque tokens; never split the raw source on delimiters.
3. Group and validate slide/widget tokens into a small document model, retaining
   source ranges. Validate quoted options and unknown options/names here.
4. Render semantic HTML, then mount widgets with the existing step/read APIs.

Register opening and closing `:::` lines as tokens and group them afterward.
Do not find container endings using another raw-text regex scan. The development
spike demonstrates that this preserves widget markers inside code and comments.
Make widget names explicit; retain a `::: div class="..."` escape hatch for custom
containers rather than turning misspelled built-ins into unexplained CSS classes.

Keep `::: notes`, `::: say`, and `::: read` as the preferred explicit note blocks.
Support the current comment-based notes through a v0.1 input adapter. Likewise,
translate legacy table attributes such as `{.chart .line}` into the same widget
model. Keep one renderer and one stepper implementation.

The exact top-level slide/frontmatter grammar still needs compatibility fixtures.
The intent is to retain `---` as a reserved top-level slide boundary, recognize it
only outside code/comments/widgets, and specify metadata unambiguously. Do not
claim every CommonMark feature if a talkdown delimiter intentionally overrides it.
In particular, table pipe behavior must be tested against existing decks before
switching to standard table rules.

Bundle the pinned tokenizer into the published `deck.js`. Do not require another
script tag, dynamic import, runtime parser fetch, worker, `type="module"`, or
generated per-deck files. Maintainers may use a reproducible release build;
authors and agents consume committed/released artifacts and never run that build.

Sources:

- <https://markdown-it.github.io/markdown-it/>
- <https://github.com/markdown-it/markdown-it/blob/master/docs/usage.md>
- <https://marked.js.org/using_pro>

## Feasibility checks completed

`experiments/tokenizer-spike.cjs` tests a pinned markdown-it 15.0.3 installation in
a scratch dependency directory. Eight assertions pass: directive markers,
unchanged quoted/multiline CSV content, fence source ranges, markers inside code,
markers inside HTML comments, nested markers, and standard inline parsing cases.
The output reports eight assertions; it is not a full talkdown compiler.

The package's unmodified minified browser bundle measured 100,786 bytes, or 41,362
bytes with Node's default gzip. This is the tokenizer alone, not the final runtime
or the incremental cost after deleting the old parser. Measure the final artifact
before setting a release budget.

The single-file browser check passed for the current starter with:

- `file://` navigation, one classic script, and one linked stylesheet;
- network disabled and optional web fonts disabled;
- all four slides, arrow navigation, tabs, notes, and read view;
- no page errors or remote requests.

The same test passed with the candidate's self-contained browser bundle prepended
to `deck.js`. This checks packaging coexistence only; the legacy parser still
rendered the deck. Connected Chromium served file-protocol resources from
in-memory fixtures. The committed `tests/single-file.cjs` runner writes actual
temporary files when run locally with Playwright.

CI also runs this actual-file test in a separate browser job. Playwright is a
development test dependency installed only for that job; it adds no author build
step or runtime dependency.

## Implementation order and release gates

1. Keep PR #1 focused on the current rendering/parser fixes and regression checks.
   This proposal and spike are review material; they do not change the runtime.
2. Implement the normalized chart dataset, validated CSV input, semantic table,
   `view` behavior, and download once. Make it usable from native HTML first.
3. Move Markdown through the tokenizer and adapter into that same widget model.
   Add explicit containers/options/notes without duplicating the runtime.
4. Add optional standalone export with per-deck offline verification. Keep the
   linked-HTML workflow working throughout.

Before a parser migration can ship, the existing `index.html`, starter, mixed
HTML/Markdown decks, `Deck.markdown`, source copy, steppers, notes, deep links,
themes, and read/present modes must pass. Test the one-script/one-stylesheet
wrapper from both HTTP and `file://`, including mobile read view. Do not make
external Markdown, CSV fetching, or author build tooling a hidden prerequisite.

Before charts can ship, both input forms must produce the same data and plots;
test CSV quoting/empty cells/errors, all three view options, source inspection,
keyboard/screen-reader access, print, and desktop/phone layouts. Migration and
performance checks should operate on the existing full demo deck as well as
small grammar fixtures.
