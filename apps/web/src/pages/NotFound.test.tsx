import { render, screen } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import { routes } from '../routes';

describe('NotFound', () => {
  it('renders for an unknown path', () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/nowhere'] });
    render(<RouterProvider router={router} />);
    expect(screen.getByText('Page not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute('href', '/');
  });
});
