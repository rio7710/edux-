import { useState, useEffect } from 'react';
import {
  Button,
  Table,
  Modal,
  Form,
  Input,
  InputNumber,
  Switch,
  message,
  Space,
} from 'antd';
import { PlusOutlined, EditOutlined, EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { api, mcpClient } from '../api/mcpClient';

interface Course {
  id: string;
  title: string;
  description?: string;
  durationHours?: number;
  isOnline?: boolean;
  equipment?: string[];
  goal?: string;
  notes?: string;
}

export default function CoursesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [viewCourse, setViewCourse] = useState<Course | null>(null);
  const [form] = Form.useForm();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCourses = async () => {
    try {
      setLoading(true);
      const result = await api.courseList() as { courses: Course[]; total: number };
      setCourses(result.courses);
    } catch (error) {
      console.error('Failed to load courses:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    mcpClient.onConnect(() => {
      loadCourses();
    });
  }, []);

  const createMutation = useMutation({
    mutationFn: (data: Omit<Course, 'id'> & { id?: string }) => api.courseUpsert(data),
    onSuccess: () => {
      message.success('코스가 정상적으로 저장되었습니다.');
      setIsModalOpen(false);
      form.resetFields();
      setEditingCourse(null);
      loadCourses(); // Refresh list from server
    },
    onError: (error: Error) => {
      message.error(`저장 실패: ${error.message}`);
    },
  });

  const fetchCourseMutation = useMutation({
    mutationFn: (id: string) => api.courseGet(id),
    onSuccess: (result: unknown) => {
      const course = result as Course;
      setViewCourse(course);
      // Update local list if exists
      setCourses(prev => {
        const exists = prev.find(c => c.id === course.id);
        if (exists) {
          return prev.map(c => c.id === course.id ? course : c);
        }
        return [...prev, course];
      });
    },
    onError: (error: Error) => {
      message.error(`조회 실패: ${error.message}`);
    },
  });

  const handleCreate = () => {
    setEditingCourse(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleEdit = (course: Course) => {
    setEditingCourse(course);
    form.setFieldsValue(course);
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      createMutation.mutate({
        ...values,
        id: editingCourse?.id,
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
      title: '코스명',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: '시간',
      dataIndex: 'durationHours',
      key: 'durationHours',
      width: 80,
      render: (hours: number) => hours ? `${hours}시간` : '-',
    },
    {
      title: '온라인',
      dataIndex: 'isOnline',
      key: 'isOnline',
      width: 80,
      render: (isOnline: boolean) => isOnline ? '예' : '아니오',
    },
    {
      title: '액션',
      key: 'action',
      width: 150,
      render: (_: unknown, record: Course) => (
        <Space>
          <Button
            icon={<EyeOutlined />}
            size="small"
            onClick={() => fetchCourseMutation.mutate(record.id)}
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
        <h2 style={{ margin: 0 }}>코스 관리</h2>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadCourses} loading={loading}>
            새로고침
          </Button>
          <Input.Search
            placeholder="코스 ID로 조회"
            onSearch={(id) => id && fetchCourseMutation.mutate(id)}
            style={{ width: 250 }}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            새 코스
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={courses}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      {/* Create/Edit Modal */}
      <Modal
        title={editingCourse ? '코스 수정' : '새 코스 생성'}
        open={isModalOpen}
        onOk={handleSubmit}
        onCancel={() => setIsModalOpen(false)}
        confirmLoading={createMutation.isPending}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="title"
            label="코스명"
            rules={[{ required: true, message: '코스명을 입력하세요' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="description" label="설명">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="durationHours" label="교육 시간">
            <InputNumber min={1} addonAfter="시간" />
          </Form.Item>
          <Form.Item name="isOnline" label="온라인 여부" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="goal" label="교육 목표">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="notes" label="비고">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* View Modal */}
      <Modal
        title="코스 상세"
        open={!!viewCourse}
        onCancel={() => setViewCourse(null)}
        footer={[
          <Button key="close" onClick={() => setViewCourse(null)}>
            닫기
          </Button>,
          <Button key="edit" type="primary" onClick={() => {
            if (viewCourse) {
              handleEdit(viewCourse);
              setViewCourse(null);
            }
          }}>
            수정
          </Button>,
        ]}
        width={600}
      >
        {viewCourse && (
          <div>
            <p><strong>ID:</strong> {viewCourse.id}</p>
            <p><strong>코스명:</strong> {viewCourse.title}</p>
            <p><strong>설명:</strong> {viewCourse.description || '-'}</p>
            <p><strong>교육 시간:</strong> {viewCourse.durationHours ? `${viewCourse.durationHours}시간` : '-'}</p>
            <p><strong>온라인:</strong> {viewCourse.isOnline ? '예' : '아니오'}</p>
            <p><strong>교육 목표:</strong> {viewCourse.goal || '-'}</p>
            <p><strong>비고:</strong> {viewCourse.notes || '-'}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
