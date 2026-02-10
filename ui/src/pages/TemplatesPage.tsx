import { useState, useEffect, useMemo } from 'react';
import {
  Button,
  Table,
  Modal,
  Form,
  Input,
  message,
  Space,
  Tabs,
  Select,
} from 'antd';
import type { ColumnType } from 'antd/es/table';
import { PlusOutlined, EyeOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api/mcpClient';
import { useAuth } from '../contexts/AuthContext';
import { useTableConfig } from '../hooks/useTableConfig';
import { buildColumns, NO_COLUMN_KEY } from '../utils/tableConfig';
import { DEFAULT_COLUMNS } from '../utils/tableDefaults';
import { useLocation, useNavigate } from 'react-router-dom';

interface Template {
  id: string;
  name: string;
  type?: string;
  html: string;
  css: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

const defaultHtml = `<div class="course-plan">
  <h1>{{course.title}}</h1>
  <p>{{course.description}}</p>

  <h2>교육 목표</h2>
  <p>{{course.goal}}</p>

  <h2>교육 내용</h2>
  <ul>
    {{#each modules}}
    <li>{{this.title}} ({{this.hours}}시간)</li>
    {{/each}}
  </ul>
</div>`;

const defaultCss = `.course-plan {
  font-family: 'Noto Sans KR', sans-serif;
  max-width: 800px;
  margin: 0 auto;
  padding: 40px;
}

h1 {
  color: #1a1a1a;
  border-bottom: 2px solid #1890ff;
  padding-bottom: 10px;
}

h2 {
  color: #333;
  margin-top: 30px;
}

ul {
  line-height: 1.8;
}`;

const SAMPLE_COURSE_PREFIX = '[샘플]';

type TemplatesPageProps = {
  title?: string;
  description?: string;
  typeLabel?: string;
  templateType?: string;
  defaultHtml?: string;
  defaultCss?: string;
};

export default function TemplatesPage({
  title = '템플릿 관리',
  description,
  typeLabel,
  templateType,
  defaultHtml: initialHtml = defaultHtml,
  defaultCss: initialCss = defaultCss,
}: TemplatesPageProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [tabPreviewHtml, setTabPreviewHtml] = useState('');
  const [previewTargetOpen, setPreviewTargetOpen] = useState(false);
  const [previewTargetId, setPreviewTargetId] = useState<string | undefined>();
  const [previewTargetType, setPreviewTargetType] = useState<
    'course_intro' | 'instructor_profile' | undefined
  >(undefined);
  const [form] = Form.useForm();
  const [templates, setTemplates] = useState<Template[]>([]);
  const { accessToken, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { configs: columnConfigs } = useTableConfig(
    'templates',
    DEFAULT_COLUMNS.templates,
  );
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  const [instructors, setInstructors] = useState<{ id: string; name: string }[]>(
    [],
  );

  const draftKey = useMemo(() => {
    if (templateType) return `draft:template:${templateType}`;
    return 'draft:template:all';
  }, [templateType]);

  const saveDraft = (values?: Record<string, unknown>) => {
    const raw = values || form.getFieldsValue();
    const payload = {
      ...raw,
      type: templateType || (raw.type as string) || 'course_intro',
      html: (raw.html as string) ?? form.getFieldValue('html'),
      css: (raw.css as string) ?? form.getFieldValue('css'),
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

  const isAuthError = (messageText: string) => {
    return /인증|토큰|로그인|권한|세션|MCP 연결 시간이 초과되었습니다|요청 시간이 초과되었습니다/.test(
      messageText,
    );
  };

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

  const createMutation = useMutation({
    mutationFn: (data: { name: string; type: string; html: string; css: string }) =>
      api.templateCreate({ ...data, token: accessToken || undefined }),
    onSuccess: (result: unknown) => {
      const templateResult = result as { id: string; name: string };
      message.success('템플릿이 저장되었습니다');
      setIsModalOpen(false);
      const values = form.getFieldsValue();
      setTemplates(prev => [...prev, { ...values, id: templateResult.id }]);
      form.resetFields();
      clearDraft();
    },
    onError: (error: Error) => {
      if (isAuthError(error.message)) {
        handleSessionExpired(error.message);
        return;
      }
      message.error(`저장 실패: ${error.message}`);
    },
  });

  const listMutation = useMutation({
    mutationFn: () => api.templateList(1, 50, templateType),
    onSuccess: (result: unknown) => {
      const data = result as { items: Template[]; total: number };
      setTemplates(data.items || []);
    },
    onError: (error: Error) => {
      if (isAuthError(error.message)) {
        handleSessionExpired(error.message);
        return;
      }
      message.error(`목록 조회 실패: ${error.message}`);
    },
  });

  const extractHtml = (result: unknown): string => {
    if (typeof result === 'string') return result;
    if (result && typeof result === 'object') {
      const obj = result as Record<string, unknown>;
      return (obj.html as string) || (obj.text as string) || '';
    }
    return '';
  };

  // 버튼 미리보기 → 새 팝업 창
  const previewMutation = useMutation({
    mutationFn: ({ html, css, data }: { html: string; css: string; data: Record<string, unknown> }) =>
      api.templatePreviewHtml(html, css, data),
    onSuccess: (result: unknown) => {
      const html = extractHtml(result);
      setPreviewHtml(html);
      const win = window.open('', '_blank', 'width=900,height=1200');
      if (win) {
        win.document.open();
        win.document.write(html);
        win.document.close();
      }
    },
    onError: (error: Error) => {
      if (isAuthError(error.message)) {
        handleSessionExpired(error.message);
        return;
      }
      message.error(`미리보기 실패: ${error.message}`);
    },
  });

  // 탭 미리보기 → 인라인 iframe
  const tabPreviewMutation = useMutation({
    mutationFn: ({ html, css, data }: { html: string; css: string; data: Record<string, unknown> }) =>
      api.templatePreviewHtml(html, css, data),
    onSuccess: (result: unknown) => {
      setTabPreviewHtml(extractHtml(result));
    },
    onError: (error: Error) => {
      if (isAuthError(error.message)) {
        handleSessionExpired(error.message);
        return;
      }
      message.error(`미리보기 실패: ${error.message}`);
    },
  });

  useEffect(() => {
    listMutation.mutate();
  }, []);

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
    if (draftParam !== (templateType || 'all')) return;
    const draft = loadDraft();
    if (!draft) return;
    form.setFieldsValue(draft);
    setIsModalOpen(true);
    setPreviewHtml('');
    setTabPreviewHtml('');
  }, [location.search, templateType]);

  const handleTabChange = async (key: string) => {
    if (key !== 'preview') return;
    const html = form.getFieldValue('html');
    const css = form.getFieldValue('css');
    if (!html || !css) return;

    const currentType = templateType || form.getFieldValue('type');

    try {
      let data: Record<string, unknown> = {};

      if (currentType === 'course_intro') {
        // DB에서 [샘플] 과정 조회
        const listResult = await api.courseList(50, 0) as any;
        const sampleCourse = (listResult.courses || []).find(
          (c: any) => c.title?.startsWith(SAMPLE_COURSE_PREFIX)
        );
        if (sampleCourse) {
          const course = await api.courseGet(sampleCourse.id) as any;
          data = {
            course,
            instructors: course.Instructors || [],
            lectures: course.Lectures || [],
            modules: course.Lectures || [],
          };
        } else {
          message.warning('샘플 과정이 없습니다. 과정 관리에서 [샘플]로 시작하는 과정을 만들어주세요.');
          return;
        }
      } else if (currentType === 'instructor_profile') {
        const listResult = await api.instructorList(50, 0) as any;
        const first = (listResult.instructors || [])[0];
        if (first) {
          const instructor = await api.instructorGet(first.id) as any;
          data = {
            instructor,
            courses: instructor.Courses || [],
            schedules: instructor.Schedules || [],
          };
        }
      }

      tabPreviewMutation.mutate({ html, css, data });
    } catch (err: any) {
      if (isAuthError(err.message)) {
        handleSessionExpired(err.message);
        return;
      }
      message.error(`샘플 데이터 로드 실패: ${err.message}`);
    }
  };

  const handleCreate = () => {
    if (!accessToken) {
      message.warning('로그인 후 이용해주세요.');
      return;
    }
    const draft = loadDraft();
    if (draft) {
      Modal.confirm({
        title: '임시 저장된 내용이 있습니다',
        content: '불러와서 이어서 작성할까요?',
        okText: '불러오기',
        cancelText: '삭제',
        onOk: () => {
          form.setFieldsValue(draft);
          setPreviewHtml('');
          setTabPreviewHtml('');
          setIsModalOpen(true);
        },
        onCancel: () => {
          clearDraft();
          form.setFieldsValue({
            name: '',
            type: templateType || 'course_intro',
            html: initialHtml,
            css: initialCss,
          });
          setPreviewHtml('');
          setTabPreviewHtml('');
          setIsModalOpen(true);
        },
      });
      return;
    }
    form.setFieldsValue({
      name: '',
      type: templateType || 'course_intro',
      html: initialHtml,
      css: initialCss,
    });
    setPreviewHtml('');
    setTabPreviewHtml('');
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!accessToken) {
      message.warning('로그인 후 이용해주세요.');
      return;
    }
    try {
      const values = await form.validateFields();
      createMutation.mutate(values);
    } catch (error) {
      // Validation failed
    }
  };

  const getFormValues = () => ({
    ...form.getFieldsValue(),
    html: form.getFieldValue('html'),
    css: form.getFieldValue('css'),
  });

  const handlePreview = () => {
    const values = getFormValues();
    const currentType = templateType || values.type;
    if (!currentType) {
      message.warning('구분을 먼저 선택하세요.');
      return;
    }

    if (currentType === 'course_intro') {
      if (courses.length === 0) {
        api.courseList(50, 0).then((result) => {
          const data = result as { courses: { id: string; title: string }[] };
          setCourses(data.courses || []);
        }).catch((error: Error) => {
          if (isAuthError(error.message)) {
            handleSessionExpired(error.message);
            return;
          }
          message.error(`코스 목록 조회 실패: ${error.message}`);
        });
      }
      setPreviewTargetId(undefined);
      setPreviewTargetType('course_intro');
      setPreviewTargetOpen(true);
      return;
    }

    if (currentType === 'instructor_profile') {
      if (user?.role === 'instructor') {
        if (!accessToken) {
          message.warning('로그인 후 이용해주세요.');
          return;
        }
        api.instructorGetByUser(accessToken).then((result) => {
          const instructor = result as any;
          const data = {
            instructor,
            courses: instructor.Courses || [],
            schedules: instructor.Schedules || [],
          };
          previewMutation.mutate({
            html: values.html,
            css: values.css,
            data,
          });
        }).catch((error: Error) => {
          if (isAuthError(error.message)) {
            handleSessionExpired(error.message);
            return;
          }
          message.error(`미리보기 실패: ${error.message}`);
        });
        return;
      }

      if (instructors.length === 0) {
        api.instructorList(50, 0).then((result) => {
          const data = result as { instructors: { id: string; name: string }[] };
          setInstructors(data.instructors || []);
        }).catch((error: Error) => {
          if (isAuthError(error.message)) {
            handleSessionExpired(error.message);
            return;
          }
          message.error(`강사 목록 조회 실패: ${error.message}`);
        });
      }
      setPreviewTargetId(undefined);
      setPreviewTargetType('instructor_profile');
      setPreviewTargetOpen(true);
      return;
    }

    message.info('미리보기할 구분(과정 소개/강사 프로필)을 선택하세요.');
  };

  const handleConfirmPreviewTarget = async () => {
    const values = getFormValues();
    const currentType = templateType || values.type;
    if (!currentType || !previewTargetId) {
      message.warning('대상을 선택하세요.');
      return;
    }

    if (currentType === 'course_intro') {
      try {
        const course = (await api.courseGet(previewTargetId)) as any;
        const data = {
          course,
          instructors: course.Instructors || [],
          lectures: course.Lectures || [],
          modules: course.Lectures || [],
          schedules: course.Schedules || [],
          courseLectures: course.Lectures || [],
          courseSchedules: course.Schedules || [],
        };
        previewMutation.mutate({
          html: values.html,
          css: values.css,
          data,
        });
        setPreviewTargetOpen(false);
      } catch (error: any) {
        if (isAuthError(error.message)) {
          handleSessionExpired(error.message);
          return;
        }
        message.error(`미리보기 실패: ${error.message}`);
      }
      return;
    }

    if (currentType === 'instructor_profile') {
      try {
        const instructor = (await api.instructorGet(previewTargetId)) as any;
        const data = {
          instructor,
          courses: instructor.Courses || [],
          schedules: instructor.Schedules || [],
        };
        previewMutation.mutate({
          html: values.html,
          css: values.css,
          data,
        });
        setPreviewTargetOpen(false);
      } catch (error: any) {
        if (isAuthError(error.message)) {
          handleSessionExpired(error.message);
          return;
        }
        message.error(`미리보기 실패: ${error.message}`);
      }
    }
  };

  const columnMap: Record<string, ColumnType<Template>> = {
    [NO_COLUMN_KEY]: {
      title: 'No',
      key: NO_COLUMN_KEY,
      width: 60,
      render: (_: unknown, __: Template, index: number) => index + 1,
    },
    id: {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 200,
      ellipsis: true,
    },
    name: { title: '템플릿명', dataIndex: 'name', key: 'name' },
    type: {
      title: '구분',
      key: 'type',
      width: 120,
      render: (_: unknown, record: Template) => {
        const label = record.type ? (typeLabelMap[record.type] || record.type) : undefined;
        return label || typeLabel || '-';
      },
    },
    createdAt: {
      title: '생성일',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => date ? new Date(date).toLocaleString('ko-KR') : '-',
    },
    updatedAt: {
      title: '수정일',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 180,
      render: (date: string) => date ? new Date(date).toLocaleString('ko-KR') : '-',
    },
    createdBy: {
      title: '등록자',
      dataIndex: 'createdBy',
      key: 'createdBy',
      width: 100,
      render: (createdBy: string) => createdBy || '-',
    },
    actions: {
      title: '액션',
      key: 'action',
      width: 100,
      render: (_: unknown, record: Template) => (
        <Button
          icon={<EyeOutlined />}
          size="small"
          onClick={() => {
            form.setFieldsValue(record);
            setPreviewHtml('');
            setTabPreviewHtml('');
            setIsModalOpen(true);
          }}
        />
      ),
    },
  };
  const columns = buildColumns<Template>(columnConfigs, columnMap);

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0 }}>{title}</h2>
          {description && (
            <div style={{ color: '#666', marginTop: 4 }}>{description}</div>
          )}
        </div>
        <Space>
          <Button onClick={() => listMutation.mutate()} loading={listMutation.isPending}>
            새로고침
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            새 템플릿
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={templates}
        rowKey="id"
        pagination={{ pageSize: 10 }}
        loading={listMutation.isPending}
      />

      <Modal
        title="템플릿 편집"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        width={1200}
        footer={[
          <Button key="cancel" onClick={() => setIsModalOpen(false)}>
            취소
          </Button>,
          <Button key="preview" onClick={handlePreview} loading={previewMutation.isPending}>
            미리보기
          </Button>,
          <Button key="save" type="primary" onClick={handleSubmit} loading={createMutation.isPending}>
            저장
          </Button>,
        ]}
      >
        <Form
          form={form}
          layout="vertical"
          onValuesChange={(_, allValues) => {
            if (!isModalOpen) return;
            saveDraft(allValues);
          }}
        >
          <Form.Item
            name="name"
            label="템플릿명"
            rules={[{ required: true, message: '템플릿명을 입력하세요' }]}
          >
            <Input />
          </Form.Item>
          {templateType ? (
            <Form.Item name="type" hidden>
              <Input />
            </Form.Item>
          ) : (
            <Form.Item
              name="type"
              label="구분"
              rules={[{ required: true, message: '구분을 선택하세요' }]}
            >
              <Select
                options={[
                  { value: 'instructor_profile', label: '강사 프로필' },
                  { value: 'course_intro', label: '과정 소개' },
                ]}
              />
            </Form.Item>
          )}

          <Tabs
            destroyInactiveTabPane={false}
            onChange={handleTabChange}
            items={[
              {
                key: 'html',
                label: 'HTML (Handlebars)',
                forceRender: true,
                children: (
                  <Form.Item name="html" preserve rules={[{ required: true }]}>
                    <Input.TextArea rows={12} style={{ fontFamily: 'monospace' }} />
                  </Form.Item>
                ),
              },
              {
                key: 'css',
                label: 'CSS',
                forceRender: true,
                children: (
                  <Form.Item name="css" preserve rules={[{ required: true }]}>
                    <Input.TextArea rows={12} style={{ fontFamily: 'monospace' }} />
                  </Form.Item>
                ),
              },
              {
                key: 'preview',
                label: `미리보기 (샘플)${tabPreviewMutation.isPending ? ' ...' : ''}`,
                children: tabPreviewHtml ? (
                  <iframe
                    srcDoc={tabPreviewHtml}
                    style={{
                      width: '100%',
                      height: 500,
                      border: '1px solid #d9d9d9',
                      borderRadius: 6,
                      background: '#e5e7eb',
                    }}
                    title="미리보기"
                  />
                ) : (
                  <div style={{
                    border: '1px solid #d9d9d9',
                    borderRadius: 6,
                    padding: 40,
                    minHeight: 300,
                    background: '#fafafa',
                    textAlign: 'center',
                    color: '#999',
                  }}>
                    탭을 선택하면 샘플 데이터로 미리보기가 자동 생성됩니다.
                  </div>
                ),
              },
            ]}
          />
        </Form>
      </Modal>

      <Modal
        title="미리보기 대상 선택"
        open={previewTargetOpen}
        onCancel={() => setPreviewTargetOpen(false)}
        onOk={handleConfirmPreviewTarget}
        okText="미리보기"
        cancelText="취소"
      >
        <Form layout="vertical">
          <Form.Item label={previewTargetType === 'course_intro' ? '코스 선택' : '강사 선택'}>
            <Select
              showSearch
              placeholder="선택하세요"
              value={previewTargetId}
              onChange={(value) => setPreviewTargetId(value)}
              options={
                previewTargetType === 'course_intro'
                  ? courses.map((c) => ({ value: c.id, label: c.title }))
                  : instructors.map((i) => ({ value: i.id, label: i.name }))
              }
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
  const typeLabelMap: Record<string, string> = {
    instructor_profile: '강사 프로필',
    course_intro: '과정 소개',
  };
