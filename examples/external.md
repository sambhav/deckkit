layout: title
---
# Write ordinary files

Keep the Markdown separate from its HTML wrapper.

<!-- Serve this example over HTTP, for example with python3 -m http.server. -->

---
## No script-tag escaping

```html
<script>console.log('hello');</script>
```

Use `` `backticks` `` inside code spans, and \*literal asterisks\* in prose.

<!-- The closing script tag above is safe because this is a Markdown file, not HTML raw text. -->
