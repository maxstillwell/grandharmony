"use client";
import type { Shared } from "./types";
import { Area, Check, Field, formRecord } from "./forms";
export function Settings({ data, run, pending }: Shared) {
  const settings = data.settings;
  return (
    <section className="portal-card">
      <h2>Project configuration</h2>
      <form
        key={String(settings?.updatedAt)}
        className="mt-5 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void run("configure", formRecord(e.currentTarget));
        }}
      >
        <Field
          name="publicKey"
          label="Public project key (for example golfview)"
          value={settings?.publicKey}
          required
        />
        <Field
          name="expectedUnits"
          label="Planned capacity (Golfview anticipates 47; no records are generated)"
          value={settings?.expectedUnits}
        />
        <Field
          name="privacyVersion"
          label="Approved privacy notice version"
          value={settings?.privacyVersion}
        />
        <Area
          name="privacyNotice"
          label="Owner-approved project privacy notice"
          value={settings?.privacyNotice}
        />
        <Check
          name="enquiriesEnabled"
          label="Enable website enquiries after privacy approval and secure server configuration"
          checked={settings?.enquiriesEnabled}
        />
        <button className="portal-button" disabled={pending}>
          Save configuration
        </button>
      </form>
    </section>
  );
}
