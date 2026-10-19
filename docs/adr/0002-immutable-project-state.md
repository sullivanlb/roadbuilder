# The project is an immutable value held by a Pinia store

The project used to be mutated in place inside a `shallowRef`, with a manual `triggerRef` after each change and a JSON snapshot of the whole project per history entry; forgetting the trigger produced silent stale views. The project is now an immutable value: every edit produces a new object through immer, the Pinia project store swaps the reference, and the undo history keeps references to previous values (VueUse `useManualRefHistory`). Unchanged parts are shared between versions, a change is detected by identity, and every derived value (samples, issues, scene) recomputes exactly when the project reference changes.

## Considered options

- Mutable reactive state with a command pattern storing inverse operations: precise, but every new command needs a hand-written inverse.
- Keep JSON snapshots: simple, but costs a full serialisation per change and keeps the in-place mutation pitfalls.
