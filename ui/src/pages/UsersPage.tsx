import { useState, useEffect } from 'react';
import {
  Button,
  Table,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  message,
  Space,
  Tag,
} from 'antd';
import type { ColumnType } from 'antd/es/table';
import {
  EditOutlined,
  EyeOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { api, mcpClient } from '../api/mcpClient';
import { useAuth } from '../contexts/AuthContext';
import { useTableConfig } from '../hooks/useTableConfig';
import { buildColumns, NO_COLUMN_KEY } from '../utils/tableConfig';
import { DEFAULT_COLUMNS } from '../utils/tableDefaults';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'operator' | 'editor' | 'instructor' | 'viewer' | 'guest';
  isActive: boolean;
  provider?: string;
  lastLoginAt?: string;
  createdAt?: string;
}

const roleColors: Record<string, string> = {
  admin: 'red',
  operator: 'orange',
  editor: 'green',
  instructor: 'blue',
  viewer: 'cyan',
  guest: 'default',
};

const roleLabels: Record<string, string> = {
  admin: '관리자',
  operator: '운영자',
  editor: '편집자',
  instructor: '강의자',
  viewer: '사용자(뷰어)',
  guest: '게스트',
};

const roleOptions = [
  { label: '관리자 (admin)', value: 'admin' },
  { label: '운영자 (operator)', value: 'operator' },
  { label: '편집자 (editor)', value: 'editor' },
  { label: '강의자 (instructor)', value: 'instructor' },
  { label: '사용자(뷰어) (viewer)', value: 'viewer' },
  { label: '게스트 (guest)', value: 'guest' },
];

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [viewUser, setViewUser] = useState<User | null>(null);
  const [form] = Form.useForm();
  const { accessToken, user: currentUser } = useAuth();
  const { configs: columnConfigs } = useTableConfig(
    'users',
    DEFAULT_COLUMNS.users,
  );

  const loadUsers = async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const result = (await api.userList(accessToken || '', 100, 0)) as {
        users: User[];
        total: number;
      };
      setUsers(result.users);
      setTotal(result.total);
    } catch (error) {
      console.error('Failed to load users:', error);
      message.error('사용자 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!accessToken || currentUser?.role !== 'admin') return;
      try {
        if (!mcpClient.isConnected()) {
          await mcpClient.connect();
        }
        if (!cancelled) {
          await loadUsers();
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to connect/load users:', error);
          message.error('사용자 목록을 불러오지 못했습니다.');
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [accessToken, currentUser?.role]);

  const updateMutation = useMutation({
    mutationFn: (data: {
      userId: string;
      name?: string;
      role?: 'admin' | 'operator' | 'editor' | 'instructor' | 'viewer' | 'guest';
      isActive?: boolean;
    }) =>
      api.userUpdateByAdmin({
        token: accessToken || '',
        userId: data.userId,
        name: data.name,
        role: data.role,
        isActive: data.isActive,
      }),
    onSuccess: async (result: unknown) => {
      console.log('[UsersPage] user.updateByAdmin result:', result);
      const updated = result as Partial<User> | undefined;
      message.success('사용자 정보가 수정되었습니다.');
      setIsModalOpen(false);
      form.resetFields();
      setEditingUser(null);
      if (updated?.id) {
        setUsers((prev) =>
          prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)),
        );
        setViewUser((prev) =>
          prev && prev.id === updated.id ? { ...prev, ...updated } : prev,
        );
        const finalUser = await fetchUserAndSync(updated.id);
        console.log('[UsersPage] Updated user (final):', finalUser);
      } else {
        loadUsers();
      }
    },
    onError: (error: Error) => {
      message.error(`수정 실패: ${error.message}`);
    },
  });

  const fetchUserAndSync = async (userId: string) => {
    if (!accessToken) {
      message.error('인증 토큰이 없습니다.');
      return null;
    }
    try {
      const result = (await api.userGet(accessToken, userId)) as User;
      console.log('[UsersPage] user.get result:', result);
      setUsers((prev) =>
        prev.map((u) => (u.id === result.id ? { ...u, ...result } : u)),
      );
      return result;
    } catch (error) {
      const messageText =
        error instanceof Error ? error.message : '알 수 없는 오류';
      message.error(`조회 실패: ${messageText}`);
      return null;
    }
  };

  const handleEdit = async (user: User) => {
    if (user.id === currentUser?.id) {
      message.warning('자신의 정보는 프로필 설정에서 수정해주세요.');
      return;
    }
    const result = await fetchUserAndSync(user.id);
    if (!result) return;
    setViewUser(null);
    setEditingUser(result);
    form.setFieldsValue({
      name: result.name,
      role: result.role,
      isActive: result.isActive,
    });
    setIsModalOpen(true);
  };

  const handleView = async (user: User) => {
    const result = await fetchUserAndSync(user.id);
    if (!result) return;
    setEditingUser(null);
    setIsModalOpen(false);
    setViewUser(result);
  };

  const handleSubmit = async () => {
    try {
      console.log('[UsersPage] Modal OK clicked');
      const values = await form.validateFields();
      if (!editingUser) return;
      console.log('[UsersPage] Update submit payload:', {
        userId: editingUser.id,
        name: values.name,
        role: values.role,
        isActive: values.isActive,
      });
      updateMutation.mutate({
        userId: editingUser.id,
        name: values.name,
        role: values.role as 'admin' | 'operator' | 'editor' | 'instructor' | 'viewer' | 'guest',
        isActive: values.isActive,
      });
    } catch (error) {
      console.log('[UsersPage] Validation failed:', error);
    }
  };

  const columnMap: Record<string, ColumnType<User>> = {
    [NO_COLUMN_KEY]: {
      title: 'No',
      key: NO_COLUMN_KEY,
      width: 60,
      render: (_: unknown, __: User, index: number) => index + 1,
    },
    id: { title: 'ID', dataIndex: 'id', key: 'id', width: 200, ellipsis: true },
    email: { title: '이메일', dataIndex: 'email', key: 'email', width: 200, ellipsis: true },
    name: { title: '이름', dataIndex: 'name', key: 'name' },
    role: {
      title: '역할',
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: (role: string) => (
        <Tag color={roleColors[role]}>{roleLabels[role]}</Tag>
      ),
    },
    isActive: {
      title: '계정 상태',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 80,
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? '활성' : '비활성'}
        </Tag>
      ),
    },
    provider: {
      title: '가입 경로',
      dataIndex: 'provider',
      key: 'provider',
      width: 120,
      render: (provider: string | undefined) => provider || '-',
    },
    createdAt: {
      title: '가입일',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string | undefined) =>
        date ? new Date(date).toLocaleString('ko-KR') : '-',
    },
    lastLoginAt: {
      title: '마지막 로그인',
      dataIndex: 'lastLoginAt',
      key: 'lastLoginAt',
      width: 180,
      render: (date: string | undefined) =>
        date ? new Date(date).toLocaleString('ko-KR') : '-',
    },
    actions: {
      title: '액션',
      key: 'action',
      width: 100,
      render: (_: unknown, record: User) => (
        <Space>
          <Button
            icon={<EyeOutlined />}
            size="small"
            onClick={() => handleView(record)}
          />
          <Button
            icon={<EditOutlined />}
            size="small"
            onClick={() => handleEdit(record)}
            disabled={record.id === currentUser?.id}
          />
        </Space>
      ),
    },
  };
  const columns = buildColumns<User>(columnConfigs, columnMap);

  return (
    <div>
      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <h2 style={{ margin: 0 }}>회원 목록</h2>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={loadUsers}
            loading={loading}
          >
            새로고침
          </Button>
          <Input.Search
            placeholder="사용자 이메일로 조회"
            onSearch={(email) => {
              if (email) {
                const user = users.find((u) => u.email.includes(email));
                if (user) {
                  handleView(user);
                } else {
                  message.warning('해당 사용자를 찾을 수 없습니다.');
                }
              }
            }}
            style={{ width: 250 }}
          />
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={users}
        loading={loading}
        rowKey="id"
        pagination={{
          pageSize: 50,
          showSizeChanger: true,
          showTotal: () => `총 ${total}명`,
        }}
      />

      {/* 수정 모달 */}
      <Modal
        title={editingUser ? '사용자 정보 수정' : '새 사용자 등록'}
        open={isModalOpen}
        onOk={handleSubmit}
        onCancel={() => {
          setIsModalOpen(false);
          form.resetFields();
          setEditingUser(null);
        }}
        confirmLoading={updateMutation.isPending}
        width={500}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="이메일">
            <Input value={editingUser?.email} disabled />
          </Form.Item>

          <Form.Item label="사용자 ID">
            <Input
              value={editingUser?.id}
              disabled
              style={{ fontSize: '12px' }}
            />
          </Form.Item>

          <Form.Item
            name="name"
            label="이름"
            rules={[
              { required: true, message: '이름을 입력하세요.' },
            ]}
          >
            <Input placeholder="사용자 이름" />
          </Form.Item>

          <Form.Item
            name="role"
            label="역할"
            rules={[{ required: true, message: '역할을 선택하세요.' }]}
          >
            <Select options={roleOptions} />
          </Form.Item>

          <Form.Item
            name="isActive"
            label="계정 상태"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* 조회 모달 */}
      <Modal
        title="사용자 상세"
        open={!!viewUser}
        onCancel={() => setViewUser(null)}
        footer={[
          <Button key="close" onClick={() => setViewUser(null)}>
            닫기
          </Button>,
          <Button
            key="edit"
            type="primary"
            onClick={() => {
              if (viewUser) {
                handleEdit(viewUser);
                setViewUser(null);
              }
            }}
            disabled={viewUser?.id === currentUser?.id}
          >
            수정
          </Button>,
        ]}
        width={500}
      >
        {viewUser && (
          <div>
            <p>
              <strong>ID:</strong> {viewUser.id}
            </p>
            <p>
              <strong>이메일:</strong> {viewUser.email}
            </p>
            <p>
              <strong>이름:</strong> {viewUser.name}
            </p>
            <p>
              <strong>역할:</strong>{' '}
              <Tag color={roleColors[viewUser.role]}>
                {roleLabels[viewUser.role]}
              </Tag>
            </p>
            <p>
              <strong>계정 상태:</strong>{' '}
              <Tag color={viewUser.isActive ? 'green' : 'red'}>
                {viewUser.isActive ? '활성' : '비활성'}
              </Tag>
            </p>
            <p>
              <strong>마지막 로그인:</strong>{' '}
              {viewUser.lastLoginAt
                ? new Date(viewUser.lastLoginAt).toLocaleString('ko-KR')
                : '-'}
            </p>
            <p>
              <strong>가입일:</strong>{' '}
              {viewUser.createdAt
                ? new Date(viewUser.createdAt).toLocaleString('ko-KR')
                : '-'}
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
