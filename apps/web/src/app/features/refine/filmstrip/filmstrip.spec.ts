import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import type { Frame } from '@auto-stories/api-types';

import { RefineFilmstrip } from './filmstrip';
import { RefineFilmstripHarness } from './filmstrip.harness';
import { MAX_PHOTOS, StoryService } from '../../../story/story.service';

function imageFile(name: string): File {
  return new File(['bytes'], name, { type: 'image/jpeg' });
}

describe('RefineFilmstrip', () => {
  let fixture: ComponentFixture<RefineFilmstrip>;
  let story: StoryService;

  /** Seed `count` photos and a story whose frames reference them, in order. */
  async function render(count = 4): Promise<RefineFilmstripHarness> {
    URL.createObjectURL = () => 'blob:mock';
    URL.revokeObjectURL = () => undefined;
    await TestBed.configureTestingModule({ imports: [RefineFilmstrip] }).compileComponents();
    story = TestBed.inject(StoryService);
    story.addPhotos(Array.from({ length: count }, (_, i) => imageFile(`p${i}.jpg`)));
    const frames: Frame[] = story
      .photos()
      .map((photo, i) => ({
        photoId: photo.id,
        order: i + 1,
        caption: `caption ${i + 1}`, headline: `caption ${i + 1}`,
        style: {
          font: 'inter',
          weight: 'regular',
          case: 'normal',
          align: 'center',
          size: 'm',
          position: 'bottom-center',
          letterbox: 'blur',
        },
      }));
    story.completeStory(frames, false);
    fixture = TestBed.createComponent(RefineFilmstrip);
    return TestbedHarnessEnvironment.harnessForFixture(fixture, RefineFilmstripHarness);
  }

  afterEach(() => fixture?.destroy());

  it('shows a thumbnail per frame', async () => {
    const harness = await render(4);
    expect(await harness.getThumbnailCount()).toBe(4);
  });

  it('emits the tapped thumbnail index', async () => {
    const harness = await render(4);
    let selected = -1;
    fixture.componentInstance.select.subscribe((i) => (selected = i));
    await harness.selectThumbnail(2);
    expect(selected).toBe(2);
  });

  it('drops a frame from the story', async () => {
    const harness = await render(4);
    const dropped = story.frames()[1].photoId;
    await harness.dropThumbnail(1);
    expect(story.frames().some((f) => f.photoId === dropped)).toBe(false);
    expect(await harness.getThumbnailCount()).toBe(3);
  });

  it('offers no drop control at the minimum photo count', async () => {
    const harness = await render(3);
    expect(await harness.canDrop()).toBe(false);
  });

  it('hides the Add tile when the photo pool is full', async () => {
    const harness = await render(MAX_PHOTOS);
    expect(await harness.hasAddTile()).toBe(false);
  });

  it('reorders frames when a thumbnail is dragged', async () => {
    await render(4);
    const before = story.frames().map((f) => f.photoId);
    (fixture.componentInstance as unknown as {
      onReorder(e: { previousIndex: number; currentIndex: number }): void;
    }).onReorder({ previousIndex: 0, currentIndex: 2 });
    expect(story.frames().map((f) => f.photoId)).toEqual([before[1], before[2], before[0], before[3]]);
  });
});
