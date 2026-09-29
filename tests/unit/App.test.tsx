import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../../src/ui/App';
import { messages } from '../../src/ui/messages.pt';
import { TEMPLATE_MANIFEST } from '../../src/ui/templateManifest';

// Full pipeline (fetch template -> parse -> render form -> build preview via
// the worker -> docx-preview) is covered by the Playwright e2e suite
// (tests/e2e) against a real browser; jsdom has no Worker/fetch-of-static-
// assets support suited to that. This just checks the app mounts and shows
// its initial template-picker state without crashing.
describe('App', () => {
  it('renders the template picker on mount, listing every manifest entry', () => {
    render(<App />);
    expect(screen.getByText(messages.pickTemplateTitle)).toBeInTheDocument();
    for (const entry of TEMPLATE_MANIFEST) {
      expect(screen.getByRole('button', { name: entry.title })).toBeInTheDocument();
    }
  });
});
