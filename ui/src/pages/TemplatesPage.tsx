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
} from 'antd';
import { PlusOutlined, EyeOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api/mcpClient';
import { useAuth } from '../contexts/AuthContext';

interface Template {
  id: string;
  name: string;
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

export default function TemplatesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [form] = Form.useForm();
  const [templates, setTemplates] = useState<Template[]>([]);
  const { accessToken } = useAuth();

  const createMutation = useMutation({
    mutationFn: (data: { name: string; html: string; css: string }) =>
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
    mutationFn: () => api.templateList(1, 50),
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
      setPreviewHtml(result as string);
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
      html: defaultHtml,
      css: defaultCss,
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
    const sampleData = {
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
    previewMutation.mutate({
      html: values.html,
      css: values.css,
      data: sampleData,
    });
  };

  const columns = [
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
        <h2 style={{ margin: 0 }}>템플릿 관리</h2>
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
    </div>
  );
}
