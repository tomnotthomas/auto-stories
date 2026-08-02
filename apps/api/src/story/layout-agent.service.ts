import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { GoogleGenAI, Part } from '@google/genai';
import type { Frame, Photo, Tone } from '@auto-stories/api-types';

import { normalizeLayout } from './caption-style';
import { buildLayoutPrompt } from './layout-prompt.builder';
import { LAYOUT_RESPONSE_SCHEMA } from './layout.schema';
import {
  DEFAULT_MODEL,
  DEFAULT_TIMEOUT_MS,
  GENAI,
  PROXY_MIME_TYPE,
} from './story.constants';

/** Context the agent needs about the whole story to art-direct each frame. */
export interface ComposeOptions {
  readonly story: string;
  readonly tone?: Tone;
  /** Optional user-set atmosphere; inferred per frame when absent. */
  readonly atmosphere?: string;
}

/**
 * The layout agent (decision 7.21): a dedicated art-direction pass that runs
 * AFTER the story is assembled. For each frame it asks the model — looking at the
 * actual photo — to compose bespoke typography (a {@link Frame.layout}), validates
 * it with `normalizeLayout`, and threads the recent lead anchors forward so no two
 * frames repeat a composition. A frame whose call fails simply keeps no layout and
 * falls back to the caption/style render — never a hard failure.
 *
 * SCAFFOLD: the orchestration here is unit-tested with a mocked model, but the
 * VISUAL quality of the output depends entirely on the live model and must be
 * tuned on a machine with a GOOGLE_CLOUD_API_KEY (see buildLayoutPrompt). It is
 * gated OFF by default (LAYOUT_AGENT_ENABLED) so nothing ships unverified.
 */
@Injectable()
export class LayoutAgentService {
  private readonly logger = new Logger(LayoutAgentService.name);
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(
    @Inject(GENAI) private readonly genai: GoogleGenAI,
    config: ConfigService,
  ) {
    this.model = config.get<string>('MODEL', DEFAULT_MODEL);
    this.timeoutMs = config.get<number>(
      'GENERATION_TIMEOUT_MS',
      DEFAULT_TIMEOUT_MS,
    );
  }

  /** Attach an art-directed `layout` to each frame, in order. Best-effort per
   * frame: a failure leaves that frame untouched (legacy caption render). */
  async composeLayouts(
    frames: Frame[],
    photos: readonly Photo[],
    opts: ComposeOptions,
  ): Promise<Frame[]> {
    const photoById = new Map(photos.map((photo) => [photo.id, photo]));
    const out: Frame[] = [];
    const recentAnchors: string[] = [];

    for (const frame of frames) {
      const photo = photoById.get(frame.photoId);
      if (!photo) {
        out.push(frame);
        continue;
      }
      try {
        const prompt = buildLayoutPrompt({
          story: opts.story,
          caption: frame.caption,
          atmosphere: opts.atmosphere,
          tone: opts.tone,
          frameNo: frame.order,
          frameCount: frames.length,
          avoidAnchors: recentAnchors.slice(-2),
        });
        const layout = normalizeLayout(await this.callLayout(prompt, photo));
        if (layout) {
          out.push({ ...frame, layout });
          const lead =
            layout.elements.find((e) => e.role === 'title') ??
            layout.elements[0];
          if (lead) recentAnchors.push(lead.anchor);
        } else {
          out.push(frame);
        }
      } catch (err) {
        this.logger.warn(
          `Layout agent failed for ${frame.photoId}; keeping the legacy caption. ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        out.push(frame);
      }
    }
    return out;
  }

  /** One model call: the art-direction brief plus this frame's photo → raw JSON. */
  private async callLayout(prompt: string, photo: Photo): Promise<unknown> {
    const parts: Part[] = [
      { text: prompt },
      { inlineData: { mimeType: PROXY_MIME_TYPE, data: photo.b64 } },
    ];
    const response = await this.genai.models.generateContent({
      model: this.model,
      contents: [{ role: 'user', parts }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: LAYOUT_RESPONSE_SCHEMA,
        abortSignal: AbortSignal.timeout(this.timeoutMs),
      },
    });
    if (!response.text) return undefined;
    try {
      return JSON.parse(response.text);
    } catch {
      return undefined;
    }
  }
}
