import { useState, useEffect } from 'react';
import {
  Button,
  Table,
  Modal,
  Form,
  Input,
  message,
  Space,
  Tag,
  Upload,
  Select,
  Divider,
  Avatar,
} from 'antd';
import type { ColumnType } from 'antd/es/table';
import {
  PlusOutlined,
  EditOutlined,
  EyeOutlined,
  ReloadOutlined,
  MinusCircleOutlined,
  UploadOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { api, mcpClient } from '../api/mcpClient';
import { useAuth } from '../contexts/AuthContext';
import { useTableConfig } from '../hooks/useTableConfig';
import { buildColumns, NO_COLUMN_KEY } from '../utils/tableConfig';
import { DEFAULT_COLUMNS } from '../utils/tableDefaults';
import type { RcFile } from 'antd/es/upload';

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
  bio?: string;
  specialties?: string[];
  certifications?: Certification[];
  awards?: string[];
  degrees?: Degree[];
  careers?: Career[];
  publications?: Publication[];
  createdBy?: string;
  Courses?: { id: string; title: string }[];
}

const SERVER_URL = '';

export default function InstructorsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInstructor, setEditingInstructor] = useState<Instructor | null>(null);
  const [viewInstructor, setViewInstructor] = useState<Instructor | null>(null);
  const [form] = Form.useForm();
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const { accessToken, user } = useAuth();
  const { configs: columnConfigs } = useTableConfig(
    'instructors',
    DEFAULT_COLUMNS.instructors,
  );
  const isAdminOperator = user?.role === 'admin' || user?.role === 'operator';
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string; role: string }>>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  const loadInstructors = async () => {
    try {
      setLoading(true);
      const result = await api.instructorList() as { instructors: Instructor[]; total: number };
      setInstructors(result.instructors);
    } catch (error) {
      console.error('Failed to load instructors:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    mcpClient.onConnect(() => {
      loadInstructors();
    });
  }, []);

  const loadUsers = async () => {
    if (!accessToken) return;
    try {
      setUsersLoading(true);
      const result = await api.userList(accessToken, 100, 0) as { users: Array<{ id: string; name: string; email: string; role: string }> };
      setUsers(result.users || []);
    } catch {
      message.error('사용자 목록을 불러오지 못했습니다.');
    } finally {
      setUsersLoading(false);
    }
  };

  const parseValidationError = (errorMessage: string): string => {
    if (errorMessage.includes('Invalid email')) {
      return '이메일 형식이 올바르지 않습니다. (예: example@email.com)';
    }
    if (errorMessage.includes('Invalid url')) {
      return 'URL 형식이 올바르지 않습니다. (예: https://example.com)';
    }
    if (errorMessage.includes('Required')) {
      return '필수 항목을 입력해주세요.';
    }
    return errorMessage;
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
      loadInstructors();
    },
    onError: (error: Error) => {
      const friendlyMessage = parseValidationError(error.message);
      message.error(friendlyMessage);
    },
  });

  const fetchMutation = useMutation({
    mutationFn: (id: string) => api.instructorGet(id),
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
      message.error(`조회 실패: ${error.message}`);
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
    if (!accessToken) {
      message.warning('로그인 후 이용해주세요.');
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
    if (!accessToken) {
      message.warning('로그인 후 이용해주세요.');
      return;
    }
    // Fetch full data to get JSON fields
    try {
      const full = await api.instructorGet(instructor.id) as Instructor;
      setEditingInstructor(full);
      setAvatarUrl(full.avatarUrl || '');
      form.setFieldsValue({
        userId: full.userId,
        name: full.name,
        title: full.title,
        email: full.email,
        phone: full.phone,
        affiliation: full.affiliation,
        avatarUrl: full.avatarUrl,
        bio: full.bio,
        specialties: full.specialties?.join(', '),
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
    try {
      const values = await form.validateFields();
      const specialties = values.specialties
        ? values.specialties.split(',').map((s: string) => s.trim()).filter(Boolean)
        : [];

      const data: Record<string, unknown> = {
        userId: values.userId,
        name: values.name,
        title: values.title,
        email: values.email,
        phone: values.phone,
        affiliation: values.affiliation,
        avatarUrl: avatarUrl || undefined,
        bio: values.bio,
        specialties,
        degrees: (values.degrees || []).filter((d: Degree) => d?.name || d?.school),
        careers: (values.careers || []).filter((c: Career) => c?.company || c?.role),
        publications: (values.publications || []).filter((p: Publication) => p?.title),
        certifications: (values.certifications || []).filter((c: Certification) => c?.name),
        id: editingInstructor?.id,
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
          />
        </Space>
      ),
    },
  };
  const columns = buildColumns<Instructor>(columnConfigs, columnMap);

  const sectionStyle = { marginBottom: 0 };
  const dividerStyle = { margin: '16px 0 8px' };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>강사 관리</h2>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadInstructors} loading={loading}>
            새로고침
          </Button>
          <Input.Search
            placeholder="강사 ID로 조회"
            onSearch={(id) => id && fetchMutation.mutate(id)}
            style={{ width: 250 }}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            새 강사
          </Button>
        </Space>
      </div>

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
        <Form form={form} layout="vertical" initialValues={{ degrees: [], careers: [], publications: [], certifications: [] }}>
          {/* 기본 정보 */}
          <div style={{ display: 'flex', gap: 24 }}>
            <div style={{ textAlign: 'center' }}>
              <Upload
                showUploadList={false}
                beforeUpload={(file) => { handleAvatarUpload({ file }); return false; }}
                accept="image/*"
              >
                <div style={{ cursor: 'pointer' }}>
                  {avatarUrl ? (
                    <Avatar size={100} src={`${SERVER_URL}${avatarUrl}`} />
                  ) : (
                    <Avatar size={100} icon={<UserOutlined />} />
                  )}
                  <div style={{ marginTop: 8, color: '#1890ff', fontSize: 12 }}>사진 업로드</div>
                </div>
              </Upload>
              <Form.Item name="avatarUrl" hidden><Input /></Form.Item>
            </div>
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
          <Form.Item name="specialties" label="전문분야 (쉼표로 구분)">
            <Input placeholder="예: 리더십, 커뮤니케이션, 조직문화" />
          </Form.Item>
          <Form.Item name="bio" label="자기소개">
            <Input.TextArea rows={3} placeholder="강사 자기소개를 입력하세요 (선택)" />
          </Form.Item>

          {/* 학위 */}
          <Divider orientation="left" style={dividerStyle}>학위</Divider>
          <Form.List name="degrees">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <div key={key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
                    <Form.Item {...restField} name={[name, 'name']} style={{ flex: 1, marginBottom: 0 }}>
                      <Select placeholder="학위" options={[
                        { value: '학사', label: '학사' },
                        { value: '석사', label: '석사' },
                        { value: '박사', label: '박사' },
                        { value: '기타', label: '기타' },
                      ]} />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'school']} style={{ flex: 2, marginBottom: 0 }}>
                      <Input placeholder="학교" />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'major']} style={{ flex: 2, marginBottom: 0 }}>
                      <Input placeholder="전공" />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'year']} style={{ flex: 1, marginBottom: 0 }}>
                      <Input placeholder="연도" />
                    </Form.Item>
                    <DegreeFileUpload name={name} form={form} onUpload={handleUploadFile} />
                    <MinusCircleOutlined onClick={() => remove(name)} style={{ marginTop: 8, color: '#999' }} />
                  </div>
                ))}
                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />} size="small">
                  학위 추가
                </Button>
              </>
            )}
          </Form.List>

          {/* 주요경력 */}
          <Divider orientation="left" style={dividerStyle}>주요경력</Divider>
          <Form.List name="careers">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <div key={key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
                    <Form.Item {...restField} name={[name, 'company']} style={{ flex: 2, marginBottom: 0 }}>
                      <Input placeholder="회사/기관" />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'role']} style={{ flex: 2, marginBottom: 0 }}>
                      <Input placeholder="직책/역할" />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'period']} style={{ flex: 1.5, marginBottom: 0 }}>
                      <Input placeholder="기간 (예: 2018~2023)" />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'description']} style={{ flex: 2, marginBottom: 0 }}>
                      <Input placeholder="설명 (선택)" />
                    </Form.Item>
                    <MinusCircleOutlined onClick={() => remove(name)} style={{ marginTop: 8, color: '#999' }} />
                  </div>
                ))}
                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />} size="small">
                  경력 추가
                </Button>
              </>
            )}
          </Form.List>

          {/* 출판/논문 */}
          <Divider orientation="left" style={dividerStyle}>출판/논문</Divider>
          <Form.List name="publications">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <div key={key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
                    <Form.Item {...restField} name={[name, 'title']} style={{ flex: 3, marginBottom: 0 }}>
                      <Input placeholder="제목" />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'type']} style={{ flex: 1, marginBottom: 0 }}>
                      <Select placeholder="구분" options={[
                        { value: '출판', label: '출판' },
                        { value: '논문', label: '논문' },
                      ]} />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'year']} style={{ flex: 1, marginBottom: 0 }}>
                      <Input placeholder="연도" />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'publisher']} style={{ flex: 2, marginBottom: 0 }}>
                      <Input placeholder="출판사/학회" />
                    </Form.Item>
                    <MinusCircleOutlined onClick={() => remove(name)} style={{ marginTop: 8, color: '#999' }} />
                  </div>
                ))}
                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />} size="small">
                  출판/논문 추가
                </Button>
              </>
            )}
          </Form.List>

          {/* 자격증 */}
          <Divider orientation="left" style={dividerStyle}>자격증</Divider>
          <Form.List name="certifications">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <div key={key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
                    <Form.Item {...restField} name={[name, 'name']} style={{ flex: 2, marginBottom: 0 }}>
                      <Input placeholder="자격증명" />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'issuer']} style={{ flex: 2, marginBottom: 0 }}>
                      <Input placeholder="발급기관" />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'date']} style={{ flex: 1.5, marginBottom: 0 }}>
                      <Input placeholder="취득일 (예: 2023-05)" />
                    </Form.Item>
                    <CertFileUpload name={name} form={form} onUpload={handleUploadFile} />
                    <MinusCircleOutlined onClick={() => remove(name)} style={{ marginTop: 8, color: '#999' }} />
                  </div>
                ))}
                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />} size="small">
                  자격증 추가
                </Button>
              </>
            )}
          </Form.List>
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
            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
              {viewInstructor.avatarUrl ? (
                <Avatar size={80} src={`${SERVER_URL}${viewInstructor.avatarUrl}`} />
              ) : (
                <Avatar size={80} icon={<UserOutlined />} />
              )}
              <div>
                <h3 style={{ margin: 0 }}>{viewInstructor.name}</h3>
                <div style={{ color: '#666' }}>{viewInstructor.title || ''}</div>
                <div style={{ color: '#999', fontSize: 12 }}>{viewInstructor.affiliation || ''}</div>
              </div>
            </div>

            <p><strong>ID:</strong> {viewInstructor.id}</p>
            <p><strong>사용자 ID:</strong> {viewInstructor.userId || '-'}</p>
            <p><strong>이메일:</strong> {viewInstructor.email || '-'}</p>
            <p><strong>전화번호:</strong> {viewInstructor.phone || '-'}</p>
            <p><strong>전문분야:</strong> {viewInstructor.specialties?.join(', ') || '-'}</p>
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
                <Divider orientation="left" plain>학위</Divider>
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
                <Divider orientation="left" plain>주요경력</Divider>
                {viewInstructor.careers.map((c, i) => (
                  <p key={i}>{c.company} / {c.role} ({c.period}){c.description ? ` - ${c.description}` : ''}</p>
                ))}
              </>
            )}

            {Array.isArray(viewInstructor.publications) && viewInstructor.publications.length > 0 && (
              <>
                <Divider orientation="left" plain>출판/논문</Divider>
                {viewInstructor.publications.map((p, i) => (
                  <p key={i}>[{p.type}] {p.title}{p.publisher ? ` - ${p.publisher}` : ''}{p.year ? ` (${p.year})` : ''}</p>
                ))}
              </>
            )}

            {Array.isArray(viewInstructor.certifications) && viewInstructor.certifications.length > 0 && (
              <>
                <Divider orientation="left" plain>자격증</Divider>
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

// 학위 첨부파일 업로드 컴포넌트
function DegreeFileUpload({ name, form, onUpload }: {
  name: number;
  form: ReturnType<typeof Form.useForm>[0];
  onUpload: (file: RcFile) => Promise<string>;
}) {
  const fileUrl = Form.useWatch(['degrees', name, 'fileUrl'], form);
  return (
    <div style={{ marginBottom: 0 }}>
      <Form.Item name={[name, 'fileUrl']} hidden><Input /></Form.Item>
      <Upload
        showUploadList={false}
        accept="image/*,.pdf"
        beforeUpload={async (file) => {
          try {
            const url = await onUpload(file);
            form.setFieldValue(['degrees', name, 'fileUrl'], url);
            message.success('첨부 완료');
          } catch { message.error('업로드 실패'); }
          return false;
        }}
      >
        <Button size="small" icon={<UploadOutlined />} type={fileUrl ? 'primary' : 'default'}>
          {fileUrl ? '첨부됨' : '첨부'}
        </Button>
      </Upload>
    </div>
  );
}

// 자격증 사본 업로드 컴포넌트
function CertFileUpload({ name, form, onUpload }: {
  name: number;
  form: ReturnType<typeof Form.useForm>[0];
  onUpload: (file: RcFile) => Promise<string>;
}) {
  const fileUrl = Form.useWatch(['certifications', name, 'fileUrl'], form);
  return (
    <div style={{ marginBottom: 0 }}>
      <Form.Item name={[name, 'fileUrl']} hidden><Input /></Form.Item>
      <Upload
        showUploadList={false}
        accept="image/*,.pdf"
        beforeUpload={async (file) => {
          try {
            const url = await onUpload(file);
            form.setFieldValue(['certifications', name, 'fileUrl'], url);
            message.success('사본 첨부 완료');
          } catch { message.error('업로드 실패'); }
          return false;
        }}
      >
        <Button size="small" icon={<UploadOutlined />} type={fileUrl ? 'primary' : 'default'}>
          {fileUrl ? '첨부됨' : '사본'}
        </Button>
      </Upload>
    </div>
  );
}
