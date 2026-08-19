const STATS: Array<{ value: string; label: string }> = [
  { value: '232', label: 'public tokens, three tiers' },
  { value: '14 + 25', label: 'components + icons' },
  { value: '~1,300', label: 'tests across nine packages' },
  { value: '97 / 0', label: 'stories / axe violations' },
  { value: '21 / 21', label: 'eval pairs passing' },
  { value: '260 ms', label: 'full customer re-theme' },
  { value: '0', label: 'fabrications in agent builds' },
];

/** The numbers — measured, not aspirational (see README "What's here, measured"). */
export function Stats() {
  return (
    <section className="stats" aria-label="Measured numbers">
      <dl className="stats-band">
        {/* dt precedes dd (valid dl); CSS shows the value on top. */}
        {STATS.map((s) => (
          <div className="stat" key={s.label}>
            <dt className="stat-label">{s.label}</dt>
            <dd className="stat-value">{s.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
