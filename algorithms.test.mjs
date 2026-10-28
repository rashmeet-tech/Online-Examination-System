import test from 'node:test';
import assert from 'node:assert/strict';
import { schedule, allocate, pageRep, banker } from '../../frontend/src/utils/osAlgorithms.js';

test('FCFS reports completion, turnaround, waiting, and response times', () => {
  const result = schedule([
    { id: 'P1', at: 0, bt: 5, pr: 2 },
    { id: 'P2', at: 1, bt: 3, pr: 1 },
    { id: 'P3', at: 2, bt: 4, pr: 3 }
  ], 'FCFS');

  assert.deepEqual(result.rows.map(({ ct, tat, wt, rt }) => ({ ct, tat, wt, rt })), [
    { ct: 5, tat: 5, wt: 0, rt: 0 },
    { ct: 8, tat: 7, wt: 4, rt: 4 },
    { ct: 12, tat: 10, wt: 6, rt: 6 }
  ]);
  assert.equal(result.avg.wt, 3.33);
});

test('Round Robin respects its quantum and jumps across idle CPU time', () => {
  const result = schedule([
    { id: 'P1', at: 0, bt: 3, pr: 0 },
    { id: 'P2', at: 1, bt: 1, pr: 0 }
  ], 'RR', 1);
  assert.deepEqual(result.g, [
    { id: 'P1', s: 0, e: 1 },
    { id: 'P2', s: 1, e: 2 },
    { id: 'P1', s: 2, e: 4 }
  ]);
  assert.deepEqual(schedule([{ id: 'P1', at: 100000, bt: 2, pr: 0 }], 'RR', 1).g, [
    { id: 'P1', s: 100000, e: 100002 }
  ]);
  assert.throws(() => schedule([{ id: 'P1', at: 0, bt: 1, pr: 0 }], 'RR', 0), /quantum/i);
  assert.throws(() => schedule([
    { id: 'P1', at: 0, bt: 1, pr: 0 },
    { id: 'P1', at: 1, bt: 1, pr: 0 }
  ], 'FCFS'), /unique/i);
});

test('First, Best, and Worst Fit allocate from the selected eligible block', () => {
  const blocks = [100, 500, 200, 300, 600];
  const processes = [212, 417, 112, 426];

  const firstFit = allocate(blocks, processes, 'FIRST');
  assert.deepEqual(firstFit.res.map(row => row.block), [2, 5, 2, null]);
  assert.equal(firstFit.internal, 0);
  assert.equal(firstFit.external, firstFit.free);
  assert.equal(firstFit.allocated + firstFit.free, blocks.reduce((sum, value) => sum + value, 0));
  assert.deepEqual(allocate(blocks, processes, 'BEST').res.map(row => row.block), [4, 2, 3, 5]);
  assert.deepEqual(allocate(blocks, processes, 'WORST').res.map(row => row.block), [5, 2, 5, null]);
  assert.throws(() => allocate([], [12], 'FIRST'), /at least one/i);
});

test('page replacement records steps and comparison counts', () => {
  const refs = [7, 0, 1, 2, 0, 3, 0, 4, 2, 3];
  const fifo = pageRep(refs, 3, 'FIFO');
  const lru = pageRep(refs, 3, 'LRU');
  const optimal = pageRep(refs, 3, 'OPT');

  assert.equal(fifo.faults, 9);
  assert.equal(fifo.steps.length, refs.length);
  assert.equal(fifo.hits + fifo.faults, refs.length);
  assert.ok(optimal.faults <= lru.faults);
  assert.ok(lru.faults <= fifo.faults);
  assert.throws(() => pageRep([1, 2], 0, 'FIFO'), /frame/i);
});

test('Banker safety check finds safe and unsafe states', () => {
  const allocation = [
    [0, 1, 0], [2, 0, 0], [3, 0, 2], [2, 1, 1], [0, 0, 2]
  ];
  const maximum = [
    [7, 5, 3], [3, 2, 2], [9, 0, 2], [2, 2, 2], [4, 3, 3]
  ];
  const safe = banker(allocation, maximum, [3, 3, 2]);
  assert.equal(safe.safe, true);
  assert.equal(safe.seq.length, allocation.length);
  assert.deepEqual(safe.need[0], [7, 4, 3]);
  assert.equal(banker([[1]], [[2]], [0]).safe, false);
  assert.throws(() => banker([[2]], [[1]], [0]), /exceed/i);
});
