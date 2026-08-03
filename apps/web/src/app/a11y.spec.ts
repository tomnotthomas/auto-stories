import { Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import type { Frame } from '@auto-stories/api-types';

import { expectNoAxeViolations } from '../testing/axe';
import { StoryService } from './story/story.service';
import { StoryGateway, GenerateOutcome } from './story/story.gateway';
import { ImageService } from './story/image.service';

import { Example } from './features/example/example';
import { Create } from './features/create/create';
import { Story } from './features/story/story';
import { StoryHarness } from './features/story/story.harness';
import { Generating } from './features/generating/generating';
import { ErrorScreen } from './features/error/error-screen';

function imageFile(name: string): File {
  return new File(['bytes'], name, { type: 'image/jpeg' });
}

const FRAMES: Frame[] = [
  { photoId: 'a', order: 1, caption: 'Everyone made it to the lake', headline: 'Everyone made it to the lake', style: { font: 'inter', weight: 'regular', case: 'normal', align: 'center', size: 'm', position: 'bottom-center', letterbox: 'blur' } },
  { photoId: 'b', order: 2, caption: 'Then she blew out the candle', headline: 'Then she blew out the candle', style: { font: 'inter', weight: 'regular', case: 'normal', align: 'center', size: 'm', position: 'bottom-center', letterbox: 'blur' } },
  { photoId: 'c', order: 3, caption: 'And every cousin cheered', headline: 'And every cousin cheered', style: { font: 'inter', weight: 'regular', case: 'normal', align: 'center', size: 'm', position: 'bottom-center', letterbox: 'blur' } },
];

describe('Accessibility (WCAG 2 A/AA)', () => {
  let fixture: ComponentFixture<unknown>;

  beforeEach(() => {
    // jsdom has no object-URL support; stub it so photo state is testable.
    URL.createObjectURL = () => 'blob:mock';
    URL.revokeObjectURL = () => undefined;
  });

  afterEach(() => fixture?.destroy());

  async function render<T>(component: Type<T>): Promise<ComponentFixture<T>> {
    await TestBed.configureTestingModule({ imports: [component] }).compileComponents();
    const f = TestBed.createComponent(component);
    fixture = f as ComponentFixture<unknown>;
    f.detectChanges();
    return f;
  }

  it('example (first-open wow) has no violations', async () => {
    const f = await render(Example);
    await expectNoAxeViolations(f.nativeElement);
  });

  it('create — empty state has no violations', async () => {
    const f = await render(Create);
    await expectNoAxeViolations(f.nativeElement);
  });

  it('create — with photos picked has no violations', async () => {
    await TestBed.configureTestingModule({ imports: [Create] }).compileComponents();
    const story = TestBed.inject(StoryService);
    story.addPhotos([imageFile('a.jpg'), imageFile('b.jpg'), imageFile('c.jpg')]);
    story.setStoryLine('Maya turns one at the lake');
    fixture = TestBed.createComponent(Create);
    fixture.detectChanges();
    await expectNoAxeViolations(fixture.nativeElement);
  });

  it('generating screen has no violations', async () => {
    const gateway: Pick<StoryGateway, 'generate' | 'streamStory'> = {
      generate: async () => ({ ok: true, jobId: 'job-1' }),
      streamStory: async (): Promise<GenerateOutcome> => ({
        ok: true,
        response: { frames: FRAMES, look: 'magazine-masthead' },
      }),
    };
    const images: Pick<ImageService, 'toProxies'> = { toProxies: async () => [{ id: 'p1', b64: 'x' }] };
    await TestBed.configureTestingModule({
      imports: [Generating],
      providers: [
        { provide: ImageService, useValue: images },
        { provide: StoryGateway, useValue: gateway },
      ],
    }).compileComponents();
    const story = TestBed.inject(StoryService);
    story.addPhotos([imageFile('a.jpg'), imageFile('b.jpg')]);
    fixture = TestBed.createComponent(Generating);
    fixture.detectChanges();
    await expectNoAxeViolations(fixture.nativeElement);
  });

  it('error screen has no violations', async () => {
    await TestBed.configureTestingModule({ imports: [ErrorScreen] }).compileComponents();
    TestBed.inject(StoryService).failStory({ code: 'quota_exhausted', message: "We're at capacity." });
    fixture = TestBed.createComponent(ErrorScreen);
    fixture.detectChanges();
    await expectNoAxeViolations(fixture.nativeElement);
  });

  describe('payoff / refine', () => {
    async function renderStory(): Promise<{ fixture: ComponentFixture<Story>; harness: StoryHarness }> {
      await TestBed.configureTestingModule({ imports: [Story] }).compileComponents();
      TestBed.inject(StoryService).completeStory(FRAMES, true);
      const f = TestBed.createComponent(Story);
      fixture = f as ComponentFixture<unknown>;
      const harness = await TestbedHarnessEnvironment.harnessForFixture(f, StoryHarness);
      return { fixture: f, harness };
    }

    it('payoff view has no violations', async () => {
      const { fixture: f } = await renderStory();
      await expectNoAxeViolations(f.nativeElement);
    });

    it('refine mode has no violations', async () => {
      const { fixture: f, harness } = await renderStory();
      await harness.clickRefine();
      await expectNoAxeViolations(f.nativeElement);
    });

    it('caption editor has no violations', async () => {
      const { fixture: f, harness } = await renderStory();
      await harness.clickRefine();
      await harness.tapCaption();
      await expectNoAxeViolations(f.nativeElement);
    });

    it('reorder & remove screen has no violations', async () => {
      const { fixture: f, harness } = await renderStory();
      await harness.clickRefine();
      await harness.clickManage();
      await expectNoAxeViolations(f.nativeElement);
    });
  });
});
