import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../../src/ui/App';
import { messages } from '../../src/ui/messages.pt';

// Full pipeline (fetch template -> parse -> render form -> build preview via
// the worker -> docx-preview) is covered by the Playwright e2e suite
// (tests/e2e) against a real browser; jsdom has no Worker/fetch-of-static-
// assets support suited to that. This just checks the app mounts and shows
// its loading state without crashing.
describe('App', () => {
  it('renders the loading state on mount', () => {
    render(<App />);
    expect(screen.getByText(messages.loading)).toBeInTheDocument();
  });
});
