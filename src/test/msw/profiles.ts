import { http, HttpResponse } from 'msw';
import { testUser } from '@/test/fixtures/auth';
import { REST_URL, restError } from '@/test/msw/rest';

/** The display name the default handler gives the test user. */
export const testUserName = 'Taylor Tester';

export const profileHandlers = {
  /** The signed-in user's profile; `null` means they haven't chosen a name yet. */
  mine: (fullName: string | null) =>
    http.get(`${REST_URL}/profiles`, () =>
      HttpResponse.json({ id: testUser.id, full_name: fullName }),
    ),
  mineFails: () =>
    http.get(`${REST_URL}/profiles`, () => restError(500, 'XX000', 'internal error')),
  /** Saving a name; `onBody` receives the PATCH body. Returns the saved profile. */
  updateOk: (onBody?: (body: unknown) => void) =>
    http.patch(`${REST_URL}/profiles`, async ({ request }) => {
      const body = (await request.json()) as { full_name: string };
      onBody?.(body);
      return HttpResponse.json({ id: testUser.id, full_name: body.full_name });
    }),
  updateFails: (code: string, message: string) =>
    http.patch(`${REST_URL}/profiles`, () => restError(400, code, message)),
};
