import { useState } from 'react';
import {
  Button,
  Table,
  Modal,
  Form,
  Input,
  message,
  Space,
  Tag,
} from 'antd';
import { PlusOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api/mcpClient';

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

  const createMutation = useMutation({
    mutationFn: (data: Omit<Instructor, 'id'> & { id?: string }) => api.instructorUpsert(data),
    onSuccess: (result: unknown) => {
      const instructorResult = result as { id: string };
      message.success('강사가 저장되었습니다');
      setIsModalOpen(false);
      const values = form.getFieldsValue();
      form.resetFields();

      if (editingInstructor) {
        setInstructors(prev => prev.map(i => i.id === editingInstructor.id ? { ...values, id: instructorResult.id } : i));
      } else {
        setInstructors(prev => [...prev, { ...values, id: instructorResult.id }]);
      }
      setEditingInstructor(null);
    },
    onError: (error: Error) => {
      message.error(`저장 실패: ${error.message}`);
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
      render: (specialties: string[]) => (
        <>
          {specialties?.slice(0, 2).map(s => <Tag key={s}>{s}</Tag>)}
          {specialties?.length > 2 && <Tag>+{specialties.length - 2}</Tag>}
        </>
      ),
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
          <Form.Item name="email" label="이메일">
            <Input type="email" />
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
