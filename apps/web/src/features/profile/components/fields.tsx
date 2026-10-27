import { FieldError } from '@/components/common/form-errors';
import type { UseFormRegister, FieldErrors } from 'react-hook-form';
import {
  occupations,
  ageRanges,
  devices,
  purposes,
  breaks,
  goalLabels,
  type OnboardingInput,
  type GoalKey,
} from '@screenwise/shared';
import { Input } from '@/components/ui/input';
export function SelectField({
  label,
  name,
  options,
  register,
  errors,
  optional = false,
}: {
  label: string;
  name:
    | 'occupation'
    | 'age_range'
    | 'primary_device'
    | 'usage_purpose'
    | 'break_frequency';
  options: readonly string[];
  register: UseFormRegister<OnboardingInput>;
  errors: FieldErrors<OnboardingInput>;
  optional?: boolean;
}) {
  return (
    <label className="block space-y-2 text-sm font-medium">
      {label}
      <select
        className="h-10 w-full rounded-md border bg-background px-3"
        aria-invalid={!!errors[name]}
        aria-describedby={errors[name] ? name + '-error' : undefined}
        {...register(name, { setValueAs: (v) => (v === '' ? null : v) })}
      >
        <option value="">
          {optional ? 'Prefer not to say' : 'Select an option'}
        </option>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
      <FieldError id={name + '-error'} message={errors[name]?.message} />
    </label>
  );
}
export function PersonalFields({
  register,
  errors,
}: {
  register: UseFormRegister<OnboardingInput>;
  errors: FieldErrors<OnboardingInput>;
}) {
  return (
    <>
      <label className="block space-y-2 text-sm font-medium">
        Full name
        <Input
          {...register('full_name')}
          aria-invalid={!!errors.full_name}
          aria-describedby={errors.full_name ? 'full_name-error' : undefined}
        />
        <FieldError id="full_name-error" message={errors.full_name?.message} />
      </label>
      <SelectField
        label="Age range (optional)"
        name="age_range"
        options={ageRanges}
        register={register}
        errors={errors}
        optional
      />
      <SelectField
        label="Occupation"
        name="occupation"
        options={occupations}
        register={register}
        errors={errors}
      />
    </>
  );
}
export function DeviceFields({
  register,
  errors,
}: {
  register: UseFormRegister<OnboardingInput>;
  errors: FieldErrors<OnboardingInput>;
}) {
  return (
    <>
      <SelectField
        label="Primary device"
        name="primary_device"
        options={devices}
        register={register}
        errors={errors}
      />
      <label className="block space-y-2 text-sm font-medium">
        Average daily screen hours
        <Input
          type="number"
          min="0"
          max="24"
          step="0.5"
          aria-invalid={!!errors.daily_screen_hours}
          aria-describedby={
            errors.daily_screen_hours ? 'daily_screen_hours-error' : undefined
          }
          {...register('daily_screen_hours', { valueAsNumber: true })}
        />
        <FieldError
          id="daily_screen_hours-error"
          message={errors.daily_screen_hours?.message}
        />
      </label>
      <SelectField
        label="Main reason for device usage"
        name="usage_purpose"
        options={purposes}
        register={register}
        errors={errors}
      />
    </>
  );
}
export function HabitFields({
  register,
  errors,
}: {
  register: UseFormRegister<OnboardingInput>;
  errors: FieldErrors<OnboardingInput>;
}) {
  return (
    <>
      <SelectField
        label="Break frequency"
        name="break_frequency"
        options={breaks}
        register={register}
        errors={errors}
      />
      {(['sleep_time', 'wake_time'] as const).map((name) => (
        <label key={name} className="block space-y-2 text-sm font-medium">
          {name === 'sleep_time' ? 'Typical sleep time' : 'Typical wake time'}{' '}
          (optional)
          <Input
            type="time"
            aria-invalid={!!errors[name]}
            aria-describedby={errors[name] ? name + '-error' : undefined}
            {...register(name, { setValueAs: (v) => v || null })}
          />
          <FieldError id={name + '-error'} message={errors[name]?.message} />
        </label>
      ))}
    </>
  );
}
export function GoalFields({
  selected,
  onChange,
}: {
  selected: GoalKey[];
  onChange: (goals: GoalKey[]) => void;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="mb-3 text-sm font-medium">
        What would you like to focus on?
      </legend>
      {(Object.entries(goalLabels) as [GoalKey, string][]).map(
        ([key, label]) => (
          <label
            key={key}
            className="flex cursor-pointer items-center gap-3 rounded-lg border p-4 text-sm"
          >
            <input
              type="checkbox"
              className="size-4 accent-indigo-500"
              checked={selected.includes(key)}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...selected, key]
                    : selected.filter((v) => v !== key),
                )
              }
            />
            {label}
          </label>
        ),
      )}
    </fieldset>
  );
}
