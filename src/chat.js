// Role boundaries are inline tokens, so role-like text in code, lists and quotes stays literal.
export function chatTranscript(tokens, { render, renderInline, escape, options, classes }) {
  const fail = () => '<p class="td-error" role="alert">Chat needs messages starting with **user:**, **assistant:**, **system:** or **tool**; it takes no options.</p>' + render(tokens);
  if (Object.keys(options).length || classes.length) return fail();
  const messages = [];
  let current;
  const append = html => { if (!current) throw new Error('missing role'); current.body += html; };
  try {
    for (let i = 0; i < tokens.length;) {
      const token = tokens[i];
      if (token.type === 'paragraph_open' && token.level === 0 && tokens[i + 1]?.type === 'inline') {
        const lines = [[]];
        for (const child of tokens[i + 1].children || []) {
          if (['softbreak', 'hardbreak'].includes(child.type)) lines.push([]);
          else lines.at(-1).push(child);
        }
        for (const line of lines) {
          while (line[0]?.type === 'text' && !line[0].content) line.shift();
          const role = line[0]?.type === 'strong_open' && line[1]?.type === 'text' && line[2]?.type === 'strong_close' && line[1].content.match(/^(user|assistant|system|tool):?$/i);
          if (role) {
            current = { role: role[1].toLowerCase(), body: '' }; messages.push(current);
            line.splice(0, 3);
            if (line[0]?.type === 'text') line[0] = { ...line[0], content: line[0].content.replace(/^:\s*|^\s+/, '') };
          }
          append('<p>' + renderInline(line) + '</p>');
        }
        i += 3;
      } else {
        // Consume a complete block; nested paragraphs cannot start transcript messages.
        let end = i + 1, depth = token.type === 'td_container' ? 1 : token.nesting;
        while (depth > 0 && end < tokens.length) {
          const next = tokens[end++];
          depth += token.type === 'td_container' ? (next.type === 'td_container' ? (next.content ? 1 : -1) : 0) : next.nesting;
        }
        append(render(tokens.slice(i, end))); i = end;
      }
    }
    if (!messages.length || messages.some(m => !m.body.replace(/<[^>]*>/g, '').trim())) return fail();
  } catch { return fail(); }
  return '<div class="w w-chat" role="group" aria-label="Chat transcript">' + messages.map(m => {
    const label = m.role[0].toUpperCase() + m.role.slice(1);
    return m.role === 'tool'
      ? `<details class="w-chat-message w-chat-tool"><summary>Tool call</summary><div class="w-chat-body">${m.body}</div></details>`
      : `<div class="w-chat-message" data-role="${escape(m.role)}"><div class="w-chat-role">${label}</div><div class="w-chat-body">${m.body}</div></div>`;
  }).join('') + '</div>';
}
