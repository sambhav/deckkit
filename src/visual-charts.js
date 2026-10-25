// Additional native visualisations. Input is the original table/CSV dataset.
export const visualTypes = ['heatmap','scatter','bubble','waterfall','timeline','sankey','treemap','range'];
export function visualChart(headers, rows, type, options = {}) {
  const names = headers.map(x => String(x).trim());
  if (names.some(x => !x) || new Set(names).size !== names.length) throw Error('Column names must be unique and nonempty');
  if (!rows.length || rows.length > 1000 || rows.some(r => r.length !== names.length)) throw Error('Expected 1–1000 complete data rows');
  const col = (name, fallback, required = true) => {
    const index = name ? names.indexOf(name) : fallback;
    if (index < 0 || index >= names.length) { if (required) throw Error('Missing column: ' + name); return -1; }
    return index;
  };
  const val = (r, i) => {
    const s = String(r[i] ?? '').trim();
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(s) || !Number.isFinite(+s)) throw Error('Invalid number in column ' + names[i] + ': ' + s);
    return +s;
  };
  const esc = x => String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const label = (x,y,s,anchor='middle') => `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="currentColor" font-size="11">${esc(s)}</text>`;
  const rect = (x,y,w,h,c,tip) => `<rect x="${x}" y="${y}" width="${Math.max(0,w)}" height="${Math.max(0,h)}" rx="3" fill="${c}"><title>${esc(tip)}</title></rect>`;
  const palette = ['#438CBA','#37A783','#D99B4A','#9A79BF','#C96872','#7C93A5'];
  let out = '', width = 680, height = 340;
  if (type === 'heatmap') {
    const numeric = names.slice(1).map((_,i)=>i+1), values=rows.flatMap(r=>numeric.map(i=>val(r,i)));
    const lo=Math.min(...values), hi=Math.max(...values), cw=Math.min(90,560/numeric.length), ch=Math.min(35,260/rows.length);
    width=110+numeric.length*cw; height=65+rows.length*ch;
    numeric.forEach((i,j)=>out+=label(100+j*cw+cw/2,20,names[i]));
    rows.forEach((r,i)=>{out+=label(92,47+i*ch,r[0],'end');numeric.forEach((j,k)=>{const v=val(r,j),t=(v-lo)/(hi-lo||1);out+=rect(100+k*cw,29+i*ch,cw-3,ch-3,`color-mix(in srgb, var(--accent) ${Math.round(15+80*t)}%, var(--surface))`,`${r[0]}, ${names[j]}: ${v}`);});});
  } else if (type === 'scatter' || type === 'bubble') {
    const xi=col(options.x,1),yi=col(options.y,2),si=col(options.size,-1,false);
    const points=rows.map(r=>({name:r[0],x:val(r,xi),y:val(r,yi),size:si<0?1:val(r,si)}));
    if(points.some(p=>p.size<0))throw Error('Bubble sizes must be nonnegative');
    const bounds=k=>[Math.min(...points.map(p=>p[k])),Math.max(...points.map(p=>p[k]))];
    const [xmin,xmax]=bounds('x'),[ymin,ymax]=bounds('y'),[,smax]=bounds('size');
    const px=v=>65+(v-xmin)/(xmax-xmin||1)*560,py=v=>285-(v-ymin)/(ymax-ymin||1)*235;
    out+=`<path d="M65 40V285H635" stroke="currentColor" opacity=".5" fill="none"/>`;
    points.forEach(p=>out+=`<circle cx="${px(p.x)}" cy="${py(p.y)}" r="${si<0?6:4+17*Math.sqrt(p.size/(smax||1))}" fill="var(--accent)" fill-opacity=".65"><title>${esc(p.name)}: ${p.x}, ${p.y}</title></circle>`);
    out+=label(350,325,names[xi])+label(35,35,names[yi]);
  } else if (type === 'waterfall') {
    const vi=col(null,1),ki=col('Kind',2,false),values=rows.map(r=>val(r,vi));let running=0;
    const bars=rows.map((r,i)=>{const kind=ki<0?'change':String(r[ki]).toLowerCase();if(!['change','total','subtotal'].includes(kind))throw Error('Invalid waterfall Kind: '+kind);const start=kind==='change'?running:0;const end=kind==='change'?running+values[i]:values[i];running=end;return {name:r[0],start,end,kind,value:values[i]};});
    const low=Math.min(0,...bars.flatMap(b=>[b.start,b.end])),high=Math.max(0,...bars.flatMap(b=>[b.start,b.end])),py=v=>275-(v-low)/(high-low||1)*235,cw=570/bars.length;
    bars.forEach((b,i)=>{const x=70+i*cw,y=Math.min(py(b.start),py(b.end));out+=rect(x,y,cw*.7,Math.max(2,Math.abs(py(b.start)-py(b.end))),b.kind==='change'?(b.value<0?'#37A783':'#C96872'):'#438CBA',b.name+': '+b.value);out+=label(x+cw*.35,302,b.name);});
  } else if (type === 'range') {
    const li=col('Min',1),ui=col('Max',2),mi=col('Median',3,false);
    const data=rows.map(r=>({name:r[0],lo:val(r,li),hi:val(r,ui),mid:mi<0?null:val(r,mi)}));
    if(data.some(d=>d.lo>d.hi||d.mid!==null&&(d.mid<d.lo||d.mid>d.hi)))throw Error('Range bounds must contain the central value');
    const lo=Math.min(...data.map(d=>d.lo)),hi=Math.max(...data.map(d=>d.hi)),px=v=>135+(v-lo)/(hi-lo||1)*480;
    height=50+rows.length*38;
    data.forEach((d,i)=>{const y=30+i*38;out+=label(120,y+4,d.name,'end')+`<line x1="${px(d.lo)}" y1="${y}" x2="${px(d.hi)}" y2="${y}" stroke="#438CBA" stroke-width="7" stroke-linecap="round"><title>${esc(d.name)}: ${d.lo}–${d.hi}</title></line>`;if(d.mid!==null)out+=`<circle cx="${px(d.mid)}" cy="${y}" r="6" fill="#D99B4A"/>`;});
  } else if (type === 'timeline') {
    const start=col('Start',1),end=col('End',2,false);
    const parse=s=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s+'T00:00:00Z')))throw Error('Dates must be YYYY-MM-DD');return Date.parse(s+'T00:00:00Z');};
    const data=rows.map(r=>({name:r[0],a:parse(r[start]),b:end<0||!r[end]?parse(r[start]):parse(r[end])}));
    if(data.some(d=>d.b<d.a))throw Error('End date precedes start date');
    const lo=Math.min(...data.map(d=>d.a)),hi=Math.max(...data.map(d=>d.b)),px=v=>155+(v-lo)/(hi-lo||1)*470;
    height=55+rows.length*38;
    data.forEach((d,i)=>{const y=22+i*38;out+=label(140,y+12,d.name,'end');out+=rect(px(d.a),y,Math.max(5,px(d.b)-px(d.a)),20,palette[i%6],d.name);});
  } else if (type === 'sankey') {
    const source=col('Source',0),target=col('Target',1),amount=col('Value',2);
    const edges=rows.map(r=>({a:r[source],b:r[target],v:val(r,amount)}));if(edges.some(e=>e.v<0))throw Error('Sankey flows must be nonnegative');
    const nodes=[...new Set(edges.flatMap(e=>[e.a,e.b]))],adj=new Map(nodes.map(n=>[n,[]]));
    edges.forEach(e=>adj.get(e.a).push(e.b));
    const depth=new Map(),visit=(n,stack=new Set())=>{if(stack.has(n))throw Error('Sankey cycles are unsupported');if(depth.has(n))return depth.get(n);stack.add(n);const d=adj.get(n).length?1+Math.max(...adj.get(n).map(x=>visit(x,stack))):0;stack.delete(n);depth.set(n,d);return d;};nodes.forEach(n=>visit(n));
    const max=Math.max(...depth.values()),layers=new Map();nodes.forEach(n=>{const d=max-depth.get(n);if(!layers.has(d))layers.set(d,[]);layers.get(d).push(n);});
    const pos=new Map();layers.forEach((ns,d)=>ns.forEach((n,i)=>pos.set(n,{x:55+d*570/(max||1),y:35+i*260/Math.max(1,ns.length)})));
    edges.forEach((e,i)=>{const a=pos.get(e.a),b=pos.get(e.b);out+=`<path d="M${a.x+12} ${a.y+9} C${(a.x+b.x)/2} ${a.y+9},${(a.x+b.x)/2} ${b.y+9},${b.x} ${b.y+9}" fill="none" stroke="${palette[i%6]}" stroke-opacity=".5" stroke-width="${Math.max(2,Math.min(25,e.v/Math.max(...edges.map(x=>x.v),1)*25))}"><title>${esc(e.a)} → ${esc(e.b)}: ${e.v}</title></path>`;});
    nodes.forEach(n=>{const p=pos.get(n);out+=rect(p.x,p.y,12,18,'var(--accent)',n)+label(p.x+6,p.y+31,n);});
  } else if (type === 'treemap') {
    const vi=col('Value',1),items=rows.map(r=>({path:String(r[0]),value:val(r,vi)}));if(items.some(x=>x.value<0)||!items.some(x=>x.value>0))throw Error('Treemap values must be nonnegative with positive total');
    const root={children:new Map(),value:0};
    items.forEach(item=>{let node=root;const parts=item.path.split(/\s*\/\s*/);if(parts.some(p=>!p))throw Error('Invalid treemap path');for(const part of parts){if(!node.children.has(part))node.children.set(part,{name:part,children:new Map(),value:0});node=node.children.get(part);}if(node.children.size||node.value)throw Error('Duplicate or overlapping treemap path: '+item.path);node.value=item.value;});
    const sum=node=>node.children.size?[...node.children.values()].reduce((s,n)=>s+sum(n),0):node.value;sum(root);
    const draw=(node,x,y,w,h,vertical=true,level=0)=>{const children=[...node.children.values()];if(!children.length){out+=rect(x+1,y+1,w-2,h-2,palette[level%6],node.name+': '+node.value);if(w>55&&h>23)out+=label(x+8,y+18,node.name,'start');return;}const total=children.reduce((s,n)=>s+sum(n),0);let at=0;children.forEach((n,i)=>{const frac=sum(n)/(total||1),size=(vertical?w:h)*frac;draw(n,vertical?x+at:x,vertical?y:y+at,vertical?size:w,vertical?h:size,!vertical,level+1+i);at+=size;});};
    draw(root,30,20,620,285);
  }
  return `<svg class="w-visual-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(options.title||type+' chart')}" style="width:100%;height:auto;max-height:480px;overflow:visible">${out}</svg>`;
}
