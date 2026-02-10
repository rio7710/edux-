import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Divider, Result, Select, Space, Switch, Table, Tag, Input, Tabs, InputNumber, message } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, SaveOutlined, ReloadOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/mcpClient';
import { NO_COLUMN_KEY, normalizeConfig } from '../utils/tableConfig';
import type { ColumnConfig } from '../utils/tableConfig';
import { DEFAULT_COLUMNS } from '../utils/tableDefaults';

const TABLE_OPTIONS = [
  { value: 'courses', label: '코스' },
  { value: 'instructors', label: '강사' },
  { value: 'templates', label: '템플릿' },
  { value: 'users', label: '회원' },
  { value: 'schedules', label: '일정' },
  { value: 'lectures', label: '강의' },
];

export default function SiteSettingsPage() {
  const { user, accessToken } = useAuth();
  const isAuthorized = user?.role === 'admin' || user?.role === 'operator';
  const [tableKey, setTableKey] = useState<string>('courses');
  const [columns, setColumns] = useState<ColumnConfig[]>([]);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [extendMinutes, setExtendMinutes] = useState(10);
  const [extendDirty, setExtendDirty] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        if (accessToken) {
          const result = await api.tableConfigGet(accessToken, tableKey) as { items: ColumnConfig[] };
          const normalized = normalizeConfig(result.items || [], DEFAULT_COLUMNS[tableKey] || []);
          if (!cancelled) {
            setColumns(normalized);
            setDirty(false);
          }
        } else {
          const normalized = normalizeConfig([], DEFAULT_COLUMNS[tableKey] || []);
          if (!cancelled) {
            setColumns(normalized);
            setDirty(false);
          }
        }
      } catch {
        const normalized = normalizeConfig([], DEFAULT_COLUMNS[tableKey] || []);
        if (!cancelled) {
          setColumns(normalized);
          setDirty(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [tableKey]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!accessToken) return;
      try {
        const result = (await api.siteSettingGet(accessToken, 'session_extend_minutes')) as {
          value: number | null;
        };
        const minutes =
          typeof result?.value === 'number'
            ? result.value
            : Number((result as any)?.value?.minutes) || 10;
        if (!cancelled) {
          setExtendMinutes(minutes);
          setExtendDirty(false);
        }
      } catch {
        if (!cancelled) {
          setExtendMinutes(10);
          setExtendDirty(false);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const moveRow = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= columns.length) return;
    const next = [...columns];
    const temp = next[index];
    next[index] = next[target];
    next[target] = temp;
    setColumns(next);
    setDirty(true);
  };

  const tableColumns = useMemo(
    () => [
      {
        title: '순서',
        dataIndex: 'order',
        width: 80,
        render: (_: unknown, __: ColumnConfig, index: number) => <Tag>{index + 1}</Tag>,
      },
      { title: '컬럼', dataIndex: 'label' },
      {
        title: '라벨(커스텀)',
        dataIndex: 'customLabel',
        width: 220,
        render: (_: unknown, record: ColumnConfig) => (
          <Input
            placeholder={record.label}
            value={record.customLabel || ''}
            disabled={record.columnKey === NO_COLUMN_KEY}
            onChange={(e) => {
              const value = e.target.value;
              setColumns((prev) =>
                prev.map((c) => (c.columnKey === record.columnKey ? { ...c, customLabel: value } : c)),
              );
              setDirty(true);
            }}
          />
        ),
      },
      { title: '키', dataIndex: 'key', width: 200 },
      {
        title: '표시',
        dataIndex: 'visible',
        width: 120,
        render: (visible: boolean, record: ColumnConfig) => (
          <Switch
            checked={visible}
            disabled={record.columnKey === NO_COLUMN_KEY}
            onChange={(checked) => {
              setColumns((prev) =>
                prev.map((c) => (c.columnKey === record.columnKey ? { ...c, visible: checked } : c)),
              );
              setDirty(true);
            }}
          />
        ),
      },
      {
        title: '순서 변경',
        dataIndex: 'actions',
        width: 140,
        render: (_: unknown, __: ColumnConfig, index: number) => (
          <Space>
            <Button
              icon={<ArrowUpOutlined />}
              size="small"
              disabled={index === 0}
              onClick={() => moveRow(index, 'up')}
            />
            <Button
              icon={<ArrowDownOutlined />}
              size="small"
              disabled={index === 0}
              onClick={() => moveRow(index, 'down')}
            />
          </Space>
        ),
      },
    ],
    [columns],
  );

  if (!isAuthorized) {
    return (
      <Result
        status="403"
        title="권한 없음"
        subTitle="관리자 또는 운영자만 접근할 수 있습니다."
      />
    );
  }

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>사이트 관리</h2>

      <Tabs
        defaultActiveKey="outline"
        items={[
          {
            key: 'basic',
            label: '기본관리',
            children: (
              <Card>
                <Alert
                  type="info"
                  showIcon
                  message="기본관리 (더미)"
                  description="향후 사이트 공통 설정을 이 탭에서 관리합니다."
                  style={{ marginBottom: 16 }}
                />
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>세션 연장 시간(분)</div>
                    <Space>
                      <InputNumber
                        min={1}
                        max={120}
                        value={extendMinutes}
                        onChange={(val) => {
                          setExtendMinutes(Number(val || 10));
                          setExtendDirty(true);
                        }}
                      />
                      <Button
                        type="primary"
                        disabled={!extendDirty}
                        onClick={() => {
                          if (!accessToken) {
                            message.error('로그인이 필요합니다.');
                            return;
                          }
                          api.siteSettingUpsert({
                            token: accessToken,
                            key: 'session_extend_minutes',
                            value: extendMinutes,
                          })
                            .then(() => {
                              setExtendDirty(false);
                              message.success('세션 연장 시간이 저장되었습니다.');
                            })
                            .catch((err: Error) => {
                              message.error(`저장 실패: ${err.message}`);
                            });
                        }}
                      >
                        저장
                      </Button>
                    </Space>
                  </div>
                </Space>
              </Card>
            ),
          },
          {
            key: 'outline',
            label: '목차관리',
            children: (
              <>
                <Alert
                  type="info"
                  showIcon
                  message="프론트 우선 구현"
                  description="현재는 로컬 저장(LocalStorage)만 지원합니다. 백엔드 연동 후 전 사용자 공통 설정으로 반영됩니다."
                  style={{ marginBottom: 16 }}
                />

                <Card>
                  <Space style={{ marginBottom: 16 }}>
                  <Select
                    value={tableKey}
                    onChange={(val) => setTableKey(val)}
                    options={TABLE_OPTIONS}
                    style={{ width: 200 }}
                    />
                    <Button
                      icon={<SaveOutlined />}
                      type="primary"
                      disabled={!dirty}
                      loading={loading}
                      onClick={() => {
                        const withoutNo = columns.filter((c) => c.columnKey !== NO_COLUMN_KEY);
                      if (!accessToken) {
                        message.error('로그인이 필요합니다.');
                        return;
                      }
                        api.tableConfigUpsert({
                          token: accessToken,
                          tableKey,
                          columns: withoutNo.map((c, index) => ({
                            columnKey: c.columnKey,
                            label: c.label,
                            customLabel: c.customLabel || undefined,
                            visible: c.visible,
                            order: index + 1,
                            width: c.width ?? undefined,
                            fixed: c.fixed ?? undefined,
                          })),
                        }).then(() => {
                          setDirty(false);
                          message.success('설정이 저장되었습니다.');
                        }).catch((err: Error) => {
                          message.error(`저장 실패: ${err.message}`);
                        });
                      }}
                    >
                      저장
                    </Button>
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={() => {
                        const base = DEFAULT_COLUMNS[tableKey] || [];
                        setColumns(normalizeConfig([], base));
                        setDirty(true);
                      }}
                    >
                      기본값 복원
                    </Button>
                  </Space>

                  <Divider style={{ margin: '12px 0' }} />

                  <Table
                    columns={tableColumns}
                    dataSource={columns}
                    rowKey="columnKey"
                    pagination={false}
                    size="middle"
                  />
                </Card>
              </>
            ),
          },
        ]}
      />
    </div>
  );
}
