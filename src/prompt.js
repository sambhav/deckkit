// Heading-led prompt/output pairs. Keep the original token streams for nested Markdown.
const escape = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export function promptPair(tokens, options, classes, render) {
  const fail = message => `<p class="td-error" role="alert">prompt: ${escape(message)}</p>${render(tokens)}`;
  if (classes.length || Object.keys(options).some(key => !['model', 'temperature'].includes(key))) return fail('supported options are model and temperature.');
  if ('model' in options && !options.model.trim()) return fail('model must be nonempty.');
  if ('temperature' in options && (!options.temperature.trim() || !Number.isFinite(Number(options.temperature)) || Number(options.temperature) < 0)) return fail('temperature must be a finite, non-negative number.');
  const heads = []; let containers = 0;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type === 'td_container') containers += token.content ? 1 : -1;
    if (!containers && token.type === 'heading_open' && token.tag === 'h3' && token.level === 0) heads.push(i);
  }
  if (heads.length !== 2 || heads[0] !== 0 || tokens[1]?.content.trim() !== 'Prompt' || tokens[heads[1] + 1]?.content.trim() !== 'Output') return fail('use exactly ### Prompt followed by ### Output. Use #### for subheadings.');
  const prompt = tokens.slice(3, heads[1]), output = tokens.slice(heads[1] + 3);
  if (!prompt.length || !output.length) return fail('both Prompt and Output need content.');
  const badge = [options.model, 'temperature' in options ? `temperature=${options.temperature}` : ''].filter(Boolean).join(' · ');
  return `<div class="w w-prompt">${badge ? `<p class="w-prompt-params">${escape(badge)}</p>` : ''}<section class="w-prompt-input"><h3>Prompt</h3>${render(prompt)}</section><section class="w-prompt-output"><h3>Output</h3>${render(output)}</section></div>`;
}
