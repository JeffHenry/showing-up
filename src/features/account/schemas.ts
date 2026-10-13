import { z } from 'zod';

/** Mirrors the database: a name is 1-120 visible characters. */
export const nameFormSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name.').max(120, 'Use 120 characters or fewer.'),
});

export type NameFormValues = z.infer<typeof nameFormSchema>;
