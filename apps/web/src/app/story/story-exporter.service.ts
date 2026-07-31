import { Injectable, inject } from '@angular/core';

import { renderFrame } from './frame-renderer';
import { StoryService } from './story.service';

type ShareCapableNavigator = Navigator & {
  canShare?: (data: ShareData) => boolean;
};

/**
 * Turns the finished story into shareable images and hands them to the phone:
 * on mobile via the Web Share sheet (Save to Photos), otherwise a per-frame
 * download. The user then posts them in Instagram via Select Multiple — the
 * hand-off is human-in-the-loop by design (decisions Chapter 7).
 */
@Injectable({ providedIn: 'root' })
export class StoryExporter {
  private readonly story = inject(StoryService);

  /** Render every frame to a 1080×1920 PNG and deliver them. Returns how they
   * were delivered so the UI can show the right next-step copy. */
  async post(): Promise<'shared' | 'downloaded'> {
    const files = new Map(this.story.photos().map((photo) => [photo.id, photo.file]));
    const images: File[] = [];
    const frames = this.story.frames();
    for (let i = 0; i < frames.length; i++) {
      const source = files.get(frames[i].photoId);
      if (!source) continue;
      const blob = await renderFrame(source, frames[i]);
      images.push(new File([blob], `story-${i + 1}.png`, { type: 'image/png' }));
    }
    if (images.length === 0) return 'downloaded';

    const nav = navigator as ShareCapableNavigator;
    if (typeof nav.canShare === 'function' && nav.canShare({ files: images }) && nav.share) {
      await nav.share({ files: images, title: 'My Story' });
      return 'shared';
    }
    for (const file of images) this.download(file);
    return 'downloaded';
  }

  private download(file: File): void {
    const url = URL.createObjectURL(file);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = file.name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }
}
