import { useState, useEffect, useMemo, useRef, useCallback, type CSSProperties } from 'react';
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
  Result,
  Popconfirm,
  Tag,
} from 'antd';
import type { ColumnType } from 'antd/es/table';
import {
  PlusOutlined,
  EditOutlined,
  EyeOutlined,
  NotificationOutlined,
  ReloadOutlined,
  UserOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api/mcpClient';
import { useAuth } from '../contexts/AuthContext';
import { useSitePermissions } from '../hooks/useSitePermissions';
import { useTableConfig } from '../hooks/useTableConfig';
import { useDraftStorage } from '../hooks/useDraftStorage';
import { useSessionExpiredGuard } from '../hooks/useSessionExpiredGuard';
import { buildColumns, NO_COLUMN_KEY } from '../utils/tableConfig';
import { DEFAULT_COLUMNS } from '../utils/tableDefaults';
import type { RcFile } from 'antd/es/upload';
import { useLocation, useNavigate } from 'react-router-dom';
import AvatarUploadField from '../components/AvatarUploadField';
import InstructorCareerSection from '../components/InstructorCareerSection';
import PageHeader from '../components/PageHeader';
import { isAuthErrorMessage, parseMcpError } from '../utils/error';
import { getPreferredTemplateId } from '../utils/templatePreference';
import {
  normalizeInstructorCollections,
  toCsvText,
  toOptionalString,
  type Career,
  type Certification,
  type Degree,
  type Publication,
} from '../utils/instructorPayload';

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
  Schedules?: { id: string; date?: string; location?: string }[];
}

interface InstructorTemplateOption {
  id: string;
  name: string;
  html: string;
  css: string;
}

type InstructorDraft = Record<string, unknown> & {
  id?: string;
  avatarUrl?: string;
};

const SERVER_URL = '';

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
  const [instructorExportTemplates, setInstructorExportTemplates] = useState<InstructorTemplateOption[]>([]);
  const [selectedInstructorTemplateId, setSelectedInstructorTemplateId] = useState<string>();
  const [instructorExportLabel, setInstructorExportLabel] = useState('');
  const [instructorPreviewLoading, setInstructorPreviewLoading] = useState(false);
  const [instructorExportLoading, setInstructorExportLoading] = useState(false);
  const draftPromptOpenRef = useRef(false);
  const { canAccessMenu, canUseFeature } = useSitePermissions(user?.role);
  const canAccessInstructorsMenu = canAccessMenu('instructors');
  const canUpsertInstructorBySite = canUseFeature('instructors', 'instructor.upsert');

  const draftKey = useMemo(() => 'draft:instructor', []);

  const buildDraftPayload = useCallback((values?: Record<string, unknown>): InstructorDraft => {
    const raw = values || form.getFieldsValue();
    return {
      ...raw,
      id: editingInstructor?.id || (raw.id as string) || undefined,
      avatarUrl,
      updatedAt: new Date().toISOString(),
    };
  }, [avatarUrl, editingInstructor?.id, form]);

  const { saveDraft, loadDraft, clearDraft } = useDraftStorage<InstructorDraft>(
    draftKey,
    buildDraftPayload,
  );

  const isAuthError = (messageText: string) => isAuthErrorMessage(messageText);

  const handleSessionExpired = useSessionExpiredGuard({
    saveDraft,
    onGoToLogin: () => {
      logout();
      navigate('/login');
    },
  });

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
  }, [saveDraft]);

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

  useEffect(() => {
    if (!viewInstructor || !accessToken) return;
    void loadInstructorExportTemplates();
  }, [viewInstructor?.id, accessToken]);

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

  const loadInstructorExportTemplates = async () => {
    if (!accessToken) return;
    try {
      const result = (await api.templateList(1, 100, 'instructor_profile', accessToken)) as {
        items: InstructorTemplateOption[];
      };
      const items = result.items || [];
      setInstructorExportTemplates(items);
      if (items.length > 0) {
        const preferredTemplateId = getPreferredTemplateId(user?.id, 'instructor_profile');
        const hasCurrent =
          !!selectedInstructorTemplateId &&
          items.some((item) => item.id === selectedInstructorTemplateId);
        const hasPreferred =
          !!preferredTemplateId && items.some((item) => item.id === preferredTemplateId);
        if (hasCurrent) return;
        if (hasPreferred) {
          setSelectedInstructorTemplateId(preferredTemplateId);
          return;
        }
        setSelectedInstructorTemplateId(items[0].id);
      }
    } catch (error) {
      console.error('Failed to load instructor export templates:', error);
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
    if (!accessToken) throw new Error('인증이 필요합니다.');
    const result = await api.uploadFile(file, accessToken);
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
          message.info('임시 저장을 삭제하고 새로 작성합니다.');
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
        specialties: toCsvText(full.specialties),
        awards: toCsvText(full.awards),
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

      const collections = normalizeInstructorCollections(values as Record<string, unknown>);

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
        specialties: collections.specialties,
        awards: collections.awards,
        degrees: collections.degrees,
        careers: collections.careers,
        publications: collections.publications,
        certifications: collections.certifications,
        id: editingInstructor?.id || values.id,
      };

      createMutation.mutate(data);
    } catch (error) {
      // Validation failed
    }
  };

  const handleRevokeInstructorRole = async (instructor: Instructor) => {
    if (!accessToken) {
      message.warning('로그인 후 이용해주세요.');
      return;
    }
    if (!instructor.userId) {
      message.warning('연결된 사용자 계정이 없어 권한 해제를 할 수 없습니다.');
      return;
    }
    try {
      await api.userUpdateRole({
        token: accessToken,
        userId: instructor.userId,
        role: 'viewer',
      });
      message.success('강사 권한을 해제했습니다. 등록된 강사 프로필 데이터는 유지됩니다.');
      await loadInstructors();
      if (viewInstructor?.id === instructor.id) {
        fetchMutation.mutate(instructor.id);
      }
    } catch (error) {
      message.error(`강사 권한 해제 실패: ${parseMcpError((error as Error).message)}`);
    }
  };

  const buildInstructorPreviewData = (instructor: Instructor) => ({
    instructor,
    courses: instructor.Courses || [],
    schedules: instructor.Schedules || [],
  });

  const focusedInstructorIdRef = useRef<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const focusInstructorId = params.get("focus");
    if (!focusInstructorId || !accessToken) return;
    if (focusedInstructorIdRef.current === focusInstructorId) return;
    focusedInstructorIdRef.current = focusInstructorId;
    fetchMutation.mutate(focusInstructorId);
  }, [location.search, accessToken, fetchMutation]);

  const handlePreviewInstructorExport = async () => {
    if (!viewInstructor) return;
    if (!selectedInstructorTemplateId) {
      message.warning('템플릿을 선택하세요.');
      return;
    }
    const tpl = instructorExportTemplates.find((t) => t.id === selectedInstructorTemplateId);
    if (!tpl) {
      message.warning('선택한 템플릿을 찾을 수 없습니다.');
      return;
    }
    setInstructorPreviewLoading(true);
    try {
      const result = await api.templatePreviewHtml(
        tpl.html,
        tpl.css,
        buildInstructorPreviewData(viewInstructor),
      );
      const html =
        typeof result === 'string'
          ? result
          : ((result as Record<string, unknown>).html as string) ||
            ((result as Record<string, unknown>).text as string) ||
            '';
      const win = window.open('', '_blank', 'width=900,height=1200');
      if (win) {
        win.document.open();
        win.document.write(html);
        win.document.close();
      }
    } catch (error) {
      message.error(`미리보기 실패: ${(error as Error).message}`);
    } finally {
      setInstructorPreviewLoading(false);
    }
  };

  const handleExportInstructorPdf = async () => {
    if (!viewInstructor || !accessToken) return;
    if (!selectedInstructorTemplateId) {
      message.warning('템플릿을 선택하세요.');
      return;
    }
    setInstructorExportLoading(true);
    try {
      await api.renderInstructorProfilePdf({
        token: accessToken,
        templateId: selectedInstructorTemplateId,
        profileId: viewInstructor.id,
        label: instructorExportLabel || undefined,
      });
      message.success('강사 프로필 내보내기 작업이 등록되었습니다. 내 문서함에서 확인하세요.');
      setInstructorExportLabel('');
      setViewInstructor(null);
      navigate('/documents');
    } catch (error) {
      message.error(`내보내기 실패: ${(error as Error).message}`);
    } finally {
      setInstructorExportLoading(false);
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
      width: 200,
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
          <Popconfirm
            title="강사 권한 해제"
            description="강사 권한만 해제하고, 개인이 등록한 강사 데이터는 유지합니다. 계속할까요?"
            okText="해제"
            cancelText="취소"
            onConfirm={() => handleRevokeInstructorRole(record)}
            disabled={user?.role !== 'admin' || !record.userId}
          >
            <Button
              icon={<DeleteOutlined />}
              size="small"
              danger
              disabled={user?.role !== 'admin' || !record.userId}
            />
          </Popconfirm>
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
  const detailSectionStyle: CSSProperties = {
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    background: '#fff',
  };

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
      <PageHeader
        title="강사 관리"
        showOutlineShortcut={user?.role === 'admin'}
        onClickOutlineShortcut={() => navigate('/admin/site-settings?tab=outline&tableKey=instructors')}
        actions={(
          <>
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
          </>
        )}
      />

      <Alert
        type="info"
        showIcon icon={<NotificationOutlined />}
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
        onCancel={() => {
          setViewInstructor(null);
          setInstructorExportLabel('');
        }}
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
            <div
              style={{
                border: '1px solid #d9e1ef',
                borderRadius: 12,
                padding: 16,
                background: '#f8fbff',
                marginBottom: 12,
              }}
            >
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 12 }}>
                {viewInstructor.avatarUrl ? (
                  <Avatar size={80} src={`${SERVER_URL}${viewInstructor.avatarUrl}`} />
                ) : (
                  <Avatar size={80} icon={<UserOutlined />} />
                )}
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{viewInstructor.name}</div>
                  <div style={{ color: '#666', marginTop: 4 }}>{viewInstructor.title || '직함 없음'}</div>
                  <div style={{ marginTop: 8 }}>
                    <Tag color={viewInstructor.userId ? 'blue' : 'default'}>
                      {viewInstructor.userId ? '등록강사' : '수동 등록'}
                    </Tag>
                  </div>
                </div>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ color: '#8c8c8c', fontSize: 12 }}>강사 ID</div>
                  <div style={{ fontFamily: 'monospace' }}>{viewInstructor.id}</div>
                </div>
                <div>
                  <div style={{ color: '#8c8c8c', fontSize: 12 }}>사용자 ID</div>
                  <div style={{ fontFamily: 'monospace' }}>{viewInstructor.userId || '-'}</div>
                </div>
                <div>
                  <div style={{ color: '#8c8c8c', fontSize: 12 }}>이메일</div>
                  <div>{viewInstructor.email || '-'}</div>
                </div>
                <div>
                  <div style={{ color: '#8c8c8c', fontSize: 12 }}>전화번호</div>
                  <div>{viewInstructor.phone || '-'}</div>
                </div>
                <div>
                  <div style={{ color: '#8c8c8c', fontSize: 12 }}>소속</div>
                  <div>{viewInstructor.affiliation || '-'}</div>
                </div>
                <div>
                  <div style={{ color: '#8c8c8c', fontSize: 12 }}>등록자</div>
                  <div>{viewInstructor.createdBy || '-'}</div>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>전문분야</div>
              <div>{viewInstructor.specialties?.join(', ') || '-'}</div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>수상</div>
              <div>{viewInstructor.awards?.join(', ') || '-'}</div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>자기소개</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{viewInstructor.bio || '-'}</div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>연결 과정</div>
              {viewInstructor.Courses && viewInstructor.Courses.length > 0 ? (
                <Space wrap>
                  {viewInstructor.Courses.map((course) => (
                    <Tag key={course.id}>{course.title}</Tag>
                  ))}
                </Space>
              ) : (
                <div>-</div>
              )}
            </div>

            <div style={detailSectionStyle}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>학위</div>
              {Array.isArray(viewInstructor.degrees) && viewInstructor.degrees.length > 0 ? (
                <Space direction="vertical" style={{ width: '100%' }} size={8}>
                  {viewInstructor.degrees.map((degree, index) => (
                    <div
                      key={`${degree.name}-${degree.school}-${index}`}
                      style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 10 }}
                    >
                      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <div style={{ width: 18, marginTop: 2 }}>
                          {degree.fileUrl ? (
                            <a
                              href={`${SERVER_URL}${degree.fileUrl}`}
                              target="_blank"
                              rel="noreferrer"
                              aria-label="첨부파일 보기"
                              title="첨부파일 보기"
                              style={{ display: 'inline-flex', alignItems: 'center' }}
                            >
                              <EyeOutlined />
                            </a>
                          ) : null}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600 }}>
                            {index + 1}. {degree.name || '-'}
                          </div>
                          <div style={{ color: '#666' }}>
                            {degree.school || '-'} / {degree.major || '-'} / {degree.year || '-'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </Space>
              ) : (
                <div style={{ color: '#999' }}>등록된 학위가 없습니다.</div>
              )}
            </div>

            <div style={detailSectionStyle}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>주요경력</div>
              {Array.isArray(viewInstructor.careers) && viewInstructor.careers.length > 0 ? (
                <Space direction="vertical" style={{ width: '100%' }} size={8}>
                  {viewInstructor.careers.map((career, index) => (
                    <div
                      key={`${career.company}-${career.role}-${index}`}
                      style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 10 }}
                    >
                      <div style={{ fontWeight: 600 }}>
                        {index + 1}. {career.company || '-'} / {career.role || '-'}
                      </div>
                      <div style={{ color: '#666' }}>{career.period || '-'}</div>
                      {career.description && (
                        <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{career.description}</div>
                      )}
                    </div>
                  ))}
                </Space>
              ) : (
                <div style={{ color: '#999' }}>등록된 주요경력이 없습니다.</div>
              )}
            </div>

            <div style={detailSectionStyle}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>출판/논문</div>
              {Array.isArray(viewInstructor.publications) && viewInstructor.publications.length > 0 ? (
                <Space direction="vertical" style={{ width: '100%' }} size={8}>
                  {viewInstructor.publications.map((publication, index) => (
                    <div
                      key={`${publication.title}-${publication.type}-${index}`}
                      style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 10 }}
                    >
                      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <div style={{ width: 18, marginTop: 2 }}>
                          {publication.url ? (
                            <a
                              href={publication.url}
                              target="_blank"
                              rel="noreferrer"
                              aria-label="링크 열기"
                              title="링크 열기"
                              style={{ display: 'inline-flex', alignItems: 'center' }}
                            >
                              <EyeOutlined />
                            </a>
                          ) : null}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600 }}>
                            {index + 1}. [{publication.type || '-'}] {publication.title || '-'}
                          </div>
                          <div style={{ color: '#666' }}>
                            {publication.publisher || '-'} {publication.year ? `(${publication.year})` : ''}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </Space>
              ) : (
                <div style={{ color: '#999' }}>등록된 출판/논문이 없습니다.</div>
              )}
            </div>

            <div style={detailSectionStyle}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>자격증</div>
              {Array.isArray(viewInstructor.certifications) && viewInstructor.certifications.length > 0 ? (
                <Space direction="vertical" style={{ width: '100%' }} size={8}>
                  {viewInstructor.certifications.map((certification, index) => (
                    <div
                      key={`${certification.name}-${certification.issuer}-${index}`}
                      style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 10 }}
                    >
                      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <div style={{ width: 18, marginTop: 2 }}>
                          {certification.fileUrl ? (
                            <a
                              href={`${SERVER_URL}${certification.fileUrl}`}
                              target="_blank"
                              rel="noreferrer"
                              aria-label="사본 보기"
                              title="사본 보기"
                              style={{ display: 'inline-flex', alignItems: 'center' }}
                            >
                              <EyeOutlined />
                            </a>
                          ) : null}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600 }}>
                            {index + 1}. {certification.name || '-'}
                          </div>
                          <div style={{ color: '#666' }}>
                            {certification.issuer || '-'} / {certification.date || '-'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </Space>
              ) : (
                <div style={{ color: '#999' }}>등록된 자격증이 없습니다.</div>
              )}
            </div>

            <Divider />
            <h3 style={{ marginTop: 0 }}>PDF 내보내기</h3>
            <Space orientation="vertical" style={{ width: '100%' }} size={12}>
              <div>
                <div style={{ marginBottom: 6, fontWeight: 500 }}>템플릿 선택</div>
                <Select
                  value={selectedInstructorTemplateId}
                  onChange={setSelectedInstructorTemplateId}
                  placeholder="강사 프로필 템플릿을 선택하세요"
                  style={{ width: '100%' }}
                  options={instructorExportTemplates.map((t) => ({
                    value: t.id,
                    label: t.name,
                  }))}
                />
              </div>
              <div>
                <div style={{ marginBottom: 6, fontWeight: 500 }}>문서 라벨 (선택)</div>
                <Input
                  value={instructorExportLabel}
                  onChange={(e) => setInstructorExportLabel(e.target.value)}
                  placeholder="예: 2026 상반기 강사 프로필"
                />
              </div>
              <Space>
                <Button loading={instructorPreviewLoading} onClick={handlePreviewInstructorExport}>
                  미리보기
                </Button>
                <Button type="primary" loading={instructorExportLoading} onClick={handleExportInstructorPdf}>
                  내보내기
                </Button>
              </Space>
            </Space>
          </div>
        )}
      </Modal>
    </div>
  );
}
