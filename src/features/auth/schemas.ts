import { z } from 'zod';

export const emailFormSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Enter your email address.')
    .pipe(z.email('Enter a valid email address, like name@example.com.')),
});
export type EmailFormValues = z.infer<typeof emailFormSchema>;

export const codeFormSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit code from your email.'),
});
export type CodeFormValues = z.infer<typeof codeFormSchema>;
