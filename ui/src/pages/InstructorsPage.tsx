import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Button,
  Table,
  Modal,
  Form,
  Input,
  message,
  Space,
  Select,
  Divider,
  Avatar,
  Alert,
  Tooltip,
  Result,
} from 'antd';
import type { ColumnType } from 'antd/es/table';
import {
  PlusOutlined,
  EditOutlined,
  EyeOutlined,
  ReloadOutlined,
  SettingOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api/mcpClient';
import { useAuth } from '../contexts/AuthContext';
import { useSitePermissions } from '../hooks/useSitePermissions';
import { useTableConfig } from '../hooks/useTableConfig';
import { buildColumns, NO_COLUMN_KEY } from '../utils/tableConfig';
import { DEFAULT_COLUMNS } from '../utils/tableDefaults';
import type { RcFile } from 'antd/es/upload';
import { useLocation, useNavigate } from 'react-router-dom';
import AvatarUploadField from '../components/AvatarUploadField';
import InstructorCareerSection from '../components/InstructorCareerSection';
import { isAuthErrorMessage, parseMcpError } from '../utils/error';

interface Degree {
  name: string;
  school: string;
  major: string;
  year: string;
  fileUrl?: string;
}

interface Career {
  company: string;
  role: string;
  period: string;
  description?: string;
}

interface Publication {
  title: string;
  type: string;
  year?: string;
  publisher?: string;
  url?: string;
}

interface Certification {
  name: string;
  issuer?: string;
  date?: string;
  fileUrl?: string;
}

interface Instructor {
  id: string;
  userId?: string;
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  affiliation?: string;
  avatarUrl?: string;
  tagline?: string;
  bio?: string;
  specialties?: string[];
  certifications?: Certification[];
  awards?: string[];
  links?: Record<string, string>;
  degrees?: Degree[];
  careers?: Career[];
  publications?: Publication[];
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  Courses?: { id: string; title: string }[];
}

const SERVER_URL = '';
const toOptionalString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const extractYearScore = (value?: string): number | null => {
  if (!value) return null;
  const matches = value.match(/\b(19|20)\d{2}\b/g);
  if (!matches || matches.length === 0) return null;
  return Math.max(...matches.map((year) => Number(year)));
};

const extractDateScore = (value?: string): number | null => {
  if (!value) return null;
  const normalized = value.trim().replace(/\./g, '-').replace(/\//g, '-');
  const withDay = /^\d{4}-\d{1,2}$/.test(normalized) ? `${normalized}-01` : normalized;
  const timestamp = Date.parse(withDay);
  if (!Number.isNaN(timestamp)) return timestamp;
  const year = extractYearScore(value);
  return year ? Date.UTC(year, 0, 1) : null;
};

const pickLatestByScore = <T,>(
  values: T[] | undefined,
  scoreGetter: (item: T) => number | null,
): T | null => {
  if (!Array.isArray(values) || values.length === 0) return null;
  let bestIndex = -1;
  let bestScore = Number.NEGATIVE_INFINITY;

  values.forEach((item, index) => {
    const score = scoreGetter(item);
    if (score === null) return;
    if (score > bestScore || (score === bestScore && index > bestIndex)) {
      bestScore = score;
      bestIndex = index;
    }
  });

  if (bestIndex >= 0) return values[bestIndex] ?? null;
  return values[values.length - 1] ?? null;
};

const pickLatestText = (values?: string[]): string | null => {
  if (!Array.isArray(values) || values.length === 0) return null;
  for (let i = values.length - 1; i >= 0; i -= 1) {
    const candidate = values[i]?.trim();
    if (candidate) return candidate;
  }
  return null;
};

export default function InstructorsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInstructor, setEditingInstructor] = useState<Instructor | null>(null);
  const [viewInstructor, setViewInstructor] = useState<Instructor | null>(null);
  const [form] = Form.useForm();
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const { accessToken, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { configs: columnConfigs } = useTableConfig(
    'instructors',
    DEFAULT_COLUMNS.instructors,
  );
  const isAdminOperator = user?.role === 'admin' || user?.role === 'operator';
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string; role: string }>>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const draftPromptOpenRef = useRef(false);
  const { canAccessMenu, canUseFeature } = useSitePermissions(user?.role);
  const canAccessInstructorsMenu = canAccessMenu('instructors');
  const canUpsertInstructorBySite = canUseFeature('instructors', 'instructor.upsert');

  const draftKey = useMemo(() => 'draft:instructor', []);

  const saveDraft = (values?: Record<string, unknown>) => {
    const raw = values || form.getFieldsValue();
    const payload = {
      ...raw,
      id: editingInstructor?.id || (raw.id as string) || undefined,
      avatarUrl,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(draftKey, JSON.stringify(payload));
  };

  const loadDraft = () => {
    const stored = localStorage.getItem(draftKey);
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  };

  const clearDraft = () => {
    localStorage.removeItem(draftKey);
  };

  const isAuthError = (messageText: string) => isAuthErrorMessage(messageText);

  const handleSessionExpired = (reason?: string) => {
    saveDraft();
    Modal.confirm({
      title: '세션이 만료되었습니다',
      content:
        reason
          ? `작성 중인 내용을 임시 저장했습니다. (${reason})`
          : '작성 중인 내용을 임시 저장했습니다. 다시 로그인해주세요.',
      okText: '로그인으로 이동',
      cancelButtonProps: { style: { display: 'none' } },
      onOk: () => {
        logout();
        navigate('/login');
      },
    });
  };

  const loadInstructors = async () => {
    if (!accessToken) {
      setInstructors([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const result = await api.instructorList(accessToken) as { instructors: Instructor[]; total: number };
      setInstructors(result.instructors);
    } catch (error) {
      console.error('Failed to load instructors:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!accessToken) {
      setInstructors([]);
      setLoading(false);
      return;
    }
    void loadInstructors();
  }, [accessToken]);

  useEffect(() => {
    const handler = () => {
      saveDraft();
    };
    window.addEventListener('sessionExpired', handler);
    return () => {
      window.removeEventListener('sessionExpired', handler);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const draftParam = params.get('draft');
    if (!draftParam) return;
    const draft = loadDraft();
    if (!draft) return;
    form.setFieldsValue(draft);
    setEditingInstructor(draft.id ? ({ id: draft.id } as Instructor) : null);
    setAvatarUrl(draft.avatarUrl || '');
    setIsModalOpen(true);
  }, [location.search]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('create') !== '1') return;
    handleCreate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const loadUsers = async (): Promise<Array<{ id: string; name: string; email: string; role: string }>> => {
    if (!accessToken) return [];
    try {
      setUsersLoading(true);
      const result = await api.userList(accessToken, 100, 0) as { users: Array<{ id: string; name: string; email: string; role: string }> };
      const list = result.users || [];
      setUsers(list);
      return list;
    } catch {
      message.error('사용자 목록을 불러오지 못했습니다.');
      return [];
    } finally {
      setUsersLoading(false);
    }
  };

  const parseValidationError = (errorMessage: string): string => {
    const parsed = parseMcpError(errorMessage);
    if (parsed.includes('Invalid email')) {
      return '이메일 형식이 올바르지 않습니다. (예: example@email.com)';
    }
    if (parsed.includes('Invalid url')) {
      return 'URL 형식이 올바르지 않습니다. (예: https://example.com)';
    }
    if (parsed.includes('Required')) {
      return '필수 항목을 입력해주세요.';
    }
    return parsed;
  };

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.instructorUpsert({ ...data, token: accessToken || undefined } as any),
    onSuccess: () => {
      message.success('강사가 정상적으로 등록되었습니다.');
      setIsModalOpen(false);
      form.resetFields();
      setEditingInstructor(null);
      setAvatarUrl('');
      clearDraft();
      loadInstructors();
    },
    onError: (error: Error) => {
      if (isAuthError(error.message)) {
        handleSessionExpired(error.message);
        return;
      }
      const friendlyMessage = parseValidationError(error.message);
      message.error(friendlyMessage);
    },
  });

  const fetchMutation = useMutation({
    mutationFn: (id: string) => {
      if (!accessToken) throw new Error("인증이 필요합니다.");
      return api.instructorGet(id, accessToken);
    },
    onSuccess: (result: unknown) => {
      const instructor = result as Instructor;
      setViewInstructor(instructor);
      setInstructors(prev => {
        const exists = prev.find(i => i.id === instructor.id);
        if (exists) {
          return prev.map(i => i.id === instructor.id ? instructor : i);
        }
        return [...prev, instructor];
      });
    },
    onError: (error: Error) => {
      if (isAuthError(error.message)) {
        handleSessionExpired(error.message);
        return;
      }
      message.error(`조회 실패: ${parseMcpError(error.message)}`);
    },
  });

  const handleUploadFile = async (file: RcFile): Promise<string> => {
    const result = await api.uploadFile(file);
    return result.url;
  };

  const handleAvatarUpload = async (info: { file: RcFile }) => {
    try {
      const url = await handleUploadFile(info.file);
      setAvatarUrl(url);
      form.setFieldValue('avatarUrl', url);
      message.success('사진이 업로드되었습니다.');
    } catch {
      message.error('사진 업로드에 실패했습니다.');
    }
  };

  const handleCreate = () => {
    if (!canUpsertInstructorBySite) {
      message.warning('사이트 권한 설정에 따라 강사 등록/수정 기능이 비활성화되었습니다.');
      return;
    }
    if (!accessToken) {
      message.warning('로그인 후 이용해주세요.');
      return;
    }
    const draft = loadDraft();
    if (draft) {
      if (draftPromptOpenRef.current) return;
      draftPromptOpenRef.current = true;
      Modal.confirm({
        title: '임시 저장된 정보가 있습니다',
        content: '이어서 작성하시겠습니까?',
        okText: '이어서 작성',
        cancelText: '아니오',
        maskClosable: false,
        closable: false,
        onOk: () => {
          form.setFieldsValue(draft);
          setEditingInstructor(draft.id ? ({ id: draft.id } as Instructor) : null);
          setAvatarUrl(draft.avatarUrl || '');
          setIsModalOpen(true);
          draftPromptOpenRef.current = false;
        },
        onCancel: () => {
          Modal.confirm({
            title: '이전 작업 초기화',
            content: '이전 임시 저장 작업을 삭제하고 새로 시작합니다.',
            okText: '확인',
            cancelButtonProps: { style: { display: 'none' } },
            maskClosable: false,
            closable: false,
            onOk: () => {
              clearDraft();
              setEditingInstructor(null);
              setAvatarUrl('');
              form.resetFields();
              if (isAdminOperator) {
                loadUsers();
                form.setFieldsValue({ userId: undefined, name: '' });
              } else {
                form.setFieldsValue({ userId: user?.id, name: user?.name, email: user?.email });
              }
              setIsModalOpen(true);
              draftPromptOpenRef.current = false;
            },
          });
        },
      });
      return;
    }
    setEditingInstructor(null);
    setAvatarUrl('');
    form.resetFields();
    if (isAdminOperator) {
      loadUsers();
      form.setFieldsValue({ userId: undefined, name: '' });
    } else {
      form.setFieldsValue({ userId: user?.id, name: user?.name, email: user?.email });
    }
    setIsModalOpen(true);
  };

  const handleEdit = async (instructor: Instructor) => {
    if (!canUpsertInstructorBySite) {
      message.warning('사이트 권한 설정에 따라 강사 등록/수정 기능이 비활성화되었습니다.');
      return;
    }
    if (!accessToken) {
      message.warning('로그인 후 이용해주세요.');
      return;
    }
    // Fetch full data to get JSON fields
    try {
      let loadedUsers = users;
      if (isAdminOperator) {
        loadedUsers = await loadUsers();
      }
      const full = await api.instructorGet(instructor.id, accessToken) as Instructor;

      // If linked user is missing from current user options (e.g., pagination),
      // fetch that user directly so Select can render the current value label.
      if (
        isAdminOperator &&
        accessToken &&
        full.userId &&
        !loadedUsers.some((u) => u.id === full.userId)
      ) {
        try {
          const linked = await api.userGet(accessToken, full.userId) as {
            id: string;
            name: string;
            email: string;
            role: string;
          };
          if (linked?.id) {
            loadedUsers = [linked, ...loadedUsers.filter((u) => u.id !== linked.id)];
            setUsers(loadedUsers);
          }
        } catch {
          // Ignore direct fetch failure and keep fallback matching below.
        }
      }

      const fullEmail = (full.email || '').trim().toLowerCase();
      const inferredUserId =
        full.userId ||
        loadedUsers.find((u) => u.email?.trim().toLowerCase() === fullEmail)?.id;
      const matchedUser = inferredUserId
        ? loadedUsers.find((u) => u.id === inferredUserId)
        : undefined;
      setEditingInstructor(full);
      setAvatarUrl(full.avatarUrl || '');
      form.setFieldsValue({
        id: full.id,
        userId: inferredUserId,
        name: full.name || matchedUser?.name,
        title: full.title ?? undefined,
        tagline: full.tagline ?? undefined,
        email: full.email || matchedUser?.email,
        phone: full.phone ?? undefined,
        affiliation: full.affiliation ?? undefined,
        avatarUrl: full.avatarUrl ?? undefined,
        bio: full.bio ?? undefined,
        specialties: full.specialties?.join(', '),
        awards: full.awards?.join(', '),
        degrees: full.degrees || [],
        careers: full.careers || [],
        publications: full.publications || [],
        certifications: full.certifications || [],
      });
      setIsModalOpen(true);
    } catch {
      message.error('강사 정보 로드 실패');
    }
  };

  const handleSubmit = async () => {
    if (!canUpsertInstructorBySite) {
      message.warning('사이트 권한 설정에 따라 강사 등록/수정 기능이 비활성화되었습니다.');
      return;
    }
    try {
      const values = await form.validateFields();
      const normalizedEmail = (values.email || '').toString().trim().toLowerCase();
      const resolvedUserId =
        editingInstructor?.userId ||
        values.userId ||
        users.find((u) => u.email?.trim().toLowerCase() === normalizedEmail)?.id;

      if (isAdminOperator && !resolvedUserId) {
        message.error('연결할 사용자를 선택해주세요.');
        return;
      }

      const specialties = values.specialties
        ? values.specialties.split(',').map((s: string) => s.trim()).filter(Boolean)
        : [];
      const awards = values.awards
        ? values.awards.split(',').map((s: string) => s.trim()).filter(Boolean)
        : [];

      const data: Record<string, unknown> = {
        userId: resolvedUserId,
        name: values.name,
        title: toOptionalString(values.title),
        tagline: toOptionalString(values.tagline),
        email: toOptionalString(values.email),
        phone: toOptionalString(values.phone),
        affiliation: toOptionalString(values.affiliation),
        avatarUrl: avatarUrl || undefined,
        bio: toOptionalString(values.bio),
        specialties,
        awards,
        degrees: (values.degrees || []).filter((d: Degree) => d?.name || d?.school),
        careers: (values.careers || []).filter((c: Career) => c?.company || c?.role),
        publications: (values.publications || []).filter((p: Publication) => p?.title),
        certifications: (values.certifications || []).filter((c: Certification) => c?.name),
        id: editingInstructor?.id || values.id,
      };

      createMutation.mutate(data);
    } catch (error) {
      // Validation failed
    }
  };

  const columnMap: Record<string, ColumnType<Instructor>> = {
    [NO_COLUMN_KEY]: {
      title: 'No',
      key: NO_COLUMN_KEY,
      width: 60,
      render: (_: unknown, __: Instructor, index: number) => index + 1,
    },
    id: { title: 'ID', dataIndex: 'id', key: 'id', width: 180, ellipsis: true },
    userId: {
      title: '사용자 ID',
      dataIndex: 'userId',
      key: 'userId',
      width: 220,
      ellipsis: true,
      render: (userId: string) => userId || '-',
    },
    name: { title: '이름', dataIndex: 'name', key: 'name' },
    title: { title: '직함', dataIndex: 'title', key: 'title' },
    email: { title: '이메일', dataIndex: 'email', key: 'email' },
    phone: { title: '전화번호', dataIndex: 'phone', key: 'phone' },
    affiliation: { title: '소속', dataIndex: 'affiliation', key: 'affiliation' },
    specialties: {
      title: '전문분야',
      dataIndex: 'specialties',
      key: 'specialties',
      width: 220,
      render: (values?: string[]) => {
        const latest = pickLatestText(values);
        return latest || '-';
      },
    },
    degrees: {
      title: '학위',
      dataIndex: 'degrees',
      key: 'degrees',
      width: 220,
      render: (values?: Degree[]) => {
        const latest = pickLatestByScore(values, (item) => extractYearScore(item.year));
        if (!latest) return '-';
        return [latest.name, latest.school, latest.major, latest.year]
          .filter(Boolean)
          .join(' / ');
      },
    },
    careers: {
      title: '주요경력',
      dataIndex: 'careers',
      key: 'careers',
      width: 240,
      render: (values?: Career[]) => {
        const latest = pickLatestByScore(values, (item) => extractYearScore(item.period));
        if (!latest) return '-';
        return [latest.company, latest.role, latest.period].filter(Boolean).join(' / ');
      },
    },
    publications: {
      title: '출판/논문',
      dataIndex: 'publications',
      key: 'publications',
      width: 220,
      render: (values?: Publication[]) => {
        const latest = pickLatestByScore(values, (item) => extractYearScore(item.year));
        if (!latest) return '-';
        return [latest.type ? `[${latest.type}]` : '', latest.title, latest.year]
          .filter(Boolean)
          .join(' ');
      },
    },
    certifications: {
      title: '자격증',
      dataIndex: 'certifications',
      key: 'certifications',
      width: 220,
      render: (values?: Certification[]) => {
        const latest = pickLatestByScore(values, (item) => extractDateScore(item.date));
        if (!latest) return '-';
        return [latest.name, latest.issuer, latest.date].filter(Boolean).join(' / ');
      },
    },
    awards: {
      title: '수상',
      dataIndex: 'awards',
      key: 'awards',
      width: 180,
      render: (values?: string[]) => {
        const latest = pickLatestText(values);
        return latest || '-';
      },
    },
    avatarUrl: {
      title: '프로필 이미지',
      dataIndex: 'avatarUrl',
      key: 'avatarUrl',
      render: (url: string) => (url ? '있음' : '-'),
    },
    tagline: { title: '한줄 소개', dataIndex: 'tagline', key: 'tagline', ellipsis: true },
    bio: { title: '자기소개', dataIndex: 'bio', key: 'bio', ellipsis: true },
    createdBy: {
      title: '등록자',
      dataIndex: 'createdBy',
      key: 'createdBy',
      width: 100,
      render: (createdBy: string) => createdBy || '-',
    },
    createdAt: {
      title: '등록일',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (date: string) => (date ? new Date(date).toLocaleString('ko-KR') : '-'),
    },
    updatedAt: {
      title: '수정일',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 160,
      render: (date: string) => (date ? new Date(date).toLocaleString('ko-KR') : '-'),
    },
    actions: {
      title: '액션',
      key: 'action',
      width: 150,
      render: (_: unknown, record: Instructor) => (
        <Space>
          <Button
            icon={<EyeOutlined />}
            size="small"
            onClick={() => fetchMutation.mutate(record.id)}
          />
          <Button
            icon={<EditOutlined />}
            size="small"
            onClick={() => handleEdit(record)}
            disabled={!canUpsertInstructorBySite}
          />
        </Space>
      ),
    },
  };

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const defaultKeys = DEFAULT_COLUMNS.instructors
      .map((column) => column.columnKey)
      .filter((key) => key !== NO_COLUMN_KEY);
    const mapKeys = Object.keys(columnMap).filter((key) => key !== NO_COLUMN_KEY);
    const missingInMap = defaultKeys.filter((key) => !mapKeys.includes(key));
    const missingInDefaults = mapKeys.filter((key) => !defaultKeys.includes(key));
    if (missingInMap.length > 0 || missingInDefaults.length > 0) {
      console.warn('[instructors] column/default mismatch', {
        missingInMap,
        missingInDefaults,
      });
    }
  }, [columnMap]);

  const columns = buildColumns<Instructor>(columnConfigs, columnMap);

  const sectionStyle = { marginBottom: 0 };

  if (!canAccessInstructorsMenu) {
    return (
      <Result
        status="403"
        title="메뉴 비활성화"
        subTitle="사이트 관리의 권한관리에서 강사 관리 메뉴가 비활성화되었습니다."
      />
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space size={8} align="center">
          <h2 style={{ margin: 0 }}>강사 관리</h2>
          {user?.role === 'admin' && (
            <Tooltip title="목차 설정으로 이동">
              <Button
                type="text"
                size="small"
                icon={<SettingOutlined />}
                onClick={() => navigate('/admin/site-settings?tab=outline&tableKey=instructors')}
                style={{ padding: 4 }}
              />
            </Tooltip>
          )}
        </Space>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadInstructors} loading={loading}>
            새로고침
          </Button>
          <Input.Search
            placeholder="강사 ID로 조회"
            onSearch={(id) => id && fetchMutation.mutate(id)}
            style={{ width: 250 }}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
            disabled={!canUpsertInstructorBySite}
          >
            새 강사
          </Button>
        </Space>
      </div>

      <Alert
        type="info"
        showIcon
        title="강사 기본 정보와 이력 데이터를 관리합니다."
        description="리스트 컬럼은 사이트 관리의 목차 설정에 따라 표시/순서가 변경됩니다."
        style={{ marginBottom: 16 }}
      />

      <Table
        columns={columns}
        dataSource={instructors}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingInstructor ? '강사 수정' : '새 강사 등록'}
        open={isModalOpen}
        onOk={handleSubmit}
        onCancel={() => { setIsModalOpen(false); setAvatarUrl(''); }}
        confirmLoading={createMutation.isPending}
        width={800}
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ degrees: [], careers: [], publications: [], certifications: [], awards: '' }}
          onValuesChange={(_, allValues) => {
            if (!isModalOpen) return;
            saveDraft(allValues);
          }}
        >
          <Form.Item name="id" hidden><Input /></Form.Item>
          {/* 기본 정보 */}
          <div style={{ display: 'flex', gap: 24 }}>
            <AvatarUploadField form={form} onUpload={(file) => handleAvatarUpload({ file })} serverUrl={SERVER_URL} />
            <div style={{ flex: 1 }}>
              {isAdminOperator ? (
                <Form.Item
                  name="userId"
                  label="사용자"
                  rules={[{ required: true, message: '사용자를 선택하세요' }]}
                  style={sectionStyle}
                >
                  <Select
                    showSearch
                    placeholder="사용자 검색 또는 선택"
                    loading={usersLoading}
                    disabled={!!editingInstructor}
                    options={users.map(u => ({
                      value: u.id,
                      label: `${u.name} (${u.email})`,
                    }))}
                    filterOption={(input, option) =>
                      (option?.label as string).toLowerCase().includes(input.toLowerCase())
                    }
                    onChange={(value) => {
                      const selected = users.find(u => u.id === value);
                      if (selected) {
                        form.setFieldsValue({
                          name: selected.name,
                          email: selected.email,
                        });
                      }
                    }}
                  />
                </Form.Item>
              ) : (
                <>
                  <Form.Item name="userId" hidden><Input /></Form.Item>
                </>
              )}
              <Form.Item
                name="name"
                label="이름"
                rules={[{ required: true, message: '이름을 입력하세요' }]}
                style={sectionStyle}
              >
                <Input disabled />
              </Form.Item>
              <Form.Item name="title" label="직함" style={sectionStyle}>
                <Input placeholder="예: 수석 컨설턴트" />
              </Form.Item>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item
              name="email"
              label="이메일"
              rules={[{ type: 'email', message: '올바른 이메일 형식을 입력하세요' }]}
            >
              <Input placeholder="예: instructor@company.com" />
            </Form.Item>
            <Form.Item name="phone" label="전화번호">
              <Input />
            </Form.Item>
          </div>
          <Form.Item name="affiliation" label="소속">
            <Input />
          </Form.Item>
          <Form.Item name="tagline" label="한줄 소개">
            <Input placeholder="예: 조직성과를 만드는 실무형 교육 전문가" />
          </Form.Item>
          <Form.Item name="specialties" label="전문분야 (쉼표로 구분)">
            <Input placeholder="예: 리더십, 커뮤니케이션, 조직문화" />
          </Form.Item>
          <Form.Item name="awards" label="수상 (쉼표로 구분)">
            <Input placeholder="예: 올해의 강사상, 교육혁신상" />
          </Form.Item>
          <Form.Item name="bio" label="자기소개">
            <Input.TextArea rows={3} placeholder="강사 자기소개를 입력하세요 (선택)" />
          </Form.Item>

          <InstructorCareerSection
            form={form}
            mode="upload"
            onUploadFile={handleUploadFile}
            defaultOpen={true}
            titlePlacement="start"
            compactAddButton={true}
          />
        </Form>
      </Modal>

      <Modal
        title="강사 상세"
        open={!!viewInstructor}
        onCancel={() => setViewInstructor(null)}
        footer={[
          <Button key="close" onClick={() => setViewInstructor(null)}>
            닫기
          </Button>,
          <Button key="edit" type="primary" onClick={() => {
            if (viewInstructor) {
              handleEdit(viewInstructor);
              setViewInstructor(null);
            }
          }}>
            수정
          </Button>,
        ]}
        width={700}
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
      >
        {viewInstructor && (
          <div>
            <div style={{ marginBottom: 16 }}>
              {viewInstructor.avatarUrl ? (
                <Avatar size={80} src={`${SERVER_URL}${viewInstructor.avatarUrl}`} />
              ) : (
                <Avatar size={80} icon={<UserOutlined />} />
              )}
            </div>

            <p><strong>이름:</strong> {viewInstructor.name}</p>
            <p><strong>직함:</strong> {viewInstructor.title || '-'}</p>
            <p><strong>소속:</strong> {viewInstructor.affiliation || '-'}</p>

            <p><strong>ID:</strong> {viewInstructor.id}</p>
            <p><strong>사용자 ID:</strong> {viewInstructor.userId || '-'}</p>
            <p><strong>이메일:</strong> {viewInstructor.email || '-'}</p>
            <p><strong>전화번호:</strong> {viewInstructor.phone || '-'}</p>
            <p><strong>전문분야:</strong> {viewInstructor.specialties?.join(', ') || '-'}</p>
            <p><strong>수상:</strong> {viewInstructor.awards?.join(', ') || '-'}</p>
            {viewInstructor.bio && <p><strong>자기소개:</strong> {viewInstructor.bio}</p>}
            <p><strong>등록자:</strong> {viewInstructor.createdBy || '-'}</p>
            <p>
              <strong>등록 과정:</strong>{" "}
              {viewInstructor.Courses && viewInstructor.Courses.length > 0
                ? viewInstructor.Courses.map((c) => c.title).join(", ")
                : "-"}
            </p>

            {Array.isArray(viewInstructor.degrees) && viewInstructor.degrees.length > 0 && (
              <>
                <Divider titlePlacement="start" plain>학위</Divider>
                {viewInstructor.degrees.map((d, i) => (
                  <p key={i}>
                    {d.name} - {d.school} {d.major} ({d.year})
                    {d.fileUrl && <a href={`${SERVER_URL}${d.fileUrl}`} target="_blank" rel="noreferrer" style={{ marginLeft: 8 }}>첨부파일</a>}
                  </p>
                ))}
              </>
            )}

            {Array.isArray(viewInstructor.careers) && viewInstructor.careers.length > 0 && (
              <>
                <Divider titlePlacement="start" plain>주요경력</Divider>
                {viewInstructor.careers.map((c, i) => (
                  <p key={i}>{c.company} / {c.role} ({c.period}){c.description ? ` - ${c.description}` : ''}</p>
                ))}
              </>
            )}

            {Array.isArray(viewInstructor.publications) && viewInstructor.publications.length > 0 && (
              <>
                <Divider titlePlacement="start" plain>출판/논문</Divider>
                {viewInstructor.publications.map((p, i) => (
                  <p key={i}>[{p.type}] {p.title}{p.publisher ? ` - ${p.publisher}` : ''}{p.year ? ` (${p.year})` : ''}</p>
                ))}
              </>
            )}

            {Array.isArray(viewInstructor.certifications) && viewInstructor.certifications.length > 0 && (
              <>
                <Divider titlePlacement="start" plain>자격증</Divider>
                {viewInstructor.certifications.map((c, i) => (
                  <p key={i}>
                    {c.name}{c.issuer ? ` (${c.issuer})` : ''}{c.date ? ` - ${c.date}` : ''}
                    {c.fileUrl && <a href={`${SERVER_URL}${c.fileUrl}`} target="_blank" rel="noreferrer" style={{ marginLeft: 8 }}>사본</a>}
                  </p>
                ))}
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
