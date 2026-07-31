import { describe, expect, it } from 'vitest';
import {
  groupCellsForPhone,
  mobileRoleOf,
  type MobileRole,
} from '../data-table-mobile.service.ts';

const cell = (meta?: { mobile?: MobileRole; grow?: boolean }) => ({
  column: { columnDef: { meta } },
});

describe('mobileRoleOf', () => {
  it('makes the growing column the title, without the table saying so twice', () => {
    expect(mobileRoleOf(cell({ grow: true }))).toBe('title');
  });

  it('treats an undeclared column as a supporting detail', () => {
    expect(mobileRoleOf(cell())).toBe('detail');
    expect(mobileRoleOf(cell({}))).toBe('detail');
  });

  it('lets a column say what it is', () => {
    expect(mobileRoleOf(cell({ mobile: 'figure' }))).toBe('figure');
    expect(mobileRoleOf(cell({ mobile: 'hidden' }))).toBe('hidden');
    expect(mobileRoleOf(cell({ mobile: 'actions' }))).toBe('actions');
  });

  it('lets an explicit role override the one grow would have implied', () => {
    expect(mobileRoleOf(cell({ grow: true, mobile: 'detail' }))).toBe('detail');
  });
});

describe('groupCellsForPhone', () => {
  const title = cell({ grow: true });
  const figure = cell({ mobile: 'figure' });
  const severity = cell();
  const frequency = cell();
  const buried = cell({ mobile: 'hidden' });
  const actions = cell({ mobile: 'actions' });

  const grouped = groupCellsForPhone([title, figure, severity, frequency, buried, actions]);

  it('picks out the title and the figure', () => {
    expect(grouped.title).toBe(title);
    expect(grouped.figure).toBe(figure);
  });

  it('keeps the details in the order the columns were declared', () => {
    expect(grouped.details).toEqual([severity, frequency]);
  });

  it('leaves hidden columns out of every group', () => {
    expect(grouped.details).not.toContain(buried);
    expect(grouped.actions).not.toContain(buried);
    expect(grouped.title).not.toBe(buried);
  });

  it('collects the actions', () => {
    expect(grouped.actions).toEqual([actions]);
  });

  it('copes with a table that declares nothing at all', () => {
    const grouped = groupCellsForPhone([cell(), cell()]);

    expect(grouped.title).toBeUndefined();
    expect(grouped.figure).toBeUndefined();
    expect(grouped.details).toHaveLength(2);
  });
});
