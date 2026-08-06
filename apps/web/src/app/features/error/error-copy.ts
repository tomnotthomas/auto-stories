import type { ErrorCode } from '@auto-stories/api-types';

/** Every failure the flow can land on, including the transport one. */
export type FailureCode = ErrorCode | 'network';

/**
 * What the user is offered next. A refusal that the same input cannot pass —
 * photos the model won't touch, an upload that was too big — must not offer a
 * retry that is certain to fail again; that is a dead end wearing a button.
 */
export type NextStep = 'retry' | 'change-photos' | 'wait';

export interface ErrorCopy {
  /** Material symbol name — the failure's face. */
  readonly icon: string;
  /** What happened, in the user's terms. */
  readonly title: string;
  /** *Why* it happened. The whole point of this screen: a limit the user
   * cannot see reads as a broken app (decision 7.36). */
  readonly why: string;
  readonly next: NextStep;
}

/**
 * The failure, explained.
 *
 * Two of these exist because the app runs on a shared free tier, and both used
 * to read as bugs: being rate limited said "slow down" (a scold, for doing
 * exactly what the app invites), and a timeout said "timed out" (which sounds
 * broken, when it is queueing behind paid traffic). Saying which it is, and
 * that the cause is the free tier rather than their photos, is the difference
 * between "this is broken" and "this is busy".
 */
const COPY: Record<FailureCode, ErrorCopy> = {
  rate_limited: {
    icon: 'hourglass_top',
    title: "That's your stories for today",
    why: 'The free tier is small and shared, so there is a cap per person and everyone gets a turn.',
    next: 'wait',
  },
  quota_exhausted: {
    icon: 'battery_alert',
    title: "Today's free stories are all used up",
    why: 'Everyone here shares one small free allowance a day, and today it has run out.',
    next: 'wait',
  },
  timeout: {
    icon: 'schedule',
    title: 'The story engine is busy',
    why: 'On the free tier our requests wait behind paid traffic, so a busy moment can run past the time limit. Nothing is wrong with your photos.',
    next: 'retry',
  },
  upstream_error: {
    icon: 'cloud_off',
    title: 'The story engine is unavailable',
    why: 'Something upstream is down. This is on our side, not your photos.',
    next: 'retry',
  },
  network: {
    icon: 'wifi_off',
    title: 'Lost the connection',
    why: "The story was being built when the connection dropped, so we can't tell how far it got.",
    next: 'retry',
  },
  safety_blocked: {
    icon: 'no_photography',
    title: "Couldn't use some of those photos",
    why: 'The model declined to work with at least one of them, and it will decline again on the same set.',
    next: 'change-photos',
  },
  empty_result: {
    icon: 'auto_stories',
    title: "Couldn't shape a story from those",
    why: "The model didn't find a thread through this set. A different mix usually does.",
    next: 'change-photos',
  },
  payload_too_large: {
    icon: 'photo_size_select_large',
    title: 'That upload was too large',
    why: 'There were too many photos, or they were too big to send in one go.',
    next: 'change-photos',
  },
  invalid_request: {
    icon: 'error_outline',
    title: "That request wasn't valid",
    why: 'Something about the photos or the story line was off, so it never reached the model.',
    next: 'change-photos',
  },
};

export function copyFor(code: FailureCode): ErrorCopy {
  return COPY[code] ?? COPY.upstream_error;
}

/**
 * "You can start another at 15:00" — the local time the refusal lifts.
 *
 * Returns null when there is nothing to promise: no time was sent, or it is
 * unparseable. Saying "shortly" instead of a time is what made the old copy
 * unactionable, so this either states a time or says nothing.
 */
export function retryTimeLabel(retryAt: string | undefined, locale?: string): string | null {
  if (!retryAt) return null;
  const at = new Date(retryAt);
  if (Number.isNaN(at.getTime())) return null;
  return at.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

/** Whether the refusal has lifted yet. Unknown times count as lifted, so a
 * missing or malformed `retryAt` can never strand the user behind a dead
 * button. */
export function canRetryAt(retryAt: string | undefined, now: number): boolean {
  if (!retryAt) return true;
  const at = new Date(retryAt).getTime();
  return Number.isNaN(at) || now >= at;
}
