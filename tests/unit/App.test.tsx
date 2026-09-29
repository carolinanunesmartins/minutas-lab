import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../../src/ui/App';

describe('App', () => {
  it('renders the app title', () => {
    render(<App />);
    expect(screen.getByText('minutas-lab')).toBeInTheDocument();
  });
});
