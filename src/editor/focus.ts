/** Whether the keyboard focus is in a field, where shortcuts must not fire. */
export function isTyping() {
  const active = document.activeElement;
  return (
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(active?.tagName ?? '') ||
    (active instanceof HTMLElement && active.isContentEditable)
  );
}
