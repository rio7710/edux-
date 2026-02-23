import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  Result,
} from 'antd';
import type { ColumnType } from 'antd/es/table';
import { PlusOutlined, EyeOutlined, DeleteOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api/mcpClient';
import { useAuth } from '../contexts/AuthContext';
import { useSitePermissions } from '../hooks/useSitePermissions';
import { useTableConfig } from '../hooks/useTableConfig';
import { useDraftStorage } from '../hooks/useDraftStorage';
import { useSessionExpiredGuard } from '../hooks/useSessionExpiredGuard';
import PageHeader from '../components/PageHeader';
import { buildColumns, NO_COLUMN_KEY } from '../utils/tableConfig';
import { DEFAULT_COLUMNS } from '../utils/tableDefaults';
import { useLocation, useNavigate } from 'react-router-dom';
import { isAuthErrorMessage, parseMcpError } from '../utils/error';

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
  <p>{{course.content}}</p>
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

type TemplateDraft = {
  id?: string;
  name?: string;
  type?: string;
  html?: string;
  css?: string;
  updatedAt?: string;
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
  const [tabPreviewHtml, setTabPreviewHtml] = useState('');
  const [previewTargetOpen, setPreviewTargetOpen] = useState(false);
  const [previewTargetId, setPreviewTargetId] = useState<string | undefined>();
  const [previewTargetType, setPreviewTargetType] = useState<
    'course_intro' | 'instructor_profile' | 'brochure_package' | undefined
  >(undefined);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
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
  const draftPromptOpenRef = useRef(false);
  const { canAccessMenu, canUseFeature } = useSitePermissions(user?.role);
  const canAccessTemplatesMenu = canAccessMenu('templates');
  const canUpsertTemplateBySite = canUseFeature('templates', 'template.upsert');
  const canDeleteTemplateBySite = canUseFeature('templates', 'template.delete');

  const draftKey = useMemo(() => {
    if (templateType) return `draft:template:${templateType}`;
    return 'draft:template:all';
  }, [templateType]);

  const buildDraftPayload = useCallback((values?: Record<string, unknown>): TemplateDraft => {
    const raw = values || form.getFieldsValue();
    return {
      ...raw,
      id: editingTemplateId || (raw.id as string) || undefined,
      type: templateType || (raw.type as string) || 'course_intro',
      html: (raw.html as string) ?? form.getFieldValue('html'),
      css: (raw.css as string) ?? form.getFieldValue('css'),
      updatedAt: new Date().toISOString(),
    };
  }, [editingTemplateId, form, templateType]);

  const { saveDraft, loadDraft, clearDraft } = useDraftStorage<TemplateDraft>(
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

  const saveMutation = useMutation({
    mutationFn: (data: { id?: string; name: string; type: string; html: string; css: string }) =>
      api.templateUpsert({ ...data, token: accessToken || '' }),
    onSuccess: () => {
      message.success(editingTemplateId ? '템플릿이 수정되었습니다' : '템플릿이 저장되었습니다');
      setIsModalOpen(false);
      setEditingTemplateId(null);
      form.resetFields();
      clearDraft();
      listMutation.mutate();
    },
    onError: (error: Error) => {
      if (isAuthError(error.message)) {
        handleSessionExpired(error.message);
        return;
      }
      message.error(`저장 실패: ${parseMcpError(error.message)}`);
    },
  });

  const listMutation = useMutation({
    mutationFn: () => {
      if (!accessToken) {
        throw new Error('인증이 필요합니다.');
      }
      return api.templateList(1, 50, templateType, accessToken);
    },
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
    if (!accessToken) {
      setTemplates([]);
      return;
    }
    listMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, templateType]);

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
    setEditingTemplateId(draft.id || null);
    setIsModalOpen(true);
    setTabPreviewHtml('');
  }, [location.search, templateType]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('create') !== '1') return;
    handleCreate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const handleTabChange = async (key: string) => {
    if (key !== 'preview') return;
    const html = form.getFieldValue('html');
    const css = form.getFieldValue('css');
    if (!html || !css) return;
    if (!accessToken) {
      message.warning('로그인 후 이용해주세요.');
      return;
    }

    const currentType = templateType || form.getFieldValue('type');

    try {
      let data: Record<string, unknown> = {};

      if (currentType === 'course_intro') {
        // DB에서 [샘플] 과정 조회
        const listResult = await api.courseList(50, 0, accessToken) as any;
        const sampleCourse = (listResult.courses || []).find(
          (c: any) => c.title?.startsWith(SAMPLE_COURSE_PREFIX)
        );
        if (sampleCourse) {
          const course = await api.courseGet(sampleCourse.id, accessToken) as any;
          data = {
            course,
            content: course.content || '',
            instructors: course.Instructors || [],
            lectures: course.Lectures || [],
            modules: course.Lectures || [],
          };
        } else {
          message.warning('샘플 과정이 없습니다. 과정 관리에서 [샘플]로 시작하는 과정을 만들어주세요.');
          return;
        }
      } else if (currentType === 'instructor_profile') {
        const listResult = await api.instructorList(accessToken, 50, 0) as any;
        const first = (listResult.instructors || [])[0];
        if (first) {
          const instructor = await api.instructorGet(first.id, accessToken) as any;
          data = {
            instructor,
            courses: instructor.Courses || [],
            schedules: instructor.Schedules || [],
          };
        }
      } else if (currentType === 'brochure_package') {
        const [courseListResult, instructorListResult] = await Promise.all([
          api.courseList(50, 0, accessToken) as Promise<{ courses?: any[] }>,
          api.instructorList(accessToken, 50, 0) as Promise<{ instructors?: any[] }>,
        ]);
        const sampleCourses = (courseListResult.courses || []).slice(0, 3);
        const sampleInstructors = (instructorListResult.instructors || []).slice(0, 3);
        data = {
          brochure: {
            title: '브로셔 샘플',
            summary: '코스와 강사를 묶어 소개하는 브로셔 샘플입니다.',
          },
          courses: sampleCourses,
          instructors: sampleInstructors,
        };
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
    if (!canUpsertTemplateBySite) {
      message.warning('사이트 권한 설정에 따라 템플릿 등록/수정 기능이 비활성화되었습니다.');
      return;
    }
    if (!accessToken) {
      message.warning('로그인 후 이용해주세요.');
      return;
    }
    setEditingTemplateId(null);
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
          setEditingTemplateId(draft.id || null);
          setTabPreviewHtml('');
          setIsModalOpen(true);
          draftPromptOpenRef.current = false;
        },
        onCancel: () => {
          clearDraft();
          setEditingTemplateId(null);
          form.setFieldsValue({
            name: '',
            type: templateType || 'course_intro',
            html: initialHtml,
            css: initialCss,
          });
          setTabPreviewHtml('');
          setIsModalOpen(true);
          draftPromptOpenRef.current = false;
          message.info('임시 저장을 삭제하고 새로 작성합니다.');
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
    setTabPreviewHtml('');
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!canUpsertTemplateBySite) {
      message.warning('사이트 권한 설정에 따라 템플릿 등록/수정 기능이 비활성화되었습니다.');
      return;
    }
    if (!accessToken) {
      message.warning('로그인 후 이용해주세요.');
      return;
    }
    try {
      const values = await form.validateFields();
      saveMutation.mutate({ ...values, id: editingTemplateId || undefined });
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
    if (!accessToken) {
      message.warning('로그인 후 이용해주세요.');
      return;
    }
    const values = getFormValues();
    const currentType = templateType || values.type;
    if (!currentType) {
      message.warning('구분을 먼저 선택하세요.');
      return;
    }

    if (currentType === 'course_intro') {
      if (courses.length === 0) {
        api.courseList(50, 0, accessToken).then((result) => {
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
        api.instructorList(accessToken, 50, 0).then((result) => {
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

    if (currentType === 'brochure_package') {
      if (!accessToken) {
        message.warning('로그인 후 이용해주세요.');
        return;
      }
      Promise.all([
        api.courseList(50, 0, accessToken) as Promise<{ courses?: any[] }>,
        api.instructorList(accessToken, 50, 0) as Promise<{ instructors?: any[] }>,
      ]).then(([courseListResult, instructorListResult]) => {
        previewMutation.mutate({
          html: values.html,
          css: values.css,
          data: {
            brochure: {
              title: '브로셔 샘플',
              summary: '코스와 강사를 묶어 소개하는 브로셔 샘플입니다.',
            },
            courses: (courseListResult.courses || []).slice(0, 3),
            instructors: (instructorListResult.instructors || []).slice(0, 3),
          },
        });
      }).catch((error: Error) => {
        if (isAuthError(error.message)) {
          handleSessionExpired(error.message);
          return;
        }
        message.error(`브로셔 미리보기 실패: ${error.message}`);
      });
      return;
    }

    message.info('미리보기할 구분(과정 소개/강사 프로필)을 선택하세요.');
  };

  const handleConfirmPreviewTarget = async () => {
    if (!accessToken) {
      message.warning('로그인 후 이용해주세요.');
      return;
    }
    const values = getFormValues();
    const currentType = templateType || values.type;
    if (!currentType || !previewTargetId) {
      message.warning('대상을 선택하세요.');
      return;
    }

    if (currentType === 'course_intro') {
      try {
        const course = (await api.courseGet(previewTargetId, accessToken)) as any;
        const data = {
          course,
          content: course.content || '',
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
        const instructor = (await api.instructorGet(previewTargetId, accessToken)) as any;
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
      width: 140,
      render: (_: unknown, record: Template) => (
        <Space>
          <Button
            icon={<EyeOutlined />}
            size="small"
            onClick={() => {
              form.setFieldsValue(record);
              setEditingTemplateId(record.id);
              setTabPreviewHtml('');
              setIsModalOpen(true);
            }}
          />
          <Button
            danger
            icon={<DeleteOutlined />}
            size="small"
            disabled={!canDeleteTemplateBySite}
            onClick={() => {
              if (!canDeleteTemplateBySite) {
                message.warning('사이트 권한 설정에 따라 템플릿 삭제 기능이 비활성화되었습니다.');
                return;
              }
              if (!accessToken) {
                message.warning('로그인 후 이용해주세요.');
                return;
              }
              Modal.confirm({
                title: '템플릿을 삭제할까요?',
                content: '삭제하면 복구할 수 없습니다.',
                okText: '삭제',
                okButtonProps: { danger: true },
                cancelText: '취소',
                onOk: async () => {
                  try {
                    await api.templateDelete({ id: record.id, token: accessToken });
                    message.success('삭제되었습니다');
                    listMutation.mutate();
                  } catch (error: any) {
                    if (isAuthError(error.message)) {
                      handleSessionExpired(error.message);
                      return;
                    }
                    message.error(`삭제 실패: ${error.message}`);
                  }
                },
              });
            }}
          />
        </Space>
      ),
    },
  };
  const columns = buildColumns<Template>(columnConfigs, columnMap);

  if (!canAccessTemplatesMenu) {
    return (
      <Result
        status="403"
        title="메뉴 비활성화"
        subTitle="사이트 관리의 권한관리에서 템플릿 관리 메뉴가 비활성화되었습니다."
      />
    );
  }

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        showOutlineShortcut={user?.role === 'admin'}
        onClickOutlineShortcut={() => navigate('/admin/site-settings?tab=outline&tableKey=templates')}
        actions={(
          <>
            <Button onClick={() => listMutation.mutate()} loading={listMutation.isPending}>
              새로고침
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreate}
              disabled={!canUpsertTemplateBySite}
            >
              새 템플릿
            </Button>
          </>
        )}
      />

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
          <Button key="save" type="primary" onClick={handleSubmit} loading={saveMutation.isPending}>
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
          <Form.Item name="id" hidden>
            <Input />
          </Form.Item>
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
                  { value: 'brochure_package', label: '브로셔' },
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
    brochure_package: '브로셔',
  };
