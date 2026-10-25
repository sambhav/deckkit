// Native SVG charts share the original Markdown/CSV data with the table view.
export const visualTypes = ['heatmap', 'scatter', 'bubble', 'waterfall', 'timeline', 'sankey', 'treemap', 'range'];

export function visualChart(headers, rows, type, options = {}) {
  if (!visualTypes.includes(type)) throw Error('Unknown chart type: ' + type);
  const names = headers.map(x => String(x).trim());
  if (names.length < 2 || names.some(x => !x) || new Set(names).size !== names.length) throw Error('Column names must be unique and nonempty; at least two columns are required');
  if (!rows.length || rows.length > 1000 || rows.some(r => r.length !== names.length)) throw Error('Expected 1–1000 complete data rows');
  if (rows.length * names.length > 20000) throw Error('Visual charts support at most 20,000 cells');
  const supported = type === 'scatter' ? ['x', 'y'] : type === 'bubble' ? ['x', 'y', 'size'] : [];
  for (const key of ['x', 'y', 'size', 'group', 'series']) {
    if (options[key] !== undefined && !supported.includes(key)) throw Error('Unsupported ' + type + ' option: ' + key);
  }
  const column = (name, fallback) => {
    const i = name === undefined ? fallback : names.indexOf(name);
    if (i < 0 || i >= names.length) throw Error('Missing column: ' + (name ?? (fallback + 1)));
    return i;
  };
  // Optional semantic columns are selected by name, never an unrelated position.
  const optional = name => names.indexOf(name);
  const number = (row, i) => {
    const s = String(row[i] ?? '').trim();
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(s) || !Number.isFinite(+s)) throw Error('Invalid number in column ' + names[i] + ': ' + s);
    return +s;
  };
  const text = x => String(x ?? '').trim();
  const esc = x => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const fmt = v => Number(v.toPrecision(4)).toString();
  const label = (x, y, value, anchor = 'middle', max = 24) => {
    const s = String(value), chars = Array.from(s);
    const short = chars.length > max ? chars.slice(0, max - 1).join('') + '…' : s;
    return `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="currentColor" font-size="14"><title>${esc(s)}</title>${esc(short)}</text>`;
  };
  const rect = (x, y, w, h, color, tip) => `<rect x="${x}" y="${y}" width="${Math.max(0, w)}" height="${Math.max(0, h)}" rx="2" fill="${color}"><title>${esc(tip)}</title></rect>`;
  const line = (x1, y1, x2, y2, color = 'var(--line)') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}"/>`;
  const palette = ['var(--chart-1, var(--accent))', 'var(--chart-2, var(--blue))', 'var(--chart-3, var(--green))', 'var(--chart-4, var(--orange))', 'var(--chart-5, var(--red))', 'var(--chart-6, var(--muted))'];
  const extent = values => values.reduce(([lo, hi], v) => [Math.min(lo, v), Math.max(hi, v)], [Infinity, -Infinity]);
  const domain = (lo, hi) => {
    if (lo === hi) { const pad = Math.abs(lo) * .1 || 1; lo -= pad; hi += pad; }
    if (!Number.isFinite(hi - lo)) throw Error('Numeric range is too large to plot');
    return [lo, hi];
  };
  const scale = (lo, hi, a, b) => v => a + (v - lo) / (hi - lo) * (b - a);
  let out = '', width = 680, height = 340;
  const xAxis = (lo, hi, left, right, y, format = fmt) => {
    const px = scale(lo, hi, left, right);
    out += line(left, y, right, y, 'var(--muted)');
    for (let i = 0; i <= 4; i++) {
      const v = lo + (hi - lo) * i / 4, x = px(v);
      out += line(x, y, x, y + 5) + label(x, y + 23, format(v), 'middle', 16);
    }
  };
  const yAxis = (lo, hi, left, right, top, bottom) => {
    const py = scale(lo, hi, bottom, top);
    for (let i = 0; i <= 4; i++) {
      const v = lo + (hi - lo) * i / 4, y = py(v);
      out += line(left, y, right, y) + label(left - 10, y + 5, fmt(v), 'end', 12);
    }
  };

  if (type === 'heatmap') {
    const numeric = names.slice(1).map((_, i) => i + 1);
    const values = rows.flatMap(r => numeric.map(i => number(r, i)));
    const [lo, hi] = extent(values), ch = 34;
    const left = Math.min(160, Math.max(50, ...rows.map(r => Array.from(String(r[0])).length * 8 + 14)));
    const cw = Math.min(128, Math.max(64, ...numeric.map(i => names[i].length * 8 + 16)));
    width = Math.max(340, left + numeric.length * cw + 10); height = 110 + rows.length * ch;
    numeric.forEach((i, j) => { out += label(left + j * cw + cw / 2, 24, names[i], 'middle', Math.floor(cw / 8) - 1); });
    rows.forEach((r, i) => {
      out += label(left - 12, 54 + i * ch, r[0], 'end', Math.floor(left / 8) - 1);
      numeric.forEach((j, k) => {
        const v = number(r, j), t = hi === lo ? .5 : (v - lo) / (hi - lo);
        const color = `color-mix(in srgb, var(--accent) ${Math.round(15 + 75 * t)}%, var(--surface))`;
        out += rect(left + k * cw, 32 + i * ch, cw - 3, ch - 3, color, `${r[0]}, ${names[j]}: ${v}`);
      });
    });
    const y = height - 42;
    for (let i = 0; i < 5; i++) out += rect(left + i * 30, y, 30, 12, `color-mix(in srgb, var(--accent) ${15 + i * 75 / 4}%, var(--surface))`, fmt(lo + (hi - lo) * i / 4));
    out += label(left, y + 32, fmt(lo), 'start') + label(left + 150, y + 32, fmt(hi), 'end');
  } else if (type === 'scatter' || type === 'bubble') {
    const xi = column(options.x, 1), yi = column(options.y, 2);
    const si = type === 'bubble' ? column(options.size, 3) : -1;
    const points = rows.map(r => ({ name: r[0], x: number(r, xi), y: number(r, yi), size: si < 0 ? 1 : number(r, si) }));
    if (points.some(p => p.size < 0)) throw Error('Bubble sizes must be nonnegative');
    const [xmin, xmax] = domain(...extent(points.map(p => p.x))), [ymin, ymax] = domain(...extent(points.map(p => p.y)));
    const smax = Math.max(...points.map(p => p.size)), px = scale(xmin, xmax, 100, 620), py = scale(ymin, ymax, 260, 55);
    yAxis(ymin, ymax, 100, 620, 55, 260); xAxis(xmin, xmax, 100, 620, 260);
    // Radius is sqrt(value): area, rather than radius, encodes the size column.
    points.forEach(p => { out += `<circle cx="${px(p.x)}" cy="${py(p.y)}" r="${si < 0 ? 6 : smax ? 22 * Math.sqrt(p.size / smax) : 0}" fill="var(--accent)" fill-opacity=".65" stroke="var(--fg)" stroke-width=".5"><title>${esc(p.name)}: ${esc(names[xi])} ${p.x}, ${esc(names[yi])} ${p.y}${si < 0 ? '' : ', ' + esc(names[si]) + ' ' + p.size}</title></circle>`; });
    out += label(360, 324, names[xi], 'middle', 55) + label(100, 24, names[yi], 'start', 30);
    if (si >= 0) out += label(620, 24, `${names[si]}: area (max ${fmt(smax)})`, 'end', 30);
  } else if (type === 'waterfall') {
    const vi = column(undefined, 1), ki = optional('Kind');
    let running = 0;
    const bars = rows.map(r => {
      const value = number(r, vi), kind = ki < 0 ? 'change' : text(r[ki]).toLowerCase();
      if (!['change', 'total', 'subtotal'].includes(kind)) throw Error('Invalid waterfall Kind: ' + kind);
      const start = kind === 'change' ? running : 0, end = kind === 'change' ? running + value : value;
      running = end;
      if (!Number.isFinite(end)) throw Error('Waterfall total is too large to plot');
      return { name: r[0], start, end, kind, value };
    });
    width = Math.max(680, 140 + bars.length * 95);
    const [low, high] = domain(...extent([0, ...bars.flatMap(b => [b.start, b.end])]));
    const py = scale(low, high, 255, 35), cw = (width - 140) / bars.length;
    yAxis(low, high, 95, width - 35, 35, 255);
    out += line(95, py(0), width - 35, py(0), 'var(--muted)');
    bars.forEach((b, i) => {
      const x = 100 + i * cw, y = Math.min(py(b.start), py(b.end));
      if (i < bars.length - 1) out += line(x + cw * .7, py(b.end), x + cw, py(b.end), 'var(--muted)');
      out += rect(x, y, cw * .7, Math.max(1, Math.abs(py(b.start) - py(b.end))), b.kind === 'change' ? (b.value < 0 ? 'var(--red)' : 'var(--green)') : palette[0], `${b.name}: ${b.value}; cumulative ${b.end}`);
      out += label(x + cw * .35, Math.max(20, y - 8), fmt(b.value), 'middle', 10) + label(x + cw * .35, 286, b.name, 'middle', 11);
    });
    out += label(width / 2, 324, names[vi], 'middle', 55);
  } else if (type === 'range' || type === 'timeline') {
    const timeline = type === 'timeline';
    const li = column(timeline ? 'Start' : 'Min'), ui = timeline ? optional('End') : column('Max'), mi = timeline ? -1 : optional('Median');
    const date = s => {
      const value = text(s), time = Date.parse(value + 'T00:00:00Z');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) throw Error('Dates must be valid YYYY-MM-DD dates');
      return time;
    };
    const data = rows.map(r => {
      const lo = timeline ? date(r[li]) : number(r, li);
      return { name: r[0], lo, hi: timeline ? (ui < 0 || !text(r[ui]) ? lo : date(r[ui])) : number(r, ui), mid: mi < 0 ? null : number(r, mi) };
    });
    if (data.some(d => d.lo > d.hi || d.mid !== null && (d.mid < d.lo || d.mid > d.hi))) throw Error(timeline ? 'End date precedes start date' : 'Range bounds must contain the central value');
    let [lo, hi] = extent(data.flatMap(d => [d.lo, d.hi]));
    if (timeline && lo === hi) { lo -= 86400000; hi += 86400000; } else [lo, hi] = domain(lo, hi);
    const px = scale(lo, hi, 195, 620), format = timeline ? v => new Date(v).toISOString().slice(0, 10) : fmt;
    height = 90 + rows.length * 38;
    xAxis(lo, hi, 195, 620, height - 42, format);
    data.forEach((d, i) => {
      const y = 28 + i * 38;
      out += label(180, y + 5, d.name, 'end', 22);
      const tip = `${d.name}: ${format(d.lo)} – ${format(d.hi)}${d.mid === null ? '' : '; Median ' + d.mid}`;
      if (timeline) out += rect(px(d.lo), y - 9, Math.max(5, px(d.hi) - px(d.lo)), 20, palette[i % 6], tip);
      else {
        out += `<g><title>${esc(tip)}</title><line x1="${px(d.lo)}" y1="${y}" x2="${px(d.hi)}" y2="${y}" stroke="${palette[0]}" stroke-width="6"/>${line(px(d.lo), y - 7, px(d.lo), y + 7, 'var(--fg)')}${line(px(d.hi), y - 7, px(d.hi), y + 7, 'var(--fg)')}${d.mid === null ? '' : `<circle cx="${px(d.mid)}" cy="${y}" r="6" fill="var(--fg)"/>`}</g>`;
      }
    });
    if (!timeline && mi >= 0) out += label(620, height - 3, 'Dot: Median', 'end');
  } else if (type === 'sankey') {
    const source = column('Source'), target = column('Target'), amount = column('Value');
    const edges = rows.map(r => ({ a: text(r[source]), b: text(r[target]), v: number(r, amount) }));
    if (edges.some(e => !e.a || !e.b || e.v < 0)) throw Error('Sankey nodes must be named and flows must be nonnegative');
    if (!edges.some(e => e.v > 0)) throw Error('Sankey needs a positive flow');
    const nodes = new Map();
    edges.forEach(e => { for (const n of [e.a, e.b]) if (!nodes.has(n)) nodes.set(n, { name: n, incoming: [], outgoing: [], depth: 0 }); });
    edges.forEach(e => { nodes.get(e.a).outgoing.push(e); nodes.get(e.b).incoming.push(e); });
    const pending = new Map([...nodes].map(([n, d]) => [n, d.incoming.length]));
    const queue = [...nodes.values()].filter(n => !n.incoming.length);
    for (let i = 0; i < queue.length; i++) {
      const n = queue[i];
      for (const e of n.outgoing) {
        const next = nodes.get(e.b); next.depth = Math.max(next.depth, n.depth + 1);
        pending.set(e.b, pending.get(e.b) - 1);
        if (!pending.get(e.b)) queue.push(next);
      }
    }
    if (queue.length !== nodes.size) throw Error('Sankey cycles are unsupported');
    const layers = new Map();
    for (const n of nodes.values()) {
      n.value = Math.max(n.incoming.reduce((s, e) => s + e.v, 0), n.outgoing.reduce((s, e) => s + e.v, 0));
      if (!n.value) continue;
      if (!layers.has(n.depth)) layers.set(n.depth, []);
      layers.get(n.depth).push(n);
    }
    const depth = Math.max(...layers.keys()), largest = Math.max(...[...layers.values()].map(ns => ns.length));
    width = Math.max(680, 150 + depth * 230); height = Math.max(340, 80 + largest * 60);
    const available = height - 80;
    const unit = Math.min(...[...layers.values()].map(ns => (available - (ns.length - 1) * 28) / ns.reduce((s, n) => s + n.value, 0)));
    if (!(unit > 0) || !Number.isFinite(unit)) throw Error('Sankey flow total is too large to plot');
    layers.forEach((ns, d) => {
      let y = 25;
      ns.forEach(n => { n.x = 80 + d * (width - 160) / (depth || 1); n.y = y; n.h = n.value * unit; n.inAt = n.outAt = 0; y += n.h + 28; });
    });
    edges.forEach((e, i) => {
      if (!e.v) return;
      const a = nodes.get(e.a), b = nodes.get(e.b), h = e.v * unit;
      const ay = a.y + a.outAt + h / 2, by = b.y + b.inAt + h / 2, mid = (a.x + 16 + b.x) / 2;
      a.outAt += h; b.inAt += h;
      out += `<path d="M${a.x + 16} ${ay} C${mid} ${ay},${mid} ${by},${b.x} ${by}" fill="none" stroke="${palette[i % 6]}" stroke-opacity=".45" stroke-width="${h}"><title>${esc(e.a)} → ${esc(e.b)}: ${e.v}</title></path>`;
    });
    for (const n of nodes.values()) if (n.value) out += rect(n.x, n.y, 16, n.h, palette[0], `${n.name}: ${n.value}`) + label(n.x + 8, n.y + n.h + 18, n.name, 'middle', 18);
  } else if (type === 'treemap') {
    const vi = column('Value'), root = { children: new Map(), value: 0 };
    rows.forEach(r => {
      const path = text(r[0]), value = number(r, vi), parts = path.split('/').map(text);
      if (value < 0) throw Error('Treemap values must be nonnegative');
      if (parts.some(p => !p) || parts.length > 32) throw Error('Invalid treemap path (maximum depth 32)');
      let node = root;
      for (const part of parts) {
        if (node.leaf) throw Error('Overlapping treemap path: ' + path);
        if (!node.children.has(part)) node.children.set(part, { name: part, children: new Map(), value: 0 });
        node = node.children.get(part);
      }
      if (node.leaf || node.children.size) throw Error('Duplicate or overlapping treemap path: ' + path);
      node.leaf = true; node.value = value; node.path = path;
    });
    const sum = n => n.value = n.leaf ? n.value : [...n.children.values()].reduce((s, child) => s + sum(child), 0);
    if (!(sum(root) > 0) || !Number.isFinite(root.value)) throw Error('Treemap needs a finite positive total');
    const draw = (node, x, y, w, h, vertical = true, color = 0) => {
      if (node.leaf) {
        if (!node.value) return;
        out += rect(x + 1, y + 1, w - 2, h - 2, palette[color % 6], `${node.path}: ${node.value}`);
        // A theme-neutral surface behind labels keeps them legible on every fill.
        if (w > 65 && h > 38) {
          const max = Math.max(2, Math.floor((w - 20) / 8));
          out += rect(x + 4, y + 4, w - 8, Math.min(h - 8, 42), 'var(--surface)', node.path);
          out += label(x + 10, y + 21, node.name, 'start', max);
          if (h > 50) out += label(x + 10, y + 39, fmt(node.value), 'start', max);
        }
        return;
      }
      let at = 0;
      [...node.children.values()].forEach((n, i) => {
        const size = (vertical ? w : h) * n.value / node.value;
        if (n.value) draw(n, vertical ? x + at : x, vertical ? y : y + at, vertical ? size : w, vertical ? h : size, !vertical, node === root ? i : color);
        at += size;
      });
    };
    draw(root, 10, 10, 660, 310);
  }
  // Reject arithmetic overflow rather than emitting an invalid, misleading SVG.
  if (/(?:="|[ ,])(?:NaN|[+-]?Infinity)(?:[ ,"<])/.test(out)) throw Error('Numeric range is too large to plot');
  return `<svg xmlns="http://www.w3.org/2000/svg" class="w-visual-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(options.title || type + ' chart')}" style="--visual-width:${width}px;--visual-max-width:${Math.max(width, Math.min(800, width * 400 / height))}px"><title>${esc(options.title || type + ' chart')}</title><desc>Scroll to explore dense charts. Use the View control for the data table or download CSV for exact values.</desc>${out}</svg>`;
}
