import axe, { type Result, type RunOptions } from 'axe-core';

/** WCAG 2.0 + 2.1, levels A and AA — the accessibility bar CLAUDE.md sets. */
const WCAG_AA_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const OPTIONS: RunOptions = {
  runOnly: { type: 'tag', values: WCAG_AA_TAGS },
  // jsdom does no layout or painting, so axe can't measure contrast here; it's a
  // false/indeterminate signal in unit tests. Contrast is checked live in the
  // browser instead. Everything structural (names, roles, labels, alt text,
  // aria, duplicate ids, list/heading structure) is checked.
  rules: { 'color-contrast': { enabled: false } },
};

/**
 * Run axe-core against a rendered component element and throw a readable report
 * if any WCAG-A/AA violations are found. Attaches the element to the document
 * while it runs (axe needs it in the tree), then restores.
 */
export async function expectNoAxeViolations(root: HTMLElement): Promise<void> {
  const wasConnected = root.isConnected;
  if (!wasConnected) document.body.appendChild(root);
  try {
    const { violations } = await axe.run(root, OPTIONS);
    if (violations.length > 0) throw new Error(format(violations));
  } finally {
    if (!wasConnected) root.remove();
  }
}

function format(violations: Result[]): string {
  return [
    `${violations.length} accessibility violation(s):`,
    ...violations.map(
      (v) =>
        `  • [${v.impact}] ${v.id} — ${v.help}\n` +
        v.nodes.map((n) => `      at: ${n.target.join(' ')}`).join('\n'),
    ),
  ].join('\n');
}
