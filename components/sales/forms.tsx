"use client";
import { useId } from "react";
export function Field({
  name,
  label,
  value,
  type = "text",
  required = false,
  children,
}: {
  name: string;
  label: string;
  value?: string | number | null;
  type?: string;
  required?: boolean;
  children?: React.ReactNode;
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
          step={type === "number" ? "0.01" : undefined}
          min={type === "number" ? "0" : undefined}
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
    <label className="block text-xs text-[#566045]" htmlFor={id}>
      <span className="mb-2 block">{label}</span>
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
    </label>
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
      row[key] = String(data.get(key))
        .split(/\r?\n/)
        .map((x) => x.trim())
        .filter(Boolean);
  return row;
}
export const label = (value: string) => value.replaceAll("_", " ");
export const date = (value: Date | string | null) =>
  value ? new Date(value).toISOString().slice(0, 16) : "";

export const options = (values: readonly string[]) =>
  values.map((value) => ({ value, label: label(value) }));
