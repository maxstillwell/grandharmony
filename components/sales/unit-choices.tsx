import type { Unit } from "./types";

export function UnitChoices({ units, selected = [] }: { units: Unit[]; selected?: string[] }) {
  return <fieldset className="space-y-3">
    <legend className="text-sm">Interested residences</legend>
    <p className="text-xs">Choose up to 10 recorded units. Internal selections do not publish a residence.</p>
    <input type="hidden" name="unitIds" value="" />
    <div className="grid max-h-56 gap-3 overflow-auto rounded border p-3 sm:grid-cols-2">
      {units.map(unit => <label key={unit.id} className="flex items-center gap-3 text-sm">
        <input type="checkbox" name="unitIds" value={unit.id} defaultChecked={selected.includes(unit.id)} />
        Residence {unit.number}
      </label>)}
      {!units.length && <p className="text-sm">No inventory recorded. A general enquiry can still be saved with consent.</p>}
    </div>
  </fieldset>;
}
