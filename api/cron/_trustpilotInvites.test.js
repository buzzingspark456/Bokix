import { describe, expect, it, vi } from 'vitest';
import { processDueTrustpilotInvites } from './_trustpilotInvites.js';

function createAdmin(rows = []) {
  const updates = [];
  const admin = {
    from: vi.fn(() => {
      const query = { selected: false, filters: {} };
      query.update = vi.fn(values => {
        query.values = values;
        return query;
      });
      query.eq = vi.fn((column, value) => {
        query.filters[column] = value;
        return query;
      });
      query.lt = vi.fn(() => query);
      query.lte = vi.fn(() => query);
      query.select = vi.fn(() => {
        query.selected = true;
        return query;
      });
      query.order = vi.fn(() => query);
      query.limit = vi.fn(() => query);
      query.then = resolve => {
        if (query.values) updates.push(query.values);
        const isClaim = query.values?.status === 'sending' && query.selected;
        resolve({ data: query.selected ? (isClaim ? [{ id: rows[0]?.id }] : rows) : null, error: null });
      };
      return query;
    }),
  };
  return { admin, updates };
}

describe('processDueTrustpilotInvites', () => {
  it('reports due invitations without changing state in dry-run mode', async () => {
    const { admin, updates } = createAdmin([{ id: 'invite-1' }]);
    const send = vi.fn();

    const result = await processDueTrustpilotInvites(admin, {
      bccAddress: 'private@trustpilot.example',
      dryRun: true,
      send,
    });

    expect(result.wouldSend).toBe(1);
    expect(updates).toHaveLength(0);
    expect(send).not.toHaveBeenCalled();
  });

  it('skips safely when the Trustpilot BCC is not configured', async () => {
    const { admin } = createAdmin();
    const result = await processDueTrustpilotInvites(admin, { bccAddress: '' });
    expect(result.skipped).toContain('TRUSTPILOT_INVITE_BCC');
    expect(admin.from).not.toHaveBeenCalled();
  });

  it('claims and sends each due invite with Trustpilot BCC and an idempotency key', async () => {
    const { admin, updates } = createAdmin([{ id: 'invite-1', customer_email: 'customer@example.test', attempts: 0 }]);
    const send = vi.fn().mockResolvedValue({ ok: true });

    const result = await processDueTrustpilotInvites(admin, {
      bccAddress: 'private@trustpilot.example',
      now: new Date('2026-11-30T12:00:00.000Z'),
      send,
    });

    expect(result.sent).toBe(1);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ['customer@example.test'],
        bcc: ['private@trustpilot.example'],
      }),
      { idempotencyKey: 'trustpilot-invite-invite-1' },
    );
    expect(updates.map(update => update.status)).toEqual(['pending', 'sending', 'sent']);
  });
});
