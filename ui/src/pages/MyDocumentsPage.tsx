import { useEffect, useState } from 'react';
import { Button, Table, Space, message, Modal, Tag } from 'antd';
import type { ColumnType } from 'antd/es/table';
import { api } from '../api/mcpClient';
import { useAuth } from '../contexts/AuthContext';

type DocumentItem = {
  id: string;
  label?: string | null;
  pdfUrl: string;
  shareToken?: string | null;
  targetType: string;
  targetId: string;
  createdAt: string;
  Template?: { id: string; name: string; type?: string | null };
  RenderJob?: { status?: string | null };
};

const targetLabels: Record<string, string> = {
  course: '코스',
  schedule: '일정',
  instructor_profile: '강사 프로필',
};

export default function MyDocumentsPage() {
  const { accessToken } = useAuth();
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const result = (await api.documentList({ token: accessToken, page: 1, pageSize: 50 })) as {
        items: DocumentItem[];
      };
      setItems(result.items || []);
    } catch (error: any) {
      message.error(`문서 목록 조회 실패: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [accessToken]);

  const handleShare = async (doc: DocumentItem, regenerate = false) => {
    if (!accessToken) return;
    try {
      const result = (await api.documentShare({ token: accessToken, id: doc.id, regenerate })) as {
        shareToken: string;
      };
      const shareUrl = `${window.location.origin}/share/${result.shareToken}`;
      await navigator.clipboard.writeText(shareUrl);
      message.success('공유 링크가 복사되었습니다.');
      load();
    } catch (error: any) {
      message.error(`공유 실패: ${error.message}`);
    }
  };

  const handleRevoke = async (doc: DocumentItem) => {
    if (!accessToken) return;
    try {
      await api.documentRevokeShare({ token: accessToken, id: doc.id });
      message.success('공유가 해제되었습니다.');
      load();
    } catch (error: any) {
      message.error(`공유 해제 실패: ${error.message}`);
    }
  };

  const handleDelete = async (doc: DocumentItem) => {
    if (!accessToken) return;
    Modal.confirm({
      title: '문서를 삭제할까요?',
      content: '삭제하면 복구할 수 없습니다.',
      okText: '삭제',
      okButtonProps: { danger: true },
      cancelText: '취소',
      onOk: async () => {
        try {
          await api.documentDelete({ token: accessToken, id: doc.id });
          message.success('삭제되었습니다.');
          load();
        } catch (error: any) {
          message.error(`삭제 실패: ${error.message}`);
        }
      },
    });
  };

  const columns: ColumnType<DocumentItem>[] = [
    {
      title: '문서명',
      dataIndex: 'label',
      key: 'label',
      render: (label: string | null | undefined, record) => label || record.Template?.name || '문서',
    },
    {
      title: '템플릿',
      key: 'template',
      render: (_: unknown, record) => record.Template?.name || '-',
    },
    {
      title: '대상',
      key: 'targetType',
      render: (_: unknown, record) => targetLabels[record.targetType] || record.targetType,
    },
    {
      title: '상태',
      key: 'status',
      render: (_: unknown, record) => (
        <Tag color={record.RenderJob?.status === 'done' ? 'green' : 'orange'}>
          {record.RenderJob?.status || 'pending'}
        </Tag>
      ),
    },
    {
      title: '생성일',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (value: string) => new Date(value).toLocaleString('ko-KR'),
    },
    {
      title: '액션',
      key: 'action',
      render: (_: unknown, record) => (
        <Space>
          <Button
            size="small"
            onClick={() => window.open(record.pdfUrl, '_blank')}
          >
            PDF
          </Button>
          <Button
            size="small"
            onClick={() => handleShare(record)}
          >
            공유
          </Button>
          <Button
            size="small"
            onClick={() => handleRevoke(record)}
            disabled={!record.shareToken}
          >
            공유 해제
          </Button>
          <Button
            size="small"
            danger
            onClick={() => handleDelete(record)}
          >
            삭제
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>내 문서함</h2>
        <Button onClick={load} loading={loading}>
          새로고침
        </Button>
      </div>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={items}
        loading={loading}
        pagination={{ pageSize: 20 }}
      />
    </div>
  );
}
