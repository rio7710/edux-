import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Divider, Result, Select, Space, Switch, Table, Tag, message } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, SaveOutlined, ReloadOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';

type ColumnConfig = {
  key: string;
  label: string;
  visible: boolean;
  width?: number;
  fixed?: 'left' | 'right';
};

const TABLE_OPTIONS = [
  { value: 'courses', label: '코스' },
  { value: 'instructors', label: '강사' },
  { value: 'templates', label: '템플릿' },
  { value: 'users', label: '회원' },
  { value: 'schedules', label: '일정' },
  { value: 'lectures', label: '강의' },
];

const DEFAULT_COLUMNS: Record<string, ColumnConfig[]> = {
  courses: [
    { key: 'id', label: 'ID', visible: true },
    { key: 'title', label: '코스명', visible: true },
    { key: 'durationHours', label: '시간', visible: true },
    { key: 'isOnline', label: '온라인', visible: true },
    { key: 'createdBy', label: '등록자', visible: true },
    { key: 'actions', label: '액션', visible: true, fixed: 'right' },
  ],
  instructors: [
    { key: 'id', label: 'ID', visible: true },
    { key: 'userId', label: '사용자 ID', visible: true },
    { key: 'name', label: '이름', visible: true },
    { key: 'title', label: '직함', visible: true },
    { key: 'affiliation', label: '소속', visible: true },
    { key: 'specialties', label: '전문분야', visible: true },
    { key: 'createdBy', label: '등록자', visible: true },
    { key: 'actions', label: '액션', visible: true, fixed: 'right' },
  ],
  templates: [
    { key: 'id', label: 'ID', visible: true },
    { key: 'name', label: '템플릿명', visible: true },
    { key: 'type', label: '타입', visible: true },
    { key: 'createdBy', label: '등록자', visible: true },
    { key: 'createdAt', label: '등록일', visible: true },
    { key: 'actions', label: '액션', visible: true, fixed: 'right' },
  ],
  users: [
    { key: 'id', label: 'ID', visible: true },
    { key: 'email', label: '이메일', visible: true },
    { key: 'name', label: '이름', visible: true },
    { key: 'role', label: '권한', visible: true },
    { key: 'isActive', label: '활성', visible: true },
    { key: 'createdAt', label: '가입일', visible: true },
    { key: 'actions', label: '액션', visible: true, fixed: 'right' },
  ],
  schedules: [
    { key: 'id', label: 'ID', visible: true },
    { key: 'course', label: '코스', visible: true },
    { key: 'instructor', label: '강사', visible: true },
    { key: 'date', label: '일정', visible: true },
    { key: 'location', label: '장소', visible: true },
    { key: 'createdBy', label: '등록자', visible: true },
    { key: 'actions', label: '액션', visible: true, fixed: 'right' },
  ],
  lectures: [
    { key: 'id', label: 'ID', visible: true },
    { key: 'course', label: '코스', visible: true },
    { key: 'title', label: '강의명', visible: true },
    { key: 'hours', label: '시간', visible: true },
    { key: 'order', label: '순서', visible: true },
    { key: 'createdBy', label: '등록자', visible: true },
    { key: 'actions', label: '액션', visible: true, fixed: 'right' },
  ],
};

const STORAGE_KEY = 'edux_table_config';

export default function SiteSettingsPage() {
  const { user } = useAuth();
  const isAuthorized = user?.role === 'admin' || user?.role === 'operator';
  const [tableKey, setTableKey] = useState<string>('courses');
  const [columns, setColumns] = useState<ColumnConfig[]>([]);
  const [dirty, setDirty] = useState(false);

  const loadFromStorage = (key: string): ColumnConfig[] => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_COLUMNS[key] || [];
      const parsed = JSON.parse(raw) as Record<string, ColumnConfig[]>;
      return parsed[key] || DEFAULT_COLUMNS[key] || [];
    } catch {
      return DEFAULT_COLUMNS[key] || [];
    }
  };

  const saveToStorage = (key: string, data: ColumnConfig[]) => {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, ColumnConfig[]>) : {};
    parsed[key] = data;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
  };

  useEffect(() => {
    setColumns(loadFromStorage(tableKey));
    setDirty(false);
  }, [tableKey]);

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
      { title: '키', dataIndex: 'key', width: 200 },
      {
        title: '표시',
        dataIndex: 'visible',
        width: 120,
        render: (visible: boolean, record: ColumnConfig) => (
          <Switch
            checked={visible}
            onChange={(checked) => {
              setColumns((prev) =>
                prev.map((c) => (c.key === record.key ? { ...c, visible: checked } : c)),
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
              onClick={() => moveRow(index, 'up')}
            />
            <Button
              icon={<ArrowDownOutlined />}
              size="small"
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
            onClick={() => {
              saveToStorage(tableKey, columns);
              setDirty(false);
              message.success('설정이 저장되었습니다.');
            }}
          >
            저장
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              setColumns(DEFAULT_COLUMNS[tableKey] || []);
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
          rowKey="key"
          pagination={false}
          size="middle"
        />
      </Card>
    </div>
  );
}
