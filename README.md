# deckkit

Slides you write in Markdown, present on a 16:9 stage, and send to a phone as an essay.

Two files, no dependencies, no build step. **[See the demo →](https://sambhav.dev/deckkit/)**

- **Write in Markdown.** `---` between slides, `<!-- comments -->` for speaker notes.
- **Present** with the keyboard: ← → for slides, ↑ ↓ for the steps within a slide. Swipe on touch screens.
- **Read** on a phone: the deck becomes one scrolling article and the speaker notes become its prose.
- **Light and dark**, from a handful of CSS tokens.
- **Drop to HTML** for any slide that needs a hand-built, interactive diagram.

## Start

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Dynamic Tools</title>
  <link rel="stylesheet" href="deck.css">
  <script src="deck.js"></script>
</head>
<body>
<script type="text/markdown">
layout: title
---
# Dynamic Tools

What happens when the tool you need arrives halfway through the conversation.

September 2026 · About 15 minutes {.meta}

<!-- Speaker notes go in comments. In read view they become the text under the slide. -->

---
## The next slide

- One idea per slide
- Big type
</script>
</body>
</html>
```

Open it in a browser. That's the setup.

## Writing slides

| Syntax | Effect |
|---|---|
| `---` on its own line | Starts a new slide |
| `key: value` lines between two `---` | Frontmatter for the next slide (see below) |
| `<!-- … -->` | Speaker notes |
| `\|\|\|` on its own line | Starts a column. Text before the first `\|\|\|` spans the slide |
| `::: card` … `:::` | Wraps blocks in `<div class="card">`. Any class works; containers nest. `::: grid` lays its children out in balanced rows |
| `{.step}` at the end of a block | Reveals that block on ↓ |
| `{.class #id}` at the end of a block | Adds a class or id |
| `==text==` | Accent-coloured text |

Everything else is ordinary Markdown: headings, paragraphs, **bold**, *italic*, `code`, links, images, lists, blockquotes, tables and fenced code. Inline HTML passes through.

### Frontmatter

```md
---
layout: section
section: Reading
build: true
---
```

| Key | Values |
|---|---|
| `layout` | `title`, `section`, `statement`, `center`, or `default` |
| `section` | Shown in the top bar. Carries over to the following slides until changed; a `section` layout slide sets it to its heading |
| `kicker` | A small mono label above the heading |
| `build` | `true` reveals each block after the heading, and each list item, one step at a time |
| `class` | Extra classes on the slide |
| `name` | The slide's name in the overview. Defaults to its first heading |
| `takeaway` | One line shown above the speaker notes |

## Presenting

| Key | |
|---|---|
| ← → · Space · PgUp PgDn | Previous / next slide |
| ↑ ↓ · Enter | Previous / next step. When a slide's steps run out, ↓ moves on to the next slide |
| 1–9 | Jump to a step on the current slide |
| R | Switch between presenting and reading |
| T | Light / dark |
| O | Overview of every slide |
| N | Speaker notes |
| F | Fullscreen |
| ? | Keyboard help |

Entering a slide shows its first step. Coming back to it from the next slide shows it finished. The URL tracks both: `#5` is slide five, `#5.3` is its third step.

## Reading

On a phone or a portrait tablet, deckkit opens in read view: one column, like a blog post. On a laptop, press R.

- Markdown slides reflow into article typography, each with a small chapter label.
- **Speaker notes become the prose** under each slide. Timing cues such as `[~60s]` are dropped.
- Builds show their finished state.
- Hand-built HTML slides can’t reflow, so they appear as figures scaled to the column, each with a **Present** button that opens it full-screen.
- Text sits in one centred column, about 70 characters wide, on a single type scale. On wide screens, hand-built slides break out into wider figures.

Presenting on a touch screen adds a dock with ‹ › and a button back to reading, at a size you can tap; swipe left and right to move through steps and slides. On a phone held upright, slides go vertical: a canvas the width of the phone, as tall as the content, with the notes underneath when it's short. Markdown slides always do this; an HTML slide does when it's marked `flow`, or when its content fits a narrow canvas without absolutely positioned parts (style it under `[data-tall]` to help it fit). Fixed 16:9 layouts stay horizontal. In landscape it fills the screen and the dock fades until you touch it.

Press R or use the button in the top bar to switch views. Force one with `?view=read` or `?view=present`.

## HTML slides

Write a slide by hand when it needs a custom diagram. It can sit before, between or after Markdown blocks:

```html
<script type="text/markdown"> … </script>

<section class="slide" data-section="Reading" data-name="The pipeline">
  <div class="content">
    <h2>A slide built by hand</h2>
    <div id="pipe">…</div>
    <button data-next></button>
  </div>
  <aside class="notes">What to say over this slide.</aside>
</section>

<script type="text/markdown"> … </script>
```

Content goes in `.content`, which leaves room for the top bar. Add the class `flow` if the slide's layout can reflow in read view; otherwise it is shown as a scaled figure.

### Steps

Any interaction can take part in ↑ ↓ navigation by registering a stepper:

```js
Deck.steps(element, 4, i => {
  // render step i, 0 = the initial state
}, { read: 'end' });   // optional: show the last step in read view
```

Built-in steppers:

- `<div data-build>` reveals its `[data-step="n"]` children in order, adding `.shown` and `.current`.
- `Deck.tabs(container, (i, button) => …)` makes each button in `container` a step.
- `<button data-next>` advances the slide's steps, wraps to the start at the end, and labels itself `Next →` or `Reset ↺`.

A slide can have several steppers. ↓ advances the first one that isn't finished.

### API

| | |
|---|---|
| `Deck.go(i, step?)` | Go to slide `i` (0-based), optionally at a step |
| `Deck.next()` / `Deck.prev()` | Next / previous step, falling through to slides |
| `Deck.cur`, `Deck.slide`, `Deck.slides` | Current index, current slide, all slides |
| `Deck.on('slide', (slide, i) => …)` | Runs when the current slide changes |
| `Deck.on('ready', () => …)` | Runs once Markdown slides exist, before the first slide shows |
| `Deck.key('d', e => …)` | Bind a key on the current deck |
| `Deck.setView('read' \| 'present')` | Switch views |
| `Deck.markdown(text)` | Render Markdown to HTML |

## Theming

Every colour is a CSS custom property. Override them after `deck.css`:

```css
:root {
  --accent: #F1B000; --accent-soft: #FFF3CC; --on-accent: #161514;
  --sans: "Space Grotesk", system-ui, sans-serif;
}
[data-theme=dark] { --accent: #FFC94D; }
```

| Token | Use |
|---|---|
| `--bg` `--surface` `--surface-2` `--line` | Slide background, cards, insets, hairlines |
| `--fg` `--muted` `--faint` | Text, from strongest to weakest |
| `--accent` `--accent-soft` `--on-accent` | Accent, its tint, and text on an accent fill |
| `--inv` `--on-inv` `--inv-muted` | An inverted block (`.card.inv`) and its text |
| `--red` `--green` `--blue` `--orange` | Status colours |
| `--sans` `--display` `--mono` | Body, heading and mono typefaces |
| `--grid` | Set to a colour to draw a background grid on slides |

For large headings, load Inter with its optical-size axis so big type uses the Display cut:

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400..700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

The theme follows the system setting until someone presses T; the choice is remembered. Force one with `?theme=dark`. Add `class="lineart"` to dark-on-transparent drawings to invert them in dark mode.

## Printing

Print from the browser to get a PDF with one slide per page, all builds shown.

## License

MIT
