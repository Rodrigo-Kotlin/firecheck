import { describe, expect, it } from 'vitest';
import { InspectionDraftSession } from './inspectionDraftSession';

describe('inspection draft resume session', () => {
  it('checks an equipment only once while its form session remains active', () => {
    const session = new InspectionDraftSession();
    expect(session.shouldCheck('user-a::EXT-001')).toBe(true);
    expect(session.shouldCheck('user-a::EXT-001')).toBe(false);
  });

  it('does not reopen a resume prompt after the current session autosaves', () => {
    const session = new InspectionDraftSession();
    expect(session.shouldCheck('user-a::EXT-001')).toBe(true);
    // A later Dexie save cannot create another resume decision.
    expect(session.shouldCheck('user-a::EXT-001')).toBe(false);
  });

  it('allows a fresh check after leaving and returning to an equipment', () => {
    const session = new InspectionDraftSession();
    expect(session.shouldCheck('user-a::EXT-001')).toBe(true);
    session.leave('user-a::EXT-001');
    expect(session.shouldCheck('user-a::EXT-002')).toBe(true);
    expect(session.shouldCheck('user-a::EXT-001')).toBe(true);
  });

  it('isolates session decisions by owner and equipment', () => {
    const session = new InspectionDraftSession();
    expect(session.shouldCheck('user-a::EXT-001')).toBe(true);
    expect(session.shouldCheck('user-b::EXT-001')).toBe(true);
    expect(session.shouldCheck('user-a::EXT-002')).toBe(true);
  });
});
