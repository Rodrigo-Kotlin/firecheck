import { describe, expect, it } from 'vitest';
import { getSafeReturnLocation } from './navigation';

describe('safe return navigation', () => {
  it('preserves internal pathname, search and hash', () => {
    expect(getSafeReturnLocation({ pathname: '/equipamentos', search: '?ccView=attention', hash: '#lista' }))
      .toBe('/equipamentos?ccView=attention#lista');
  });

  it('rejects external and authentication destinations', () => {
    expect(getSafeReturnLocation({ pathname: 'https://example.com' })).toBeNull();
    expect(getSafeReturnLocation({ pathname: '//example.com' })).toBeNull();
    expect(getSafeReturnLocation({ pathname: '/login' })).toBeNull();
  });
});
