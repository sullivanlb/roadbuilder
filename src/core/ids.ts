/** Stable identifier of anything stored in a project. */
export type Id = string;

/** A new random identifier, unique across projects. */
export const createId = (): Id => crypto.randomUUID();
