// Keep platform choice at render time so Markdown loaded later uses the same keys.
const escape = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export function shortcut(content, platform = globalThis.navigator?.userAgentData?.platform || globalThis.navigator?.platform || '') {
  const keys = content.split('+').map(key => key.trim());
  if (keys.some(key => !key || key.length > 32 || /[\[\]<>\r\n]/.test(key))) {
    return `<span class="td-error" role="alert">Keyboard shortcut: use keys separated by + (write Plus for the + key). ${escape('[[' + content + ']]')}</span>`;
  }
  const mac = /Mac|iPhone|iPad|iPod/i.test(platform);
  const aliases = { mod: mac ? ['⌘', 'Command'] : ['Ctrl', 'Control'], ctrl: ['Ctrl', 'Control'], control: ['Ctrl', 'Control'], cmd: ['⌘', 'Command'], command: ['⌘', 'Command'], shift: ['Shift', 'Shift'], alt: ['Alt', 'Alt'], option: ['Option', 'Option'], enter: ['Enter', 'Enter'], esc: ['Esc', 'Escape'], escape: ['Esc', 'Escape'], space: ['Space', 'Space'], plus: ['+', 'Plus'], arrowup: ['↑', 'Up arrow'], arrowdown: ['↓', 'Down arrow'], arrowleft: ['←', 'Left arrow'], arrowright: ['→', 'Right arrow'] };
  const resolved = keys.map(key => (Object.hasOwn(aliases, key.toLowerCase()) ? aliases[key.toLowerCase()] : [key, key]));
  return `<span class="w-kbd" role="img" aria-label="${escape(resolved.map(key => key[1]).join(' plus '))}">${resolved.map(key => `<kbd aria-hidden="true">${escape(key[0])}</kbd>`).join('<span class="w-kbd-plus" aria-hidden="true">+</span>')}</span>`;
}
