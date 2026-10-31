"use client";
import { useId } from "react";
import { salesDateInput } from "@/lib/sales/dates";
export function Field({
  name,
  label,
  value,
  type = "text",
  required = false,
  children,
  step,
  instant,
}: {
  name: string;
  label: string;
  value?: string | number | null;
  type?: string;
  required?: boolean;
  children?: React.ReactNode;
  step?: string;
  instant?: Date | string | null;
}) {
  const id = useId();
  return (
    <label className="block text-xs text-[#566045]" htmlFor={id}>
      <span className="mb-2 block">{label}</span>
      {children ?? (
        <input
          className="w-full rounded border border-[#d7d4cc] bg-white p-3 text-sm text-[#252820]"
          id={id}
          name={name}
          type={type}
          defaultValue={value ?? ""}
          required={required}
          step={step ?? (type === "number" ? "0.01" : undefined)}
          min={type === "number" ? "0" : undefined}
          data-original-instant={instant ? new Date(instant).toISOString() : undefined}
          data-original-local={instant ? salesDateInput(instant) : undefined}
        />
      )}
    </label>
  );
}
export function Select({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value?: string | null;
  options: Array<{ value: string; label: string }>;
}) {
  const id = useId();
  return (
    <div className="block text-xs text-[#566045]">
      <label className="mb-2 block" htmlFor={id}>{label}</label>
      <select
        id={id}
        className="w-full rounded border border-[#d7d4cc] bg-white p-3 text-sm"
        name={name}
        defaultValue={value ?? ""}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
export function Area({
  name,
  label,
  value,
  required = false,
}: {
  name: string;
  label: string;
  value?: string | null;
  required?: boolean;
}) {
  const id = useId();
  return (
    <label className="block text-xs text-[#566045]" htmlFor={id}>
      <span className="mb-2 block">{label}</span>
      <textarea
        id={id}
        name={name}
        defaultValue={value ?? ""}
        required={required}
        rows={4}
        className="w-full rounded border border-[#d7d4cc] bg-white p-3 text-sm"
      />
    </label>
  );
}
export function Check({
  name,
  label,
  checked = false,
  required = false,
}: {
  name: string;
  label: string;
  checked?: boolean;
  required?: boolean;
}) {
  return (
    <label className="flex items-start gap-3 text-sm">
      <input
        type="checkbox"
        name={name}
        defaultChecked={checked}
        required={required}
        className="mt-1"
      />
      {label}
    </label>
  );
}
export function formRecord(form: HTMLFormElement) {
  const data = new FormData(form);
  const row: Record<string, unknown> = Object.fromEntries(data);
  for (const key of [
    "publicVisible",
    "publicPriceVisible",
    "enquiriesEnabled",
    "consent",
    "marketingConsent",
  ])
    row[key] = data.get(key) === "on";
  for (const key of [
    "features",
    "floorPlans",
    "media",
    "specifications",
    "unitIds",
  ])
    if (data.has(key))
      row[key] = data.getAll(key).flatMap(value => String(value).split(/\r?\n/))
        .map((x) => x.trim())
        .filter(Boolean);
  // Preserve the exact instant, including seconds and either side of a repeated
  // DST hour, when an existing Sydney datetime input has not been edited.
  for (const key of ["followUpAt", "depositDueAt", "settlementDueAt"]) {
    const input = form.elements.namedItem(key);
    if (input instanceof HTMLInputElement && input.dataset.originalInstant && input.value === input.dataset.originalLocal)
      row[key] = input.dataset.originalInstant;
  }
  return row;
}
export const label = (value: string) => value.replaceAll("_", " ");
export const date = salesDateInput;

export const options = (values: readonly string[]) =>
  values.map((value) => ({ value, label: label(value) }));
