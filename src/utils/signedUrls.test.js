import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSignedStorageUrl } from './signedUrls';
import { supabase } from '../supabaseClient';

vi.mock('../supabaseClient', () => ({
  supabase: {
    storage: {
      from: vi.fn(),
    },
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}));

describe('signedUrls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty or non-string input as-is', async () => {
    expect(await getSignedStorageUrl(null)).toBe(null);
    expect(await getSignedStorageUrl('')).toBe('');
    expect(await getSignedStorageUrl(123)).toBe(123);
  });

  it('returns blob: and data: URLs as-is', async () => {
    expect(await getSignedStorageUrl('blob:http://localhost/123')).toBe('blob:http://localhost/123');
    expect(await getSignedStorageUrl('data:image/png;base64,abc')).toBe('data:image/png;base64,abc');
  });

  it('returns URLs that already have a signed token as-is', async () => {
    const signed = 'https://abc.supabase.co/storage/v1/object/sign/bokix-uploads/u1/files/k.pdf?token=xyz123';
    expect(await getSignedStorageUrl(signed)).toBe(signed);
  });

  it('leaves public bucket URLs (companylogo, profile) unchanged', async () => {
    const logo = 'https://abc.supabase.co/storage/v1/object/public/companylogo/u1/logo.png';
    expect(await getSignedStorageUrl(logo)).toBe(logo);
    expect(supabase.storage.from).not.toHaveBeenCalled();
  });

  it('creates and caches signed URLs for bokix-uploads files', async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: 'https://abc.supabase.co/storage/v1/object/sign/bokix-uploads/u1/files/kvitto.jpg?token=tok123' },
      error: null,
    });
    supabase.storage.from.mockReturnValue({ createSignedUrl });

    const raw = 'https://abc.supabase.co/storage/v1/object/public/bokix-uploads/u1/files/kvitto.jpg';
    const first = await getSignedStorageUrl(raw);
    expect(first).toContain('token=tok123');
    expect(createSignedUrl).toHaveBeenCalledWith('u1/files/kvitto.jpg', 3600);

    // Second call should hit in-memory cache without calling createSignedUrl again
    const second = await getSignedStorageUrl(raw);
    expect(second).toBe(first);
    expect(createSignedUrl).toHaveBeenCalledTimes(1);
  });
});
