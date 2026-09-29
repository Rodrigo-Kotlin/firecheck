// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useForm } from 'react-hook-form';
import { Calendar } from 'lucide-react';
import { FieldRenderer, FormField, FormSection } from './EquipmentFormPrimitives';

type Values = { status: string };

function SelectField() {
  const { register } = useForm<Values>();
  return (
    <FieldRenderer
      field={{ name: 'status', label: 'Status', type: 'select', section: 'identificacao', tipos: ['Extintor'], options: ['regular'] }}
      register={register}
      errors={{}}
    />
  );
}

describe('equipment form primitives', () => {
  afterEach(() => cleanup());

  it('renders section heading and required field error accessibly', () => {
    render(
      <FormSection title="Identificação" icon={Calendar}>
        <FormField label="Status" required error="Campo obrigatório" htmlFor="status">
          <input id="status" aria-label="Status" />
        </FormField>
      </FormSection>,
    );

    expect(screen.getByRole('heading', { name: 'Identificação' })).toBeTruthy();
    expect(screen.getByLabelText('Status')).toBeTruthy();
    expect(screen.getByLabelText('obrigatório')).toBeTruthy();
    expect(screen.getByText('Campo obrigatório')).toBeTruthy();
  });

  it('renders configured select fields through react-hook-form registration', () => {
    render(<SelectField />);

    const select = screen.getByRole('combobox', { name: 'Status' });
    expect(select).toBeTruthy();
    expect(screen.getByRole('option', { name: 'regular' })).toBeTruthy();
  });
});
