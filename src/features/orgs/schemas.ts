import { z } from 'zod';
import { SLUG_MAX_LENGTH } from '@/lib/slug';

/** Mirrors the database's check: lowercase letters and digits in groups split by single hyphens. */
export const ORG_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const DESCRIPTION_MAX_LENGTH = 500;

const email = z.email();
const webAddress = z.url({ protocol: /^https?$/, hostname: z.regexes.domain });

/** An optional text field: blank is fine, anything else must pass `check`. */
function optional(check: z.ZodType<string>, message: string) {
  return z
    .string()
    .trim()
    .refine((value) => value === '' || check.safeParse(value).success, message);
}

// Limits match the database's CHECK constraints (see the organizations migrations).
export const createOrgSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter a name for your organization.')
    .max(100, 'Use 100 characters or fewer.'),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Use at least 3 characters.')
    .max(SLUG_MAX_LENGTH, `Use ${String(SLUG_MAX_LENGTH)} characters or fewer.`)
    .regex(ORG_SLUG_PATTERN, 'Use only letters, numbers, and single hyphens, like food-bank.'),
  timezone: z.string().min(1, 'Choose a time zone.'),
  description: z
    .string()
    .trim()
    .max(DESCRIPTION_MAX_LENGTH, `Use ${String(DESCRIPTION_MAX_LENGTH)} characters or fewer.`),
  contactEmail: optional(email, 'Enter a valid email address, like hello@example.org.'),
  websiteUrl: optional(webAddress, 'Enter a full web address, like https://example.org.'),
});

export type CreateOrgFormValues = z.input<typeof createOrgSchema>;
export type CreateOrgFormOutput = z.output<typeof createOrgSchema>;
