// Pure reminder-planning logic, shared by the native shell (App.tsx) and the tests.
// The WebView owns the data (IndexedDB) and posts a snapshot to native. This turns it into
// the iOS local notifications to schedule. Times are absolute (anchored to each loan's due
// time), so re-planning on every sync never makes a new notification fire by itself.

export interface Named { id: string; name: string; }
export interface LoanLite { id: string; fidgetId: string; personId: string; dueAt: number | null; status: string; }
export interface Reminder { id: string; title: string; body: string; when: number; fidgetId: string; }

const MIN = 60_000;
// Minutes after the due time at which to nudge again while the fidget is still out.
export const NUDGE_OFFSETS = [0, 10, 30, 60, 120, 240, 480, 1440];

function overdueLabel(min: number): string {
  if (min < 60) return `${min} min`;
  if (min < 1440) {
    const h = min / 60;
    return h === 1 ? '1 hour' : `${h} hours`;
  }
  return '1 day';
}

/** Notifications for every fidget that is out and has a return time. Future times only, soonest first. */
export function planReminders(
  fidgets: Named[],
  people: Named[],
  loans: LoanLite[],
  now: number,
  leadMin = 0,
  cap = 60, // iOS keeps at most 64 pending local notifications
): Reminder[] {
  const fName = new Map(fidgets.map((f) => [f.id, f.name]));
  const pName = new Map(people.map((p) => [p.id, p.name]));
  const out: Reminder[] = [];
  for (const l of loans) {
    if (l.status !== 'out' || !l.dueAt) continue;
    const f = fName.get(l.fidgetId);
    const p = pName.get(l.personId);
    if (!f || !p) continue;
    const add = (key: string, when: number, title: string, body: string) => {
      if (when > now + 1000) out.push({ id: `fidget-${l.id}-${key}`, fidgetId: l.fidgetId, when, title, body });
    };
    if (leadMin > 0) add('pre', l.dueAt - leadMin * MIN, 'Fidget due back soon', `"${f}" is due back in ${leadMin} min. ${p} has it.`);
    for (const o of NUDGE_OFFSETS) {
      add(
        'd' + o,
        l.dueAt + o * MIN,
        o === 0 ? 'Fidget due back' : 'Collect your fidget',
        o === 0 ? `"${f}" is due back now. ${p} has it.` : `"${f}" is ${overdueLabel(o)} overdue. ${p} has it.`,
      );
    }
  }
  return out.sort((a, b) => a.when - b.when).slice(0, cap);
}
