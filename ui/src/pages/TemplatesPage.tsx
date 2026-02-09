import { useState, useEffect } from 'react';
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
import { PlusOutlined, EyeOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api/mcpClient';
import { useAuth } from '../contexts/AuthContext';

interface Template {
  id: string;
  name: string;
  type?: string;
  html: string;
  css: string;
  createdAt?: string;
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

type TemplatesPageProps = {
  title?: string;
  description?: string;
  typeLabel?: string;
  templateType?: string;
  defaultHtml?: string;
  defaultCss?: string;
  sampleData?: Record<string, unknown>;
};

export default function TemplatesPage({
  title = '템플릿 관리',
  description,
  typeLabel,
  templateType,
  defaultHtml: initialHtml = defaultHtml,
  defaultCss: initialCss = defaultCss,
  sampleData,
}: TemplatesPageProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewTargetOpen, setPreviewTargetOpen] = useState(false);
  const [previewTargetId, setPreviewTargetId] = useState<string | undefined>();
  const [previewTargetType, setPreviewTargetType] = useState<
    'course_intro' | 'instructor_profile' | undefined
  >(undefined);
  const [form] = Form.useForm();
  const [templates, setTemplates] = useState<Template[]>([]);
  const { accessToken, user } = useAuth();
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  const [instructors, setInstructors] = useState<{ id: string; name: string }[]>(
    [],
  );

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
    },
    onError: (error: Error) => {
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
      message.error(`목록 조회 실패: ${error.message}`);
    },
  });

  const previewMutation = useMutation({
    mutationFn: ({ html, css, data }: { html: string; css: string; data: Record<string, unknown> }) =>
      api.templatePreviewHtml(html, css, data),
    onSuccess: (result: unknown) => {
      const html = result as string;
      setPreviewHtml(html);
      const win = window.open('', '_blank', 'width=900,height=1200');
      if (win) {
        win.document.open();
        win.document.write(html);
        win.document.close();
      }
    },
    onError: (error: Error) => {
      message.error(`미리보기 실패: ${error.message}`);
    },
  });

  useEffect(() => {
    listMutation.mutate();
  }, []);

  const handleCreate = () => {
    if (!accessToken) {
      message.warning('로그인 후 이용해주세요.');
      return;
    }
    form.setFieldsValue({
      name: '',
      type: templateType || 'course_intro',
      html: initialHtml,
      css: initialCss,
    });
    setPreviewHtml('');
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

  const handlePreview = () => {
    const values = form.getFieldsValue();
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
          const a4Css = '@page { size: A4; margin: 20mm; } body{ margin:0; }';
          previewMutation.mutate({
            html: values.html,
            css: `${a4Css}\n${values.css}`,
            data,
          });
        }).catch((error: Error) => {
          message.error(`미리보기 실패: ${error.message}`);
        });
        return;
      }

      if (instructors.length === 0) {
        api.instructorList(50, 0).then((result) => {
          const data = result as { instructors: { id: string; name: string }[] };
          setInstructors(data.instructors || []);
        });
      }
      setPreviewTargetId(undefined);
      setPreviewTargetType('instructor_profile');
      setPreviewTargetOpen(true);
      return;
    }

    const defaultSampleData = {
      course: {
        title: '샘플 코스',
        description: '코스 설명입니다.',
        goal: '교육 목표입니다.',
      },
      modules: [
        { title: '모듈 1', hours: 2 },
        { title: '모듈 2', hours: 3 },
      ],
    };
    const a4Css = '@page { size: A4; margin: 20mm; } body{ margin:0; }';
    previewMutation.mutate({
      html: values.html,
      css: `${a4Css}\n${values.css}`,
      data: sampleData || defaultSampleData,
    });
  };

  const handleConfirmPreviewTarget = async () => {
    const values = form.getFieldsValue();
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
        const a4Css = '@page { size: A4; margin: 20mm; } body{ margin:0; }';
        previewMutation.mutate({
          html: values.html,
          css: `${a4Css}\n${values.css}`,
          data,
        });
        setPreviewTargetOpen(false);
      } catch (error: any) {
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
        const a4Css = '@page { size: A4; margin: 20mm; } body{ margin:0; }';
        previewMutation.mutate({
          html: values.html,
          css: `${a4Css}\n${values.css}`,
          data,
        });
        setPreviewTargetOpen(false);
      } catch (error: any) {
        message.error(`미리보기 실패: ${error.message}`);
      }
    }
  };

  const columns = [
    {
      title: 'No',
      key: 'no',
      width: 60,
      render: (_: unknown, __: unknown, index: number) => index + 1,
    },
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 200,
      ellipsis: true,
    },
    {
      title: '템플릿명',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '구분',
      key: 'type',
      width: 120,
      render: (_: unknown, record: Template) => {
        const label = record.type ? (typeLabelMap[record.type] || record.type) : undefined;
        return label || typeLabel || '-';
      },
    },
    {
      title: '생성일',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => date ? new Date(date).toLocaleString('ko-KR') : '-',
    },
    {
      title: '등록자',
      dataIndex: 'createdBy',
      key: 'createdBy',
      width: 100,
      render: (createdBy: string) => createdBy || '-',
    },
    {
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
            setIsModalOpen(true);
          }}
        />
      ),
    },
  ];

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
        <Form form={form} layout="vertical">
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
            items={[
              {
                key: 'html',
                label: 'HTML (Handlebars)',
                children: (
                  <Form.Item name="html" rules={[{ required: true }]}>
                    <Input.TextArea rows={12} style={{ fontFamily: 'monospace' }} />
                  </Form.Item>
                ),
              },
              {
                key: 'css',
                label: 'CSS',
                children: (
                  <Form.Item name="css" rules={[{ required: true }]}>
                    <Input.TextArea rows={12} style={{ fontFamily: 'monospace' }} />
                  </Form.Item>
                ),
              },
              {
                key: 'preview',
                label: '미리보기',
                children: (
                  <div
                    style={{
                      border: '1px solid #d9d9d9',
                      borderRadius: 6,
                      padding: 16,
                      minHeight: 300,
                      background: '#fff',
                    }}
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                  />
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
