/**
 * Committed BASELINE (raw Tailwind reference, ADR-005 "vs. raw shadcn/Tailwind
 * baseline"): what a generic agent produces with no design system. Scored on
 * every benchmark run for comparison; expected to lose on token compliance.
 */
export function SettingsForm() {
  return (
    <form className="flex flex-col gap-4 p-6 max-w-md">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-700">Display name</span>
        <input className="rounded-md border border-gray-300 px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-700">Email</span>
        <input type="email" className="rounded-md border border-gray-300 px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-700">Timezone</span>
        <select className="rounded-md border border-gray-300 px-3 py-2">
          <option>UTC</option>
          <option>US Eastern</option>
          <option>Central European</option>
        </select>
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" />
        <span className="text-sm">Email me about product updates</span>
      </label>
      <div className="flex gap-2 mt-4">
        <button className="rounded-md bg-blue-600 px-4 py-2 text-white">Save</button>
        <button className="rounded-md border border-gray-300 px-4 py-2">Cancel</button>
      </div>
    </form>
  );
}
