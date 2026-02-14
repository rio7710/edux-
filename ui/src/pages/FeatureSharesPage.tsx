import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Empty,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckCircleOutlined,
  CheckOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { api } from '../api/mcpClient';
import { useAuth } from '../contexts/AuthContext';
import { isAuthErrorMessage } from '../utils/error';

type CourseShareStatus = 'pending' | 'accepted' | 'rejected';
type MessageCategory = 'system' | 'course_share' | 'lecture_grant' | 'instructor_approval';

interface CourseShareRow {
  id: string;
  courseId: string;
  status: CourseShareStatus;
  createdAt?: string;
  respondedAt?: string | null;
  Course?: {
    id: string;
    title: string;
    description?: string;
  };
  SharedBy?: {
    id: string;
    name: string;
    email: string;
  };
}

interface LectureGrantRow {
  id: string;
  lectureId: string;
  canMap: boolean;
  canEdit: boolean;
  canReshare: boolean;
  grantedByUserId: string;
  createdAt?: string;
  Lecture?: {
    id: string;
    title: string;
  };
  courses?: Array<{
    id: string;
    title: string;
  }>;
}

interface UserMessageRow {
  id: string;
  category: MessageCategory;
  title: string;
  body?: string | null;
  actionType?: string | null;
  actionPayload?: Record<string, unknown> | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt?: string;
  Sender?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface MessageRecipientRow {
  id: string;
  name: string;
  email: string;
  role: string;
}

const statusTagColor: Record<CourseShareStatus, string> = {
  pending: 'gold',
  accepted: 'green',
  rejected: 'default',
};

const statusLabel: Record<CourseShareStatus, string> = {
  pending: '대기',
  accepted: '수락',
  rejected: '거절',
};

const messageCategoryColor: Record<MessageCategory, string> = {
  system: 'default',
  course_share: 'blue',
  lecture_grant: 'purple',
  instructor_approval: 'green',
};

const messageCategoryLabel: Record<MessageCategory, string> = {
  system: '시스템',
  course_share: '코스 공유',
  lecture_grant: '강의 공유',
  instructor_approval: '강사 승인',
};

const isAuthError = (messageText: string) => isAuthErrorMessage(messageText);

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('ko-KR');
};

export default function FeatureSharesPage() {
  const { accessToken, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [actionLoadingKey, setActionLoadingKey] = useState<string | null>(null);
  const [pendingShares, setPendingShares] = useState<CourseShareRow[]>([]);
  const [acceptedShares, setAcceptedShares] = useState<CourseShareRow[]>([]);
  const [rejectedShares, setRejectedShares] = useState<CourseShareRow[]>([]);
  const [lectureGrants, setLectureGrants] = useState<LectureGrantRow[]>([]);
  const [userMessages, setUserMessages] = useState<UserMessageRow[]>([]);
  const [messageQuery, setMessageQuery] = useState('');
  const [messageCategoryFilter, setMessageCategoryFilter] = useState<'all' | MessageCategory>('all');
  const [messageRecipients, setMessageRecipients] = useState<MessageRecipientRow[]>([]);
  const [sendRecipientIds, setSendRecipientIds] = useState<string[]>([]);
  const [sendToAllRecipients, setSendToAllRecipients] = useState(false);
  const [sendTitle, setSendTitle] = useState('');
  const [sendBody, setSendBody] = useState('');
  const [sendLoading, setSendLoading] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [activeTabKey, setActiveTabKey] = useState('messages-new');
  const [shareDataLoaded, setShareDataLoaded] = useState(false);

  const applyLocalReadUpdate = (updater: (row: UserMessageRow) => boolean) => {
    const readAt = new Date().toISOString();
    setUserMessages((prev) =>
      prev.map((row) =>
        updater(row) && !row.isRead
          ? {
              ...row,
              isRead: true,
              readAt,
            }
          : row,
      ),
    );
  };

  const loadMessages = async () => {
    if (!accessToken) return;
    try {
      const messages = (await api.messageList({ token: accessToken, limit: 200 })) as {
        messages: UserMessageRow[];
      };
      setUserMessages(messages.messages || []);
    } catch (error) {
      const err = error as Error;
      if (isAuthError(err.message)) {
        message.error('세션이 만료되었습니다. 다시 로그인해주세요.');
        logout();
        return;
      }
      message.error(`메시지 목록 조회 실패: ${err.message}`);
    }
  };

  const loadShareData = async () => {
    if (!accessToken) return;
    try {
      setLoading(true);
      const [pending, accepted, rejected, grants] = await Promise.all([
        api.courseShareListReceived({ token: accessToken, status: 'pending' }) as Promise<{
          shares: CourseShareRow[];
        }>,
        api.courseShareListReceived({ token: accessToken, status: 'accepted' }) as Promise<{
          shares: CourseShareRow[];
        }>,
        api.courseShareListReceived({ token: accessToken, status: 'rejected' }) as Promise<{
          shares: CourseShareRow[];
        }>,
        api.lectureGrantListMine({ token: accessToken }) as Promise<{ grants: LectureGrantRow[] }>,
      ]);

      setPendingShares(pending.shares || []);
      setAcceptedShares(accepted.shares || []);
      setRejectedShares(rejected.shares || []);
      setLectureGrants(grants.grants || []);
      setShareDataLoaded(true);
    } catch (error) {
      const err = error as Error;
      if (isAuthError(err.message)) {
        message.error('세션이 만료되었습니다. 다시 로그인해주세요.');
        logout();
        return;
      }
      message.error(`공유 목록 조회 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadRecipients = async () => {
    if (!accessToken) return;
    try {
      const result = (await api.messageRecipientList({
        token: accessToken,
        limit: 200,
      })) as { recipients: MessageRecipientRow[] };
      setMessageRecipients(result.recipients || []);
    } catch (error) {
      message.error(`수신자 목록 조회 실패: ${(error as Error).message}`);
    }
  };

  useEffect(() => {
    setShareDataLoaded(false);
    setPendingShares([]);
    setAcceptedShares([]);
    setRejectedShares([]);
    setLectureGrants([]);
    setMessageRecipients([]);
    void loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  useEffect(() => {
    if (activeTabKey === 'messages-new' || activeTabKey === 'messages-read') return;
    if (shareDataLoaded) return;
    void loadShareData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabKey, shareDataLoaded, accessToken]);

  useEffect(() => {
    if (!sendModalOpen) return;
    if (messageRecipients.length > 0) return;
    void loadRecipients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendModalOpen, accessToken, messageRecipients.length]);

  const handleRespondCourse = async (courseId: string, accept: boolean) => {
    if (!accessToken) return;
    const key = `respond:${courseId}:${accept ? 'accept' : 'reject'}`;
    setActionLoadingKey(key);
    try {
      await api.courseShareRespond({ token: accessToken, courseId, accept });
      message.success(accept ? '코스 공유를 수락했습니다.' : '코스 공유를 거절했습니다.');
      await loadShareData();
    } catch (error) {
      message.error(`코스 공유 응답 실패: ${(error as Error).message}`);
    } finally {
      setActionLoadingKey((current) => (current === key ? null : current));
    }
  };

  const handleLeaveCourse = async (courseId: string) => {
    if (!accessToken) return;
    const key = `leave-course:${courseId}`;
    setActionLoadingKey(key);
    try {
      await api.courseShareLeave({ token: accessToken, courseId });
      message.success('코스 공유를 해제했습니다.');
      await loadShareData();
    } catch (error) {
      message.error(`코스 공유 해제 실패: ${(error as Error).message}`);
    } finally {
      setActionLoadingKey((current) => (current === key ? null : current));
    }
  };

  const handleLeaveLecture = async (lectureId: string) => {
    if (!accessToken) return;
    const key = `leave-lecture:${lectureId}`;
    setActionLoadingKey(key);
    try {
      await api.lectureGrantLeave({ token: accessToken, lectureId });
      message.success('강의 공유를 해제했습니다.');
      await loadShareData();
    } catch (error) {
      message.error(`강의 공유 해제 실패: ${(error as Error).message}`);
    } finally {
      setActionLoadingKey((current) => (current === key ? null : current));
    }
  };

  const handleMarkMessageRead = async (messageId: string) => {
    if (!accessToken) return;
    const key = `mark:${messageId}:read`;
    setActionLoadingKey(key);
    const previousMessages = userMessages;
    applyLocalReadUpdate((row) => row.id === messageId);
    try {
      const startedAt = performance.now();
      await api.messageMarkRead({ token: accessToken, messageId, read: true });
      const elapsedMs = Math.round(performance.now() - startedAt);
      message.success(`읽음 처리 완료 (${elapsedMs}ms)`);
    } catch (error) {
      setUserMessages(previousMessages);
      message.error(`메시지 상태 변경 실패: ${(error as Error).message}`);
    } finally {
      setActionLoadingKey((current) => (current === key ? null : current));
    }
  };

  const handleMarkAllMessagesRead = async () => {
    if (!accessToken) return;
    const key = 'mark-all-read';
    setActionLoadingKey(key);
    const previousMessages = userMessages;
    if (messageCategoryFilter === 'all') {
      applyLocalReadUpdate(() => true);
    } else {
      applyLocalReadUpdate((row) => row.category === messageCategoryFilter);
    }
    try {
      const startedAt = performance.now();
      await api.messageMarkAllRead({
        token: accessToken,
        category: messageCategoryFilter === 'all' ? undefined : messageCategoryFilter,
      });
      const elapsedMs = Math.round(performance.now() - startedAt);
      message.success(`메시지를 읽음 처리했습니다. (${elapsedMs}ms)`);
    } catch (error) {
      setUserMessages(previousMessages);
      message.error(`전체 읽음 처리 실패: ${(error as Error).message}`);
    } finally {
      setActionLoadingKey((current) => (current === key ? null : current));
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!accessToken) return;
    const key = `delete-message:${messageId}`;
    setActionLoadingKey(key);
    const previousMessages = userMessages;
    setUserMessages((prev) => prev.filter((row) => row.id !== messageId));
    try {
      await api.messageDelete({ token: accessToken, messageId });
      message.success('메시지를 삭제했습니다.');
    } catch (error) {
      setUserMessages(previousMessages);
      message.error(`메시지 삭제 실패: ${(error as Error).message}`);
    } finally {
      setActionLoadingKey((current) => (current === key ? null : current));
    }
  };

  const handleSeedDummyMessages = async () => {
    if (!accessToken) return;
    const key = 'seed-dummy-message';
    setActionLoadingKey(key);
    try {
      await api.messageSeedDummy({ token: accessToken, count: 6 });
      message.success('더미 메시지 6개를 생성했습니다.');
      await loadMessages();
    } catch (error) {
      message.error(`더미 메시지 생성 실패: ${(error as Error).message}`);
    } finally {
      setActionLoadingKey((current) => (current === key ? null : current));
    }
  };

  const handleSendMessage = async () => {
    if (!accessToken) return;
    const recipientIds = sendToAllRecipients
      ? messageRecipients.map((item) => item.id)
      : sendRecipientIds;
    if (recipientIds.length === 0) {
      message.warning('수신자를 1명 이상 선택해주세요.');
      return;
    }
    if (!sendTitle.trim()) {
      message.warning('제목을 입력해주세요.');
      return;
    }
    setSendLoading(true);
    try {
      const sendResults = await Promise.allSettled(
        recipientIds.map((recipientUserId) =>
          api.messageSend({
            token: accessToken,
            recipientUserId,
            category: 'system',
            title: sendTitle.trim(),
            body: sendBody.trim() || undefined,
            actionType: 'user_message',
          }),
        ),
      );
      const successCount = sendResults.filter((result) => result.status === 'fulfilled').length;
      const failCount = sendResults.length - successCount;
      if (failCount === 0) {
        message.success(`${successCount}명에게 메시지를 전송했습니다.`);
      } else {
        message.warning(`전송 완료 ${successCount}명, 실패 ${failCount}명`);
      }
      setSendRecipientIds([]);
      setSendToAllRecipients(false);
      setSendTitle('');
      setSendBody('');
      setSendModalOpen(false);
      await loadMessages();
    } catch (error) {
      message.error(`메시지 전송 실패: ${(error as Error).message}`);
    } finally {
      setSendLoading(false);
    }
  };

  const messageItems = useMemo(() => {
    const keyword = messageQuery.trim().toLowerCase();
    return userMessages
      .filter((row) => {
        if (messageCategoryFilter !== 'all' && row.category !== messageCategoryFilter) return false;
        if (!keyword) return true;
        return (
          row.title.toLowerCase().includes(keyword) ||
          (row.body || '').toLowerCase().includes(keyword) ||
          (row.Sender?.name || '').toLowerCase().includes(keyword)
        );
      })
      .sort((a, b) => {
        const left = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const right = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return right - left;
      });
  }, [messageCategoryFilter, messageQuery, userMessages]);

  const unreadMessageItems = useMemo(
    () => messageItems.filter((item) => !item.isRead),
    [messageItems],
  );

  const readMessageItems = useMemo(
    () => messageItems.filter((item) => item.isRead),
    [messageItems],
  );

  const unreadMessageCount = useMemo(
    () => userMessages.filter((item) => !item.isRead).length,
    [userMessages],
  );

  const pendingCourseIdSet = useMemo(
    () => new Set(pendingShares.map((item) => item.courseId)),
    [pendingShares],
  );

  const renderMessageActions = (item: UserMessageRow) => {
    const payload = (item.actionPayload || {}) as {
      courseId?: string;
      lectureId?: string;
    };
    const canRespondCourseShare =
      item.actionType === 'course_share_pending' &&
      !!payload.courseId &&
      pendingCourseIdSet.has(payload.courseId);

    return (
      <Space wrap>
        {canRespondCourseShare ? (
          <>
            <Tooltip title="수락">
              <Button
                size="small"
                type="text"
                icon={<CheckCircleOutlined />}
                aria-label="코스 공유 수락"
                loading={actionLoadingKey === `respond:${payload.courseId}:accept`}
                onClick={() => handleRespondCourse(payload.courseId as string, true)}
              />
            </Tooltip>
            <Tooltip title="거절">
              <Button
                size="small"
                type="text"
                danger
                icon={<CloseCircleOutlined />}
                aria-label="코스 공유 거절"
                loading={actionLoadingKey === `respond:${payload.courseId}:reject`}
                onClick={() => handleRespondCourse(payload.courseId as string, false)}
              />
            </Tooltip>
          </>
        ) : null}
        {item.actionType === 'lecture_grant_upsert' && payload.lectureId ? (
          <Popconfirm
            title="강의 공유 해제"
            description="내 계정에서 해당 강의 공유를 해제합니다."
            onConfirm={() => handleLeaveLecture(payload.lectureId as string)}
            okText="해제"
            cancelText="취소"
          >
            <Tooltip title="강의 공유 해제">
              <Button
                size="small"
                type="text"
                danger
                icon={<StopOutlined />}
                aria-label="강의 공유 해제"
                loading={actionLoadingKey === `leave-lecture:${payload.lectureId}`}
              />
            </Tooltip>
          </Popconfirm>
        ) : null}
        {!item.isRead ? (
          <Tooltip title="읽음 처리">
            <Button
              size="small"
              type="text"
              icon={<CheckOutlined />}
              aria-label="읽음 처리"
              onClick={() => handleMarkMessageRead(item.id)}
              loading={actionLoadingKey === `mark:${item.id}:read`}
            />
          </Tooltip>
        ) : (
          <Tag>읽음 완료</Tag>
        )}
        <Popconfirm
          title="메시지 삭제"
          description="이 메시지를 목록에서 삭제합니다."
          onConfirm={() => handleDeleteMessage(item.id)}
          okText="삭제"
          cancelText="취소"
        >
          <Tooltip title="메시지 삭제">
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              aria-label="메시지 삭제"
              loading={actionLoadingKey === `delete-message:${item.id}`}
            />
          </Tooltip>
        </Popconfirm>
      </Space>
    );
  };

  const renderMessageList = (items: UserMessageRow[], emptyText: string) => {
    if (items.length === 0) {
      return <Empty description={emptyText} />;
    }
    return (
      <Space orientation="vertical" style={{ width: '100%' }} size={10}>
        {items.map((item) => (
          <Card key={item.id} size="small">
            <Space
              style={{
                width: '100%',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
              wrap
            >
              <div>
                <Space size={6} style={{ marginBottom: 6 }} wrap>
                  <Tag color={messageCategoryColor[item.category]}>
                    {messageCategoryLabel[item.category]}
                  </Tag>
                  <Tag color={item.isRead ? 'default' : 'gold'}>
                    {item.isRead ? '읽음' : '신규'}
                  </Tag>
                </Space>
                <div style={{ fontWeight: 600 }}>{item.title}</div>
                {item.body ? <div style={{ color: '#666' }}>{item.body}</div> : null}
                <div style={{ color: '#999', fontSize: 12 }}>
                  {item.Sender?.name ? `보낸 사람: ${item.Sender.name} · ` : ''}
                  {formatDateTime(item.createdAt)}
                </div>
              </div>
              {renderMessageActions(item)}
            </Space>
          </Card>
        ))}
      </Space>
    );
  };

  const courseColumns = useMemo<ColumnsType<CourseShareRow>>(
    () => [
      {
        title: '과정명',
        dataIndex: ['Course', 'title'],
        key: 'courseTitle',
        render: (_, record) => record.Course?.title || record.courseId,
      },
      {
        title: '공유자',
        key: 'sharedBy',
        render: (_, record) => record.SharedBy?.name || record.SharedBy?.email || '-',
      },
      {
        title: '상태',
        dataIndex: 'status',
        key: 'status',
        width: 100,
        render: (status: CourseShareStatus) => (
          <Tag color={statusTagColor[status]}>{statusLabel[status]}</Tag>
        ),
      },
      {
        title: '요청일',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 180,
        render: (value?: string) => formatDateTime(value),
      },
      {
        title: '작업',
        key: 'actions',
        width: 220,
        render: (_, record) => {
          if (record.status === 'pending') {
            return (
              <Space>
                <Button
                  size="small"
                  type="text"
                  icon={<CheckCircleOutlined />}
                  aria-label="코스 공유 수락"
                  loading={actionLoadingKey === `respond:${record.courseId}:accept`}
                  onClick={() => handleRespondCourse(record.courseId, true)}
                />
                <Button
                  size="small"
                  type="text"
                  danger
                  icon={<CloseCircleOutlined />}
                  aria-label="코스 공유 거절"
                  loading={actionLoadingKey === `respond:${record.courseId}:reject`}
                  onClick={() => handleRespondCourse(record.courseId, false)}
                />
              </Space>
            );
          }
          return (
            <Popconfirm
              title="코스 공유 해제"
              description="내 계정에서 해당 코스 공유를 해제합니다."
              onConfirm={() => handleLeaveCourse(record.courseId)}
              okText="해제"
              cancelText="취소"
            >
              <Button
                size="small"
                type="text"
                danger
                icon={<StopOutlined />}
                aria-label="코스 공유 해제"
                loading={actionLoadingKey === `leave-course:${record.courseId}`}
              />
            </Popconfirm>
          );
        },
      },
    ],
    [actionLoadingKey],
  );

  const lectureColumns = useMemo<ColumnsType<LectureGrantRow>>(
    () => [
      {
        title: '강의명',
        key: 'lectureTitle',
        render: (_, record) => record.Lecture?.title || record.lectureId,
      },
      {
        title: '연결 과정',
        key: 'courses',
        render: (_, record) => {
          if (!record.courses || record.courses.length === 0) return '-';
          return (
            <Space wrap>
              {record.courses.map((course) => (
                <Tag key={course.id}>{course.title}</Tag>
              ))}
            </Space>
          );
        },
      },
      {
        title: '권한',
        key: 'permissions',
        render: (_, record) => (
          <Space wrap>
            {record.canMap ? <Tag color="blue">매핑</Tag> : null}
            {record.canEdit ? <Tag color="green">수정</Tag> : null}
            {record.canReshare ? <Tag color="purple">재공유</Tag> : null}
          </Space>
        ),
      },
      {
        title: '부여일',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 180,
        render: (value?: string) => formatDateTime(value),
      },
      {
        title: '작업',
        key: 'actions',
        width: 140,
        render: (_, record) => (
          <Popconfirm
            title="강의 공유 해제"
            description="내 계정에서 해당 강의 공유를 해제합니다."
            onConfirm={() => handleLeaveLecture(record.lectureId)}
            okText="해제"
            cancelText="취소"
          >
            <Button
              size="small"
              type="text"
              danger
              icon={<StopOutlined />}
              aria-label="강의 공유 해제"
              loading={actionLoadingKey === `leave-lecture:${record.lectureId}`}
            />
          </Popconfirm>
        ),
      },
    ],
    [actionLoadingKey],
  );

  if (!accessToken) {
    return <Alert type="warning" title="로그인 후 이용할 수 있습니다." showIcon />;
  }

  return (
    <Space orientation="vertical" style={{ width: '100%' }} size={16}>
      <Typography.Title level={3} style={{ margin: 0 }}>
        메시지함
      </Typography.Title>

      <Alert
        type="info"
        showIcon
        title="MCP 메시지함 + 공유 이력을 한 곳에서 확인합니다."
        description="메시지함은 message.* MCP 툴 기반이며, 코스/강의 공유 액션과 강사 승인 알림이 자동 적재됩니다."
      />

      <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
        <Button type="primary" onClick={() => setSendModalOpen(true)}>
          메시지 보내기
        </Button>
      </Space>

      <Card>
        <Tabs
          type="card"
          size="small"
          activeKey={activeTabKey}
          onChange={(key) => setActiveTabKey(key)}
          items={[
            {
              key: 'messages-new',
              label: `신규 메시지 (${unreadMessageCount})`,
              children: (
                <Space orientation="vertical" style={{ width: '100%' }} size={12}>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
                    <Space wrap>
                      <Input.Search
                        allowClear
                        placeholder="제목/본문/보낸 사람 검색"
                        value={messageQuery}
                        onChange={(event) => setMessageQuery(event.target.value)}
                        style={{ width: 320 }}
                      />
                      <Select
                        value={messageCategoryFilter}
                        onChange={(value) => setMessageCategoryFilter(value)}
                        style={{ width: 170 }}
                        options={[
                          { value: 'all', label: '전체 분류' },
                          { value: 'course_share', label: '코스 공유' },
                          { value: 'lecture_grant', label: '강의 공유' },
                          { value: 'instructor_approval', label: '강사 승인' },
                          { value: 'system', label: '시스템' },
                        ]}
                      />
                    </Space>
                    <Space wrap>
                      <Button
                        disabled={unreadMessageItems.length === 0}
                        loading={actionLoadingKey === 'mark-all-read'}
                        onClick={handleMarkAllMessagesRead}
                      >
                        전체 읽음
                      </Button>
                      <Button
                        type="primary"
                        loading={actionLoadingKey === 'seed-dummy-message'}
                        onClick={handleSeedDummyMessages}
                      >
                        더미 6개 생성
                      </Button>
                    </Space>
                  </Space>
                  {renderMessageList(unreadMessageItems, '신규 메시지가 없습니다.')}
                </Space>
              ),
            },
            {
              key: 'messages-read',
              label: `읽은 메시지 (${readMessageItems.length})`,
              children: (
                <Space orientation="vertical" style={{ width: '100%' }} size={12}>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
                    <Space wrap>
                      <Input.Search
                        allowClear
                        placeholder="제목/본문/보낸 사람 검색"
                        value={messageQuery}
                        onChange={(event) => setMessageQuery(event.target.value)}
                        style={{ width: 320 }}
                      />
                      <Select
                        value={messageCategoryFilter}
                        onChange={(value) => setMessageCategoryFilter(value)}
                        style={{ width: 170 }}
                        options={[
                          { value: 'all', label: '전체 분류' },
                          { value: 'course_share', label: '코스 공유' },
                          { value: 'lecture_grant', label: '강의 공유' },
                          { value: 'instructor_approval', label: '강사 승인' },
                          { value: 'system', label: '시스템' },
                        ]}
                      />
                    </Space>
                    <Space wrap>
                      <Button
                        type="primary"
                        loading={actionLoadingKey === 'seed-dummy-message'}
                        onClick={handleSeedDummyMessages}
                      >
                        더미 6개 생성
                      </Button>
                    </Space>
                  </Space>
                  {renderMessageList(readMessageItems, '읽은 메시지가 없습니다.')}
                </Space>
              ),
            },
            {
              key: 'course-pending',
              label: `대기 요청 (${pendingShares.length})`,
              children: (
                <Table
                  rowKey="id"
                  columns={courseColumns}
                  dataSource={pendingShares}
                  loading={loading}
                  pagination={false}
                />
              ),
            },
            {
              key: 'course-accepted',
              label: `수락된 코스 (${acceptedShares.length})`,
              children: (
                <Table
                  rowKey="id"
                  columns={courseColumns}
                  dataSource={acceptedShares}
                  loading={loading}
                  pagination={false}
                />
              ),
            },
            {
              key: 'course-rejected',
              label: `거절된 코스 (${rejectedShares.length})`,
              children: (
                <Table
                  rowKey="id"
                  columns={courseColumns}
                  dataSource={rejectedShares}
                  loading={loading}
                  pagination={false}
                />
              ),
            },
            {
              key: 'lecture',
              label: `강의 공유 (${lectureGrants.length})`,
              children: (
                <Table
                  rowKey="id"
                  columns={lectureColumns}
                  dataSource={lectureGrants}
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                />
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={sendModalOpen}
        title="메시지 보내기"
        onCancel={() => {
          if (sendLoading) return;
          setSendModalOpen(false);
        }}
        onOk={handleSendMessage}
        okText="전송"
        cancelText="취소"
        confirmLoading={sendLoading}
      >
        <Space orientation="vertical" style={{ width: '100%' }} size={10}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
            <Checkbox
              checked={sendToAllRecipients}
              onChange={(event) => {
                const checked = event.target.checked;
                setSendToAllRecipients(checked);
                if (checked) {
                  setSendRecipientIds(messageRecipients.map((item) => item.id));
                }
              }}
            >
              전체에게 보내기 ({messageRecipients.length}명)
            </Checkbox>
            {!sendToAllRecipients && (
              <Checkbox
                checked={
                  messageRecipients.length > 0 &&
                  sendRecipientIds.length === messageRecipients.length
                }
                indeterminate={
                  sendRecipientIds.length > 0 &&
                  sendRecipientIds.length < messageRecipients.length
                }
                onChange={(event) =>
                  setSendRecipientIds(
                    event.target.checked
                      ? messageRecipients.map((item) => item.id)
                      : [],
                  )
                }
              >
                모두 선택
              </Checkbox>
            )}
          </Space>
          <div
            style={{
              border: '1px solid #f0f0f0',
              borderRadius: 6,
              padding: 10,
              maxHeight: 220,
              overflowY: 'auto',
              background: sendToAllRecipients ? '#fafafa' : '#fff',
            }}
          >
            <Checkbox.Group
              style={{ width: '100%' }}
              value={sendRecipientIds}
              onChange={(values) => {
                const next = values as string[];
                setSendRecipientIds(next);
                if (sendToAllRecipients && next.length !== messageRecipients.length) {
                  setSendToAllRecipients(false);
                }
              }}
              disabled={sendToAllRecipients}
            >
              <Space orientation="vertical" style={{ width: '100%' }}>
                {messageRecipients.map((item) => (
                  <Checkbox key={item.id} value={item.id}>
                    {item.name} ({item.email})
                  </Checkbox>
                ))}
              </Space>
            </Checkbox.Group>
          </div>
          <Input
            placeholder="제목"
            value={sendTitle}
            onChange={(event) => setSendTitle(event.target.value)}
            maxLength={200}
          />
          <Input.TextArea
            placeholder="본문 (선택)"
            rows={4}
            value={sendBody}
            onChange={(event) => setSendBody(event.target.value)}
            maxLength={4000}
          />
        </Space>
      </Modal>
    </Space>
  );
}
