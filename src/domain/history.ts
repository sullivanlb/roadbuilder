/** One entry per gesture or completed field edit, bounded to the current session. */
export class ProjectHistory {
  private past: string[] = [];
  private future: string[] = [];
  constructor(private readonly limit = 60) {}
  get canUndo() {
    return this.past.length > 0;
  }
  get canRedo() {
    return this.future.length > 0;
  }
  remember(before: string, after: string) {
    if (before === after) return;
    this.past.push(before);
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }
  undo(current: string): string | undefined {
    const previous = this.past.pop();
    if (previous !== undefined) this.future.push(current);
    return previous;
  }
  redo(current: string): string | undefined {
    const next = this.future.pop();
    if (next !== undefined) this.past.push(current);
    return next;
  }
}
