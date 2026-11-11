// Pure reminder-planning logic, shared by the native shell (App.tsx) and the tests.
// The WebView owns the data (IndexedDB); it posts a lightweight snapshot to native,
// and this turns it into the set of iOS local notifications to schedule.

export interface Named { id: string; name: string; }
export interface LoanLite { id: string; fidgetId: string; personId: string; dueAt: number | null; status: string; }
export interface Reminder { id: string; title: string; body: string; when: number; fidgetId: string; }

/** One scheduled notification per out-on-loan fidget that has a due date. */
export function planReminders(fidgets: Named[], people: Named[], loans: LoanLite[], now: number): Reminder[] {
  const fName = new Map(fidgets.map((f) => [f.id, f.name]));
  const pName = new Map(people.map((p) => [p.id, p.name]));
  const out: Reminder[] = [];
  for (const l of loans) {
    if (l.status !== 'out' || !l.dueAt) continue;
    const f = fName.get(l.fidgetId);
    const p = pName.get(l.personId);
    if (!f || !p) continue;
    const overdue = l.dueAt < now;
    out.push({
      id: 'fidget-' + l.id,
      fidgetId: l.fidgetId,
      // Future loans fire at the due time; already-overdue ones nudge a few seconds
      // after this sync (you can't schedule in the past), so opening the app reminds you.
      when: overdue ? now + 8000 : l.dueAt,
      title: overdue ? 'Collect your fidget' : 'Fidget due back',
      body: overdue ? `"${f}" is overdue — ${p} has it.` : `"${f}" is due back today — ${p} has it.`,
    });
  }
  return out;
}
