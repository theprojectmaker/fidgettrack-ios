import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planReminders, NUDGE_OFFSETS } from '../src/reminders';

const F = [{ id: 'f1', name: 'Blue spinner' }, { id: 'f2', name: 'Teal cube' }];
const P = [{ id: 'p1', name: 'Maya' }, { id: 'p2', name: 'Jonah' }];
const NOW = 1_700_000_000_000;
const MIN = 60_000;
const loan = (id: string, dueAt: number | null, status = 'out', fidgetId = 'f1', personId = 'p1') => ({ id, fidgetId, personId, dueAt, status });

test('a loan due in 30 minutes notifies at the due time and then keeps nudging', () => {
  const r = planReminders(F, P, [loan('a', NOW + 30 * MIN)], NOW);
  assert.equal(r.length, NUDGE_OFFSETS.length);
  assert.equal(r[0].when, NOW + 30 * MIN);
  assert.equal(r[0].title, 'Fidget due back');
  assert.match(r[0].body, /Blue spinner/);
  assert.match(r[0].body, /Maya/);
  assert.equal(r[1].when, NOW + 40 * MIN);
  assert.match(r[1].body, /10 min overdue/);
});

test('an early reminder is added when leadMin is set', () => {
  const r = planReminders(F, P, [loan('a', NOW + 30 * MIN)], NOW, 10);
  assert.equal(r[0].when, NOW + 20 * MIN);
  assert.match(r[0].body, /due back in 10 min/);
  assert.equal(r.length, NUDGE_OFFSETS.length + 1);
});

test('an early reminder that is already in the past is skipped', () => {
  const r = planReminders(F, P, [loan('a', NOW + 5 * MIN)], NOW, 15);
  assert.ok(r.every((x) => !x.id.endsWith('-pre')));
  assert.equal(r[0].when, NOW + 5 * MIN);
});

test('re-planning is stable: an overdue loan never schedules anything new right now', () => {
  const l = loan('a', NOW - 45 * MIN);
  const a = planReminders(F, P, [l], NOW);
  const b = planReminders(F, P, [l], NOW + 5 * MIN);
  // only future nudges remain, at the same absolute times and ids as before
  assert.ok(a.every((x) => x.when > NOW + 1000));
  assert.equal(a[0].when, NOW - 45 * MIN + 60 * MIN);
  assert.deepEqual(b.map((x) => x.id), a.map((x) => x.id));
});

test('wording uses hours once an hour or more overdue', () => {
  const r = planReminders(F, P, [loan('a', NOW - 10 * MIN)], NOW);
  const labels = r.map((x) => x.body);
  assert.ok(labels.some((b) => /1 hour overdue/.test(b)));
  assert.ok(labels.some((b) => /2 hours overdue/.test(b)));
});

test('returned, return-time-less and unknown-reference loans are ignored', () => {
  const r = planReminders(
    F,
    P,
    [loan('a', NOW + MIN, 'returned'), loan('b', null), loan('c', NOW + MIN, 'out', 'ghost')],
    NOW,
  );
  assert.equal(r.length, 0);
});

test('output is sorted soonest first and capped', () => {
  const loans = Array.from({ length: 20 }, (_, i) => loan('l' + i, NOW + (i + 1) * MIN));
  const r = planReminders(F, P, loans, NOW, 0, 60);
  assert.equal(r.length, 60);
  for (let i = 1; i < r.length; i++) assert.ok(r[i].when >= r[i - 1].when);
});
