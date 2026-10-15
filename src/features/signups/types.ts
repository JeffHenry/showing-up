/**
 * The parts of a shift this feature reads and changes. Declared here (rather than imported from
 * the shifts feature) so the two features stay independent; a cached shift has these fields.
 */
export interface SignupShift {
  id: string;
  title: string;
  start_time: string;
  cancelled_at: string | null;
  capacity: number;
  confirmed_count: number;
  /** Whether the signed-in person has a spot. */
  signed_up: boolean;
}

/** The fields a signup changes in a cached shift (for optimistic updates). */
export type SignupFields = Pick<SignupShift, 'confirmed_count' | 'signed_up'>;
