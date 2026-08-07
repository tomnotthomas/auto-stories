import { canRetryAt, copyFor, retryTimeLabel, type FailureCode } from './error-copy';

const EVERY_FAILURE: FailureCode[] = [
  'invalid_request',
  'payload_too_large',
  'empty_result',
  'rate_limited',
  'quota_exhausted',
  'upstream_error',
  'safety_blocked',
  'timeout',
  'network',
];

describe('copyFor', () => {
  it('explains every failure the flow can land on', () => {
    for (const code of EVERY_FAILURE) {
      const copy = copyFor(code);
      expect(copy.title.length).toBeGreaterThan(0);
      expect(copy.why.length).toBeGreaterThan(0);
    }
  });

  it('says the free tier is why, for the two limits that are not the user’s doing', () => {
    expect(copyFor('rate_limited').why).toContain('free tier');
    expect(copyFor('quota_exhausted').why).toContain('free');
  });

  it('explains a timeout as busy rather than broken, and clears the photos of blame', () => {
    const copy = copyFor('timeout');
    expect(copy.title).not.toContain('timed out');
    expect(copy.why).toContain('free tier');
    expect(copy.why.toLowerCase()).toContain('nothing is wrong with your photos');
  });

  it('offers waiting, not retrying, when the limit has to lift first', () => {
    expect(copyFor('rate_limited').next).toBe('wait');
    expect(copyFor('quota_exhausted').next).toBe('wait');
  });

  it('never offers a retry that the same photos cannot pass', () => {
    expect(copyFor('safety_blocked').next).toBe('change-photos');
    expect(copyFor('payload_too_large').next).toBe('change-photos');
    expect(copyFor('invalid_request').next).toBe('change-photos');
  });

  it('offers a retry for the failures that are about the moment, not the input', () => {
    expect(copyFor('timeout').next).toBe('retry');
    expect(copyFor('upstream_error').next).toBe('retry');
    expect(copyFor('network').next).toBe('retry');
  });

  it('falls back to something sayable for a code it does not know', () => {
    expect(copyFor('something_new' as FailureCode).title.length).toBeGreaterThan(0);
  });
});

describe('the face each failure wears', () => {
  it('gives every failure an icon', () => {
    for (const code of EVERY_FAILURE) {
      expect(copyFor(code).icon.length).toBeGreaterThan(0);
    }
  });

  it('shows a spent allowance, not device power, when the daily quota runs out', () => {
    expect(copyFor('quota_exhausted').icon).toBe('data_usage');
  });

  it('keeps the two shared-tier limits apart — they are different failures', () => {
    expect(copyFor('quota_exhausted').icon).not.toBe(copyFor('rate_limited').icon);
  });

  it('names an invalid request with the canonical Material Symbols name', () => {
    expect(copyFor('invalid_request').icon).toBe('error');
  });

  it('uses no deprecated Material Icons aliases', () => {
    for (const code of EVERY_FAILURE) {
      expect(copyFor(code).icon).not.toMatch(/_outline$/);
    }
  });
});

describe('retryTimeLabel', () => {
  it('states a time rather than "shortly"', () => {
    const label = retryTimeLabel('2026-08-06T15:00:00.000Z', 'en-GB');
    expect(label).toMatch(/\d{2}:\d{2}/);
  });

  it('says nothing when no time was sent', () => {
    expect(retryTimeLabel(undefined)).toBeNull();
  });

  it('says nothing rather than something wrong when the time is unparseable', () => {
    expect(retryTimeLabel('not-a-date')).toBeNull();
  });
});

describe('canRetryAt', () => {
  const at = '2026-08-06T15:00:00.000Z';

  it('holds the retry until the refusal lifts', () => {
    expect(canRetryAt(at, Date.parse('2026-08-06T14:59:59.000Z'))).toBe(false);
  });

  it('releases it once the time has passed', () => {
    expect(canRetryAt(at, Date.parse('2026-08-06T15:00:00.000Z'))).toBe(true);
  });

  it('never strands the user when there is no time to wait for', () => {
    expect(canRetryAt(undefined, Date.now())).toBe(true);
    expect(canRetryAt('not-a-date', Date.now())).toBe(true);
  });
});
