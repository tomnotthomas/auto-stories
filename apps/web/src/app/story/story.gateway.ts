import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  ErrorCode,
  ErrorResponse,
  GenerateRequest,
  GenerateResponse,
} from '@auto-stories/api-types';

/** URI-path-versioned endpoint served from the same origin as the app (3.12). */
export const GENERATE_URL = '/api/v1/generate';

/**
 * The result of a generate call — a discriminated union so callers branch on
 * `ok` without try/catch. `code` carries the contract's typed ErrorCode (or
 * `network` for a transport failure) so the UI can show a specific message (4.3).
 */
export type GenerateOutcome =
  | { readonly ok: true; readonly response: GenerateResponse }
  | { readonly ok: false; readonly code: ErrorCode | 'network'; readonly message: string };

/** Thin HTTP client for the generate endpoint. Holds no state. */
@Injectable({ providedIn: 'root' })
export class StoryGateway {
  private readonly http = inject(HttpClient);

  async generate(request: GenerateRequest): Promise<GenerateOutcome> {
    try {
      const response = await firstValueFrom(
        this.http.post<GenerateResponse>(GENERATE_URL, request),
      );
      return { ok: true, response };
    } catch (err) {
      return this.toOutcome(err);
    }
  }

  /** Map a failed request to a typed outcome — the server's ErrorCode when it
   * sent one, otherwise a generic network error. */
  private toOutcome(err: unknown): GenerateOutcome {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as ErrorResponse | null;
      if (body?.error?.code) {
        return { ok: false, code: body.error.code, message: body.error.message };
      }
    }
    return { ok: false, code: 'network', message: 'Something went wrong. Please try again.' };
  }
}
