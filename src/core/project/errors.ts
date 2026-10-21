/** Why a project file cannot be opened; the interface turns it into localised text. */
export type ProjectErrorDetail =
  | { code: 'file-too-large'; maxBytes: number }
  | { code: 'invalid-json' }
  | { code: 'not-a-project' }
  | { code: 'points-limit'; max: number }
  | { code: 'barriers-limit'; max: number }
  | { code: 'width-zones-limit'; max: number }
  | { code: 'bank-zones-limit'; max: number }
  | { code: 'scenery-limit'; max: number }
  | { code: 'duplicate-id' }
  | { code: 'barrier-endpoint' }
  | { code: 'barrier-span' }
  | { code: 'barrier-direction' }
  | { code: 'position-point' }
  | { code: 'pit-lane-on-road' }
  | { code: 'cars-without-pit-lane' }
  | { code: 'invalid-value'; path: string };

/** Rejection raised when a project file cannot be opened. */
export class ProjectError extends Error {
  constructor(readonly detail: ProjectErrorDetail) {
    super(detail.code);
    this.name = 'ProjectError';
  }
}
