import type { ColumnType } from 'antd/es/table';

export const NO_COLUMN_KEY = '__no__';

export type ColumnConfig = {
  columnKey: string;
  label: string;
  customLabel?: string;
  visible: boolean;
  order: number;
  width?: number;
  fixed?: 'left' | 'right';
};

export const NO_COLUMN: ColumnConfig = {
  columnKey: NO_COLUMN_KEY,
  label: '연번',
  visible: true,
  order: -1,
  fixed: 'left',
};

export function normalizeConfig(
  items: ColumnConfig[] | undefined,
  defaults: ColumnConfig[],
): ColumnConfig[] {
  const byKey = new Map(defaults.map((c) => [c.columnKey, c]));
  const merged: ColumnConfig[] = [];

  (items || []).forEach((c) => {
    const base = byKey.get(c.columnKey);
    merged.push({
      ...(base || c),
      ...c,
      label: c.label || base?.label || c.columnKey,
      customLabel: c.customLabel ?? base?.customLabel,
      width: c.width ?? base?.width,
      fixed: c.fixed ?? base?.fixed,
    });
  });

  defaults.forEach((c) => {
    if (!merged.find((m) => m.columnKey === c.columnKey)) {
      merged.push(c);
    }
  });

  const withoutNo = merged.filter((c) => c.columnKey !== NO_COLUMN_KEY);
  const withNo = [NO_COLUMN, ...withoutNo];
  return withNo.sort((a, b) => a.order - b.order);
}

export function buildColumns<T>(
  configs: ColumnConfig[],
  columnMap: Record<string, ColumnType<T>>,
): ColumnType<T>[] {
  return configs
    .filter((c) => c.visible)
    .sort((a, b) => a.order - b.order)
    .map((c) => {
      const base = columnMap[c.columnKey];
      if (!base) return null;
      const title = (c.customLabel && c.customLabel.trim()) || c.label || base.title;
      return { ...base, title, width: c.width ?? base.width, fixed: c.fixed ?? base.fixed };
    })
    .filter(Boolean) as ColumnType<T>[];
}
