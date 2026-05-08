import { describe, expect, it } from 'vitest';

import { activityEvent } from './events.js';

describe('activityEvent discriminated union', () => {
  it('accepts a window_focus event', () => {
    const result = activityEvent.safeParse({
      clientEventId: 'evt-12345678',
      timestamp: '2026-05-08T09:00:00.000Z',
      type: 'window_focus',
      payload: { processName: 'Code.exe', windowTitle: 'index.ts - VS Code' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects unknown type', () => {
    const result = activityEvent.safeParse({
      clientEventId: 'evt-12345678',
      timestamp: '2026-05-08T09:00:00.000Z',
      type: 'keystroke',
      payload: {},
    });
    expect(result.success).toBe(false);
  });

  it('rejects window_focus missing windowTitle', () => {
    const result = activityEvent.safeParse({
      clientEventId: 'evt-12345678',
      timestamp: '2026-05-08T09:00:00.000Z',
      type: 'window_focus',
      payload: { processName: 'Code.exe' },
    });
    expect(result.success).toBe(false);
  });
});
