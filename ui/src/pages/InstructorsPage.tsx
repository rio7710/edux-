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
  Spin,
} from 'antd';
import { PlusOutlined, EditOutlined, EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { api, mcpClient } from '../api/mcpClient';

interface Instructor {
  id: string;
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  affiliation?: string;
  specialties?: string[];
}

export default function InstructorsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInstructor, setEditingInstructor] = useState<Instructor | null>(null);
  const [viewInstructor, setViewInstructor] = useState<Instructor | null>(null);
  const [form] = Form.useForm();
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);

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

  const parseValidationError = (errorMessage: string): string => {
    // Parse MCP validation errors to user-friendly messages
    if (errorMessage.includes('Invalid email')) {
      return '이메일 형식이 올바르지 않습니다. (예: example@email.com)';
    }
    if (errorMessage.includes('Invalid url')) {
      return 'URL 형식이 올바르지 않습니다. (예: https://example.com)';
    }
    if (errorMessage.includes('Required')) {
      return '필수 항목을 입력해주세요.';
    }
    // Return original message if no pattern matches
    return errorMessage;
  };

  const createMutation = useMutation({
    mutationFn: (data: Omit<Instructor, 'id'> & { id?: string }) => api.instructorUpsert(data),
    onSuccess: () => {
      message.success('강사가 정상적으로 등록되었습니다.');
      setIsModalOpen(false);
      form.resetFields();
      setEditingInstructor(null);
      loadInstructors(); // Refresh list from server
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

  const handleCreate = () => {
    setEditingInstructor(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleEdit = (instructor: Instructor) => {
    setEditingInstructor(instructor);
    form.setFieldsValue({
      ...instructor,
      specialties: instructor.specialties?.join(', '),
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const specialties = values.specialties
        ? values.specialties.split(',').map((s: string) => s.trim()).filter(Boolean)
        : [];

      createMutation.mutate({
        ...values,
        specialties,
        id: editingInstructor?.id,
      });
    } catch (error) {
      // Validation failed
    }
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
      title: '이름',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '직함',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: '소속',
      dataIndex: 'affiliation',
      key: 'affiliation',
    },
    {
      title: '전문분야',
      dataIndex: 'specialties',
      key: 'specialties',
      render: (specialties: string[] | undefined) => {
        const arr = Array.isArray(specialties) ? specialties : [];
        return (
          <>
            {arr.slice(0, 2).map(s => <Tag key={s}>{s}</Tag>)}
            {arr.length > 2 && <Tag>+{arr.length - 2}</Tag>}
          </>
        );
      },
    },
    {
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
  ];

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
        onCancel={() => setIsModalOpen(false)}
        confirmLoading={createMutation.isPending}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="이름"
            rules={[{ required: true, message: '이름을 입력하세요' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="title" label="직함">
            <Input placeholder="예: 수석 컨설턴트" />
          </Form.Item>
          <Form.Item
            name="email"
            label="이메일"
            rules={[
              { type: 'email', message: '올바른 이메일 형식을 입력하세요' }
            ]}
          >
            <Input placeholder="예: instructor@company.com" />
          </Form.Item>
          <Form.Item name="phone" label="전화번호">
            <Input />
          </Form.Item>
          <Form.Item name="affiliation" label="소속">
            <Input />
          </Form.Item>
          <Form.Item name="specialties" label="전문분야 (쉼표로 구분)">
            <Input placeholder="예: 리더십, 커뮤니케이션, 조직문화" />
          </Form.Item>
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
        width={600}
      >
        {viewInstructor && (
          <div>
            <p><strong>ID:</strong> {viewInstructor.id}</p>
            <p><strong>이름:</strong> {viewInstructor.name}</p>
            <p><strong>직함:</strong> {viewInstructor.title || '-'}</p>
            <p><strong>이메일:</strong> {viewInstructor.email || '-'}</p>
            <p><strong>전화번호:</strong> {viewInstructor.phone || '-'}</p>
            <p><strong>소속:</strong> {viewInstructor.affiliation || '-'}</p>
            <p><strong>전문분야:</strong> {viewInstructor.specialties?.join(', ') || '-'}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
