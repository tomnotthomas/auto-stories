import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';

import { CaptionEditor, draggedPosition, pinchedScale } from './caption-editor';
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

// Gesture math is unit-tested directly: jsdom returns zero-size rects and stubs
// pointer capture, so a drag/pinch can't be driven through the DOM here. The live
// gesture is verified in the browser; this locks down the arithmetic.
describe('draggedPosition (grab-offset drag)', () => {
  it('keeps the caption under the finger — the grab offset is preserved, no jump', () => {
    // Grabbed 8% left / 5% above the caption centre; moving the finger to 40,30
    // must place the centre at 40-8, 30+... i.e. offset added back, not snapped.
    const grabDX = 8; // centre was 8% to the right of the finger
    const grabDY = -5; // centre was 5% above the finger
    const { x, y } = draggedPosition(40, 30, grabDX, grabDY);
    expect(x).toBe(48);
    expect(y).toBe(25);
  });

  it('clamps within the always-visible band so the caption clears both bars', () => {
    const low = draggedPosition(-100, -100, 0, 0);
    const high = draggedPosition(200, 200, 0, 0);
    // Below the min / above the max collapse onto the band edges. The vertical
    // band stays clear of the top edit bar and the bottom sheet.
    expect(low.x).toBeGreaterThanOrEqual(0);
    expect(low.y).toBe(14);
    expect(high.x).toBeLessThanOrEqual(100);
    expect(high.y).toBe(58);
    expect(low.x).toBeLessThan(high.x);
    expect(low.y).toBeLessThan(high.y);
  });

  it('clamps X so the centred 78%-wide caption box never leaves the frame', () => {
    // The box is w-[78%] centred on x, so its half-width is 39% of the frame.
    const halfWidth = 39;
    const farLeft = draggedPosition(-100, 30, 0, 0);
    const farRight = draggedPosition(200, 30, 0, 0);
    expect(farLeft.x - halfWidth).toBeGreaterThanOrEqual(0);
    expect(farRight.x + halfWidth).toBeLessThanOrEqual(100);
  });
});

describe('pinchedScale (two-finger resize)', () => {
  it('scales in proportion to how far the fingers spread', () => {
    // Fingers moved from 100px apart to 150px apart → 1.5× the start scale.
    expect(pinchedScale(1, 100, 150)).toBe(1.5);
  });

  it('shrinks when the fingers come together', () => {
    expect(pinchedScale(1, 200, 100)).toBe(0.6); // 0.5 clamped up to the floor
  });

  it('clamps to the slider range so text never vanishes or overflows', () => {
    expect(pinchedScale(1.5, 100, 400)).toBe(1.8); // would be 6, clamped to max
    expect(pinchedScale(1, 100, 10)).toBe(0.6); // would be 0.1, clamped to min
  });

  it('holds the start scale if the start distance is degenerate (no divide-by-zero)', () => {
    expect(pinchedScale(1.2, 0, 120)).toBe(1.2);
  });
});
