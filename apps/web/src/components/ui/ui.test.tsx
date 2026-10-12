import { render, screen } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import { Button, ButtonLink } from './Button';
import { TextField } from './TextField';

describe('TextField', () => {
  it('associates the label with the input', () => {
    render(<TextField label="Email" />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('links hint and error through aria-describedby', () => {
    render(<TextField label="Password" hint="At least 12 characters" error="Too short" />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const ids = input.getAttribute('aria-describedby')?.split(' ') ?? [];
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(document.getElementById(id)).not.toBeNull();
    expect(screen.getByText('Too short')).toBeInTheDocument();
  });
});

describe('Button', () => {
  it('disables while loading and keeps an accessible name', () => {
    render(<Button loading>Sign in</Button>);
    const btn = screen.getByRole('button', { name: /sign in/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});

describe('ButtonLink', () => {
  it('renders a link styled as a button', () => {
    const router = createMemoryRouter([
      { path: '/', element: <ButtonLink to="/trips">Go</ButtonLink> },
    ]);
    render(<RouterProvider router={router} />);
    expect(screen.getByRole('link', { name: 'Go' })).toHaveAttribute('href', '/trips');
  });
});
