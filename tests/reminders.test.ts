import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planReminders } from '../src/reminders';

const F = [
  { id: 'f1', name: 'Blue spinner' },
  { id: 'f2', name: 'Teal cube' },
];
const P = [
  { id: 'p1', name: 'Maya' },
  { id: 'p2', name: 'Jonah' },
];
const NOW = 1_700_000_000_000;
const DAY = 86_400_000;

test('a future due loan is scheduled at its due time', () => {
  const r = planReminders(F, P, [{ id: 'l1', fidgetId: 'f1', personId: 'p1', dueAt: NOW + DAY, status: 'out' }], NOW);
  assert.equal(r.length, 1);
  assert.equal(r[0].id, 'fidget-l1');
  assert.equal(r[0].when, NOW + DAY);
  assert.equal(r[0].title, 'Fidget due back');
  assert.match(r[0].body, /Blue spinner/);
  assert.match(r[0].body, /Maya/);
});

test('an overdue loan is nudged just after the sync', () => {
  const r = planReminders(F, P, [{ id: 'l2', fidgetId: 'f2', personId: 'p2', dueAt: NOW - DAY, status: 'out' }], NOW);
  assert.equal(r.length, 1);
  assert.equal(r[0].title, 'Collect your fidget');
  assert.ok(r[0].when > NOW && r[0].when < NOW + 60_000);
  assert.match(r[0].body, /overdue/);
});

test('returned, due-less, and unknown-reference loans are ignored', () => {
  const r = planReminders(
    F,
    P,
    [
      { id: 'a', fidgetId: 'f1', personId: 'p1', dueAt: NOW + 1000, status: 'returned' },
      { id: 'b', fidgetId: 'f1', personId: 'p1', dueAt: null, status: 'out' },
      { id: 'c', fidgetId: 'ghost', personId: 'p1', dueAt: NOW + 1000, status: 'out' },
    ],
    NOW,
  );
  assert.equal(r.length, 0);
});
