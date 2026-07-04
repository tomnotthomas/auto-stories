import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';

import { CaptionEditor } from './caption-editor';
import { CaptionEditorHarness } from './caption-editor.harness';
import { DEFAULT_PLACEMENT, FramePlacement } from '../../../story/story.service';

interface Overrides {
  caption?: string;
  placement?: FramePlacement;
  legibility?: boolean;
  busy?: boolean;
  demo?: boolean;
}

describe('CaptionEditor', () => {
  let fixture: ComponentFixture<CaptionEditor>;

  async function render(overrides: Overrides = {}): Promise<{
    harness: CaptionEditorHarness;
    instance: CaptionEditor;
  }> {
    await TestBed.configureTestingModule({
      imports: [CaptionEditor],
    }).compileComponents();

    fixture = TestBed.createComponent(CaptionEditor);
    const ref = fixture.componentRef;
    ref.setInput('caption', overrides.caption ?? 'By the water');
    ref.setInput('placement', overrides.placement ?? DEFAULT_PLACEMENT);
    ref.setInput('legibility', overrides.legibility ?? true);
    ref.setInput('busy', overrides.busy ?? false);
    ref.setInput('demo', overrides.demo ?? false);
    fixture.detectChanges();

    const harness = await TestbedHarnessEnvironment.harnessForFixture(fixture, CaptionEditorHarness);
    return { harness, instance: fixture.componentInstance };
  }

  afterEach(() => fixture?.destroy());

  it('shows the caption ready to edit', async () => {
    const { harness } = await render({ caption: 'One candle' });
    expect(await harness.getCaption()).toBe('One candle');
  });

  it('emits the rewritten caption as the user edits', async () => {
    const { harness, instance } = await render();
    let edited = '';
    instance.captionChange.subscribe((value) => (edited = value));
    await harness.setCaption('Rewritten by hand');
    expect(edited).toBe('Rewritten by hand');
  });

  it('emits a scale change when the size slider moves', async () => {
    const { harness, instance } = await render();
    let placement: Partial<FramePlacement> | null = null;
    instance.placementChange.subscribe((value) => (placement = value));
    await harness.setSize(1.5);
    expect(placement).toEqual({ scale: 1.5 });
  });

  it('emits a legibility toggle', async () => {
    const { harness, instance } = await render();
    let toggled = false;
    instance.legibilityToggle.subscribe(() => (toggled = true));
    await harness.toggleLegibility();
    expect(toggled).toBe(true);
  });

  it('asks for a regenerate when the button is pressed', async () => {
    const { harness, instance } = await render();
    let asked = false;
    instance.regenerate.subscribe(() => (asked = true));
    await harness.clickRegenerate();
    expect(asked).toBe(true);
  });

  it('disables regenerate while a regenerate is in flight', async () => {
    const { harness } = await render({ busy: true });
    expect(await harness.isRegenerateDisabled()).toBe(true);
  });

  it('hides regenerate on the first-open example (demo mode)', async () => {
    const { harness } = await render({ demo: true });
    expect(await harness.hasRegenerate()).toBe(false);
  });

  it('emits done when the user finishes', async () => {
    const { harness, instance } = await render();
    let done = false;
    instance.done.subscribe(() => (done = true));
    await harness.clickDone();
    expect(done).toBe(true);
  });
});
