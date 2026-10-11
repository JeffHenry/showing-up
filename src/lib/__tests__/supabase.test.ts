import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { supabase } from '@/lib/supabase';
import { server } from '@/test/msw/server';

const REST_URL = 'http://localhost:54321/rest/v1';

describe('supabase client', () => {
  it('queries the configured project with the publishable key', async () => {
    let apiKey: string | null = null;
    server.use(
      http.get(`${REST_URL}/organizations`, ({ request }) => {
        apiKey = request.headers.get('apikey');
        return HttpResponse.json([{ id: 'org-1', name: 'Food Bank' }]);
      }),
    );

    const { data, error } = await supabase.from('organizations').select('id, name');

    expect(error).toBeNull();
    expect(data).toEqual([{ id: 'org-1', name: 'Food Bank' }]);
    expect(apiKey).toBe('sb_publishable_test');
  });

  it('calls database functions as RPCs with named arguments', async () => {
    let body: unknown = null;
    server.use(
      http.post(`${REST_URL}/rpc/create_organization`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: 'org-1', name: 'Food Bank', slug: 'food-bank' });
      }),
    );

    const { error } = await supabase.rpc('create_organization', {
      p_name: 'Food Bank',
      p_slug: 'food-bank',
    });

    expect(error).toBeNull();
    expect(body).toEqual({ p_name: 'Food Bank', p_slug: 'food-bank' });
  });

  it('surfaces typed database error codes for the app to map', async () => {
    server.use(
      http.post(`${REST_URL}/rpc/create_organization`, () =>
        HttpResponse.json(
          {
            code: 'P0001',
            message: 'SLUG_TAKEN',
            details: 'That organization URL is already in use.',
            hint: null,
          },
          { status: 400 },
        ),
      ),
    );

    const { error } = await supabase.rpc('create_organization', {
      p_name: 'Copycat',
      p_slug: 'food-bank',
    });

    expect(error).toMatchObject({ code: 'P0001', message: 'SLUG_TAKEN' });
  });
});
