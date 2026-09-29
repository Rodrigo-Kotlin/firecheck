import type { ReactNode } from 'react';
import type { FieldErrors, FieldValues, UseFormRegister } from 'react-hook-form';
import { AlertCircle, type LucideIcon } from 'lucide-react';
import { type FieldConfig } from '../../constants/equipmentFormConfig';
import type { Path } from 'react-hook-form';

export type FormSectionProps = {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
};

export function FormSection({ title, icon: Icon, children }: FormSectionProps) {
  return (
    <div className="card-subtle bg-white">
      <div className="flex items-center gap-2.5 border-b border-gray-50 pb-3 mb-5">
        <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4" />
        </span>
        <h2 className="label-uppercase">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

export type FormFieldProps = {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
};

export function FormField({ label, required, error, hint, htmlFor, children }: FormFieldProps) {
  return (
    <div>
      <label htmlFor={htmlFor} className="field-label flex items-baseline gap-1">
        <span>{label}</span>
        {required && <span className="text-critical text-xs font-black" aria-label="obrigatório">*</span>}
      </label>
      {children}
      {error ? (
        <span className="field-error flex items-center gap-1 mt-1.5">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{error}</span>
        </span>
      ) : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}

type FieldRendererProps<T extends FieldValues> = {
  field: FieldConfig;
  register: UseFormRegister<T>;
  errors: FieldErrors<T>;
};

export function FieldRenderer<T extends FieldValues>({ field, register, errors }: FieldRendererProps<T>) {
  const error = errors[field.name]?.message;
  const fieldPath = field.name as Path<T>;

  if (field.type === 'select' && field.options) {
    return (
      <FormField key={field.name} label={field.label} error={String(error ?? '') || undefined} htmlFor={field.name}>
        <select id={field.name} {...register(fieldPath)} className={`field-input ${error ? 'border-critical' : ''}`}>
          <option value="">Selecione...</option>
          {field.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </FormField>
    );
  }

  if (field.type === 'date') {
    return (
      <FormField key={field.name} label={field.label} error={String(error ?? '') || undefined} htmlFor={field.name}>
        <input id={field.name} type="date" {...register(fieldPath)} className={`field-input ${error ? 'border-critical' : ''}`} />
      </FormField>
    );
  }

  return (
    <FormField key={field.name} label={field.label} error={String(error ?? '') || undefined} htmlFor={field.name}>
      <input id={field.name} type="text" {...register(fieldPath)} placeholder={field.placeholder} className={`field-input ${error ? 'border-critical' : ''}`} />
    </FormField>
  );
}
