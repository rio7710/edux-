import { Button, Card, Input, Select, Space, Table, Tag, Modal, Form, Switch, message, Tooltip } from 'antd';
import { useMemo, useState } from 'react';
import { SettingOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';

type BoardCategory = 'notice' | 'update' | 'guide';

type BoardPost = {
  id: string;
  title: string;
  body: string;
  authorName: string;
  category: BoardCategory;
  isPinned: boolean;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
};

type BoardAdminPageProps = {
  embedded?: boolean;
};

export default function BoardAdminPage({ embedded = false }: BoardAdminPageProps) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<BoardCategory | 'all'>('all');
  const [status, setStatus] = useState<'all' | 'published' | 'draft'>('all');
  const [headerEditMode, setHeaderEditMode] = useState(false);
  const [posts, setPosts] = useState<BoardPost[]>([
    {
      id: 'b_001',
      title: '서비스 공지: 점검 안내',
      body: '2/16 01:00~03:00 시스템 점검이 예정되어 있습니다.',
      authorName: '관리자',
      category: 'notice',
      isPinned: true,
      isPublished: true,
      createdAt: '2026-02-10',
      updatedAt: '2026-02-10',
    },
    {
      id: 'b_002',
      title: '업데이트: 권한 관리 UI 개선',
      body: '사이트관리 탭에서 권한설정을 통합해 관리할 수 있도록 변경했습니다.',
      authorName: '운영자',
      category: 'update',
      isPinned: false,
      isPublished: true,
      createdAt: '2026-02-11',
      updatedAt: '2026-02-11',
    },
    {
      id: 'b_003',
      title: '가이드: 템플릿 작성 방법',
      body: '템플릿 작성 시 본문 스타일과 필수 입력 항목을 확인하세요.',
      authorName: '관리자',
      category: 'guide',
      isPinned: false,
      isPublished: false,
      createdAt: '2026-02-12',
      updatedAt: '2026-02-12',
    },
  ]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BoardPost | null>(null);
  const [form] = Form.useForm();

  const filtered = useMemo(() => {
    return posts.filter((post) => {
      if (category !== 'all' && post.category !== category) return false;
      if (status === 'published' && !post.isPublished) return false;
      if (status === 'draft' && post.isPublished) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        return post.title.toLowerCase().includes(q);
      }
      return true;
    });
  }, [posts, category, status, query]);

  const categoryLabel = (value: BoardCategory) => {
    if (value === 'notice') return '공지';
    if (value === 'update') return '업데이트';
    return '가이드';
  };

  const openEditor = (post?: BoardPost) => {
    if (post) {
      setEditing(post);
      form.setFieldsValue({
        title: post.title,
        body: post.body,
        authorName: post.authorName,
        category: post.category,
        isPinned: post.isPinned,
        isPublished: post.isPublished,
      });
    } else {
      setEditing(null);
      form.resetFields();
      form.setFieldsValue({
        authorName: user?.name || '관리자',
        category: 'notice',
        isPinned: false,
        isPublished: true,
      });
    }
    setOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    if (editing) {
      setPosts((prev) =>
        prev.map((item) =>
          item.id === editing.id
            ? {
                ...item,
                title: values.title,
                body: values.body,
                authorName: values.authorName,
                category: values.category,
                isPinned: values.isPinned,
                isPublished: values.isPublished,
                updatedAt: new Date().toISOString().slice(0, 10),
              }
            : item,
        ),
      );
      message.success('게시글이 수정되었습니다.');
    } else {
      setPosts((prev) => [
        {
          id: `b_${String(prev.length + 1).padStart(3, '0')}`,
          title: values.title,
          body: values.body,
          authorName: values.authorName,
          category: values.category,
          isPinned: values.isPinned,
          isPublished: values.isPublished,
          createdAt: new Date().toISOString().slice(0, 10),
          updatedAt: new Date().toISOString().slice(0, 10),
        },
        ...prev,
      ]);
      message.success('게시글이 등록되었습니다.');
    }
    setOpen(false);
  };

  const columns = [
    {
      title: '유형',
      dataIndex: 'category',
      width: 120,
      render: (value: BoardCategory) => <Tag>{categoryLabel(value)}</Tag>,
    },
    {
      title: '제목',
      dataIndex: 'title',
      render: (value: string, record: BoardPost) => (
        <Space>
          {record.isPinned ? <Tag color="gold">고정</Tag> : null}
          <span>{value}</span>
        </Space>
      ),
    },
    {
      title: '상태',
      dataIndex: 'isPublished',
      width: 120,
      render: (value: boolean) => (value ? <Tag color="green">게시중</Tag> : <Tag>초안</Tag>),
    },
    { title: '작성자', dataIndex: 'authorName', width: 120 },
    { title: '수정일', dataIndex: 'updatedAt', width: 120 },
    {
      title: '관리',
      dataIndex: 'actions',
      width: 200,
      render: (_: unknown, record: BoardPost) => (
        <Space>
          <Button size="small" onClick={() => openEditor(record)}>
            수정
          </Button>
          <Button
            size="small"
            onClick={() =>
              setPosts((prev) =>
                prev.map((item) =>
                  item.id === record.id
                    ? { ...item, isPublished: !item.isPublished, updatedAt: new Date().toISOString().slice(0, 10) }
                    : item,
                ),
              )
            }
          >
            {record.isPublished ? '내림' : '게시'}
          </Button>
          <Button
            size="small"
            danger
            onClick={() =>
              Modal.confirm({
                title: '게시글 삭제',
                content: '이 게시글을 삭제하시겠습니까? (UI 단계에서는 목록에서만 제거됩니다)',
                okText: '삭제',
                cancelText: '취소',
                onOk: () => setPosts((prev) => prev.filter((item) => item.id !== record.id)),
              })
            }
          >
            삭제
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {!embedded && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <Space size={8} align="center">
            <h2 style={{ margin: 0 }}>게시판 관리</h2>
            {headerEditMode && <Tag color="blue">목차 편집 모드</Tag>}
          </Space>
          {user?.role === 'admin' && (
            <Tooltip title={headerEditMode ? '목차 편집 모드 끄기' : '목차 편집 모드 켜기'}>
              <Button
                type="text"
                size="small"
                icon={<SettingOutlined />}
                onClick={() => setHeaderEditMode((prev) => !prev)}
                style={{ padding: 4 }}
              />
            </Tooltip>
          )}
        </div>
      )}
      <Card style={{ marginBottom: 16 }}>
        <Space style={{ marginBottom: 12 }} wrap>
          <Input
            placeholder="제목 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: 240 }}
          />
          <Select
            value={category}
            onChange={(value) => setCategory(value)}
            style={{ width: 140 }}
            options={[
              { value: 'all', label: '전체' },
              { value: 'notice', label: '공지' },
              { value: 'update', label: '업데이트' },
              { value: 'guide', label: '가이드' },
            ]}
          />
          <Select
            value={status}
            onChange={(value) => setStatus(value)}
            style={{ width: 140 }}
            options={[
              { value: 'all', label: '전체 상태' },
              { value: 'published', label: '게시중' },
              { value: 'draft', label: '초안' },
            ]}
          />
          <Button type="primary" onClick={() => openEditor()}>
            새 글 작성
          </Button>
        </Space>
        <Table
          columns={columns}
          dataSource={filtered}
          rowKey="id"
          pagination={{ pageSize: 8 }}
        />
      </Card>

      <Modal
        open={open}
        title={editing ? '게시글 수정' : '게시글 작성'}
        onCancel={() => setOpen(false)}
        onOk={handleSubmit}
        okText={editing ? '저장' : '등록'}
        cancelText="취소"
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="authorName" label="작성자" rules={[{ required: true, message: '작성자를 입력하세요.' }]}>
            <Input placeholder="작성자 입력" />
          </Form.Item>
          <Form.Item name="title" label="제목" rules={[{ required: true, message: '제목을 입력하세요.' }]}>
            <Input placeholder="제목 입력" />
          </Form.Item>
          <Form.Item name="body" label="본문" rules={[{ required: true, message: '본문을 입력하세요.' }]}>
            <Input.TextArea rows={6} placeholder="게시글 본문 입력" showCount maxLength={5000} />
          </Form.Item>
          <Form.Item name="category" label="유형" rules={[{ required: true, message: '유형을 선택하세요.' }]}>
            <Select
              options={[
                { value: 'notice', label: '공지' },
                { value: 'update', label: '업데이트' },
                { value: 'guide', label: '가이드' },
              ]}
            />
          </Form.Item>
          <Form.Item name="isPinned" label="상단 고정" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="isPublished" label="게시 여부" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
