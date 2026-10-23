import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import { Button, ButtonLink } from './Button';
import { TextField } from './TextField';
import { ChipGroup } from './ChipGroup';
import { RadioGroup } from './RadioGroup';

const focusRing = [
  'has-[:focus-visible]:outline-2',
  'has-[:focus-visible]:outline-offset-2',
  'has-[:focus-visible]:outline-solid',
  'has-[:focus-visible]:outline-[#808080]',
];
const options = [
  { value: 'hills', label: 'Hills' },
  { value: 'beach', label: 'Beach' },
];

function Chips() {
  const [selected, setSelected] = useState<string[]>(['beach']);
  return <ChipGroup legend="Types" options={options} selected={selected} onChange={setSelected} />;
}

function Radios() {
  const [value, setValue] = useState('hills');
  return (
    <RadioGroup legend="Type" name="type" options={options} value={value} onChange={setValue} />
  );
}

describe('ChipGroup keyboard focus', () => {
  it('tabs through unselected and selected chips with a label focus ring and toggles with Space', async () => {
    render(<Chips />);
    const user = userEvent.setup();
    const hills = screen.getByRole('checkbox', { name: 'Hills' });
    const beach = screen.getByRole('checkbox', { name: 'Beach' });
    await user.tab();
    expect(hills).toHaveFocus();
    expect(hills).toHaveClass('sr-only');
    expect(hills.closest('label')).toHaveClass(...focusRing);
    expect(hills).not.toBeChecked();
    await user.keyboard(' ');
    expect(hills).toBeChecked();
    expect(hills.closest('label')).toHaveClass(...focusRing);
    await user.tab();
    expect(beach).toHaveFocus();
    expect(beach.closest('label')).toHaveClass(...focusRing);
    await user.keyboard(' ');
    expect(beach).not.toBeChecked();
  });
});

describe('RadioGroup keyboard focus', () => {
  it('tabs to the selected option with a label focus ring and moves selection with arrow keys', async () => {
    render(<Radios />);
    const user = userEvent.setup();
    const hills = screen.getByRole('radio', { name: 'Hills' });
    const beach = screen.getByRole('radio', { name: 'Beach' });
    await user.tab();
    expect(hills).toHaveFocus();
    expect(hills).toBeChecked();
    expect(hills).toHaveClass('sr-only');
    expect(hills.closest('label')).toHaveClass(...focusRing);
    await user.keyboard('{ArrowRight}');
    expect(beach).toHaveFocus();
    expect(beach).toBeChecked();
    expect(hills).not.toBeChecked();
    expect(beach.closest('label')).toHaveClass(...focusRing);
    await user.keyboard('{ArrowLeft}');
    expect(hills).toHaveFocus();
    expect(hills).toBeChecked();
  });
});

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
