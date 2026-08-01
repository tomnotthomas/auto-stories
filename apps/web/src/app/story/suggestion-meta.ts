import type { SuggestionTypeEnum } from '@auto-stories/api-types';

/** How each add-on type reads in the UI: its Material icon and the human verb
 * ("Location", "Mention", …). Shared by the sparks overlay and the hand-off
 * checklist so both name a suggestion the same way. The `query` is the exact
 * text the user copies into Instagram's own search. */
export const SUGGESTION_META: Record<
  SuggestionTypeEnum,
  { readonly icon: string; readonly label: string }
> = {
  location: { icon: 'location_on', label: 'Location' },
  mention: { icon: 'alternate_email', label: 'Mention' },
  gif: { icon: 'gif_box', label: 'GIF' },
  poll: { icon: 'poll', label: 'Poll' },
  music: { icon: 'music_note', label: 'Music' },
};
