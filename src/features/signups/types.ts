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

/** The parts of a shift the "Who's coming" list needs. */
export type RosterShift = Pick<SignupShift, 'id' | 'title' | 'start_time' | 'cancelled_at'>;

/** One person coming to a shift, as the coordinators' "Who's coming" list shows them. */
export interface ShiftSignup {
  userId: string;
  /** Null for someone who hasn't chosen a display name. */
  fullName: string | null;
  /** When they signed up (most recently, if they dropped out and came back). */
  signedUpAt: string;
}

/** The fields a signup changes in a cached shift (for optimistic updates). */
export type SignupFields = Pick<SignupShift, 'confirmed_count' | 'signed_up'>;
