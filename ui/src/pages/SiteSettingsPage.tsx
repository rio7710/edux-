import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Divider, Result, Select, Space, Switch, Table, Tag, Input, Tabs, InputNumber, Upload, message } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, SaveOutlined, ReloadOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/mcpClient';
import { NO_COLUMN_KEY, normalizeConfig } from '../utils/tableConfig';
import type { ColumnConfig } from '../utils/tableConfig';
import { DEFAULT_COLUMNS } from '../utils/tableDefaults';
import type { RcFile } from 'antd/es/upload';

const TABLE_OPTIONS = [
  { value: 'courses', label: '코스' },
  { value: 'instructors', label: '강사' },
  { value: 'templates', label: '템플릿' },
  { value: 'users', label: '회원' },
  { value: 'schedules', label: '일정' },
  { value: 'lectures', label: '강의' },
];

export default function SiteSettingsPage() {
  const { user, accessToken, issueTestToken } = useAuth();
  const isAuthorized = user?.role === 'admin' || user?.role === 'operator';
  const [tableKey, setTableKey] = useState<string>('courses');
  const [columns, setColumns] = useState<ColumnConfig[]>([]);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [extendMinutes, setExtendMinutes] = useState(10);
  const [extendDirty, setExtendDirty] = useState(false);
  const [faviconUrl, setFaviconUrl] = useState<string>('');
  const [faviconDirty, setFaviconDirty] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [logoDirty, setLogoDirty] = useState(false);
  const [siteTitle, setSiteTitle] = useState<string>('Edux - HR 강의 계획서 관리');
  const [titleDirty, setTitleDirty] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!accessToken) return;
      try {
        const result = (await api.siteSettingGet(accessToken, 'favicon_url')) as {
          value: string | null;
        };
        if (!cancelled) {
          setFaviconUrl(result?.value || '');
          setFaviconDirty(false);
        }
      } catch {
        if (!cancelled) {
          setFaviconUrl('');
          setFaviconDirty(false);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!accessToken) return;
      try {
        const result = (await api.siteSettingGet(accessToken, 'logo_url')) as {
          value: string | null;
        };
        if (!cancelled) {
          setLogoUrl(result?.value || '');
          setLogoDirty(false);
        }
      } catch {
        if (!cancelled) {
          setLogoUrl('');
          setLogoDirty(false);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!accessToken) return;
      try {
        const result = (await api.siteSettingGet(accessToken, 'site_title')) as {
          value: string | null;
        };
        if (!cancelled) {
          setSiteTitle(result?.value || 'Edux - HR 강의 계획서 관리');
          setTitleDirty(false);
        }
      } catch {
        if (!cancelled) {
          setSiteTitle('Edux - HR 강의 계획서 관리');
          setTitleDirty(false);
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
              <>
                <Alert
                  type="info"
                  showIcon
                  message="기본관리"
                  description="사이트 공통 설정을 이 탭에서 관리합니다."
                  style={{ marginBottom: 16 }}
                />
                <Card>
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
                      <Button
                        disabled={user?.role !== 'admin'}
                        onClick={async () => {
                          try {
                            const minutes = await issueTestToken(1);
                            message.success(`테스트 토큰 발급: ${minutes}분`);
                          } catch (err: any) {
                            message.error(`테스트 실패: ${err.message}`);
                          }
                        }}
                      >
                        관리자 세션 테스트(1분)
                      </Button>
                    </Space>
                  </div>
                  <Divider />
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>파비콘 변경</div>
                    <Space>
                      <Upload
                        showUploadList={false}
                        accept="image/*,.ico,.svg"
                        beforeUpload={async (file: RcFile) => {
                          try {
                            const result = await api.uploadFile(file);
                            setFaviconUrl(result.url);
                            setFaviconDirty(true);
                            message.success('파비콘 업로드 완료');
                          } catch (err: any) {
                            message.error(`업로드 실패: ${err.message}`);
                          }
                          return false;
                        }}
                      >
                        <Button>파일 선택</Button>
                      </Upload>
                      <Input value={faviconUrl || ''} readOnly style={{ width: 320 }} />
                      <Button
                        type="primary"
                        disabled={!faviconDirty}
                        onClick={() => {
                          if (!accessToken) {
                            message.error('로그인이 필요합니다.');
                            return;
                          }
                          api.siteSettingUpsert({
                            token: accessToken,
                            key: 'favicon_url',
                            value: faviconUrl || '',
                          })
                            .then(() => {
                              setFaviconDirty(false);
                              window.dispatchEvent(
                                new CustomEvent('siteFaviconUpdated', {
                                  detail: faviconUrl || '',
                                }),
                              );
                              message.success('파비콘 설정이 저장되었습니다.');
                            })
                            .catch((err: Error) => {
                              message.error(`저장 실패: ${err.message}`);
                            });
                        }}
                      >
                        저장
                      </Button>
                      <Button
                        onClick={() => {
                          setFaviconUrl('');
                          setFaviconDirty(true);
                        }}
                      >
                        기본값 복원
                      </Button>
                    </Space>
                    <div style={{ marginTop: 8, color: '#999' }}>
                      저장 후 새로고침 시 기본 파비콘이 변경됩니다.
                    </div>
                  </div>
                  <Divider />
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>로고 변경</div>
                    <Space>
                      <Upload
                        showUploadList={false}
                        accept="image/*,.svg"
                        beforeUpload={async (file: RcFile) => {
                          try {
                            const result = await api.uploadFile(file);
                            setLogoUrl(result.url);
                            setLogoDirty(true);
                            message.success('로고 업로드 완료');
                          } catch (err: any) {
                            message.error(`업로드 실패: ${err.message}`);
                          }
                          return false;
                        }}
                      >
                        <Button>파일 선택</Button>
                      </Upload>
                      <Input value={logoUrl || ''} readOnly style={{ width: 320 }} />
                      <Button
                        type="primary"
                        disabled={!logoDirty}
                        onClick={() => {
                          if (!accessToken) {
                            message.error('로그인이 필요합니다.');
                            return;
                          }
                          api.siteSettingUpsert({
                            token: accessToken,
                            key: 'logo_url',
                            value: logoUrl || '',
                          })
                            .then(() => {
                              setLogoDirty(false);
                              window.dispatchEvent(
                                new CustomEvent('siteLogoUpdated', {
                                  detail: logoUrl || '',
                                }),
                              );
                              message.success('로고 설정이 저장되었습니다.');
                            })
                            .catch((err: Error) => {
                              message.error(`저장 실패: ${err.message}`);
                            });
                        }}
                      >
                        저장
                      </Button>
                      <Button
                        onClick={() => {
                          setLogoUrl('');
                          setLogoDirty(true);
                        }}
                      >
                        기본값 복원
                      </Button>
                    </Space>
                  </div>
                  <Divider />
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>사이트 타이틀</div>
                    <Space>
                      <Input
                        value={siteTitle}
                        onChange={(e) => {
                          setSiteTitle(e.target.value);
                          setTitleDirty(true);
                        }}
                        style={{ width: 360 }}
                      />
                      <Button
                        type="primary"
                        disabled={!titleDirty}
                        onClick={() => {
                          if (!accessToken) {
                            message.error('로그인이 필요합니다.');
                            return;
                          }
                          api.siteSettingUpsert({
                            token: accessToken,
                            key: 'site_title',
                            value: siteTitle || 'Edux - HR 강의 계획서 관리',
                          })
                            .then(() => {
                              setTitleDirty(false);
                              window.dispatchEvent(
                                new CustomEvent('siteTitleUpdated', {
                                  detail:
                                    siteTitle || 'Edux - HR 강의 계획서 관리',
                                }),
                              );
                              message.success('사이트 타이틀이 저장되었습니다.');
                            })
                            .catch((err: Error) => {
                              message.error(`저장 실패: ${err.message}`);
                            });
                        }}
                      >
                        저장
                      </Button>
                      <Button
                        onClick={() => {
                          setSiteTitle('Edux - HR 강의 계획서 관리');
                          setTitleDirty(true);
                        }}
                      >
                        기본값 복원
                      </Button>
                    </Space>
                  </div>
                </Space>
                </Card>
              </>
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
                  message="목차관리"
                  description="테이블 컬럼 표시/순서를 공통 설정으로 관리합니다."
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
