import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Table, Space, message, Tag, Tabs, Tooltip, Popconfirm, Card, Select, Modal, Form, Input, Segmented, Checkbox } from 'antd';
import { DeleteOutlined, EyeOutlined, LinkOutlined, PlusOutlined, StopOutlined } from '@ant-design/icons';
import type { ColumnType } from 'antd/es/table';
import { api } from '../api/mcpClient';
import { useAuth } from '../contexts/AuthContext';
import { getTemplatePreference, setTemplatePreference } from '../utils/templatePreference';

type DocumentItem = {
  id: string;
  label?: string | null;
  pdfUrl?: string;
  shareToken?: string | null;
  targetType: string;
  targetId: string;
  createdAt: string;
  Template?: { id: string; name: string; type?: string | null };
  RenderJob?: { status?: string | null };
};

type BrochureMode = 'my_documents' | 'edux';

const targetLabels: Record<string, string> = {
  course: '코스',
  schedule: '일정',
  instructor_profile: '강사 프로필',
  brochure_package: '패키지 브로셔',
};

export default function MyDocumentsPage() {
  const { accessToken, user } = useAuth();
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'course' | 'instructor_profile' | 'brochure_package'>('all');
  const [courseTemplates, setCourseTemplates] = useState<Array<{ id: string; name: string }>>([]);
  const [instructorTemplates, setInstructorTemplates] = useState<Array<{ id: string; name: string }>>([]);
  const [brochureTemplates, setBrochureTemplates] = useState<Array<{ id: string; name: string }>>([]);
  const [courseTemplateId, setCourseTemplateId] = useState<string>();
  const [instructorTemplateId, setInstructorTemplateId] = useState<string>();
  const [brochureTemplateId, setBrochureTemplateId] = useState<string>();
  const [brochureModalOpen, setBrochureModalOpen] = useState(false);
  const [brochureForm] = Form.useForm();
  const [brochureCourses, setBrochureCourses] = useState<Array<{ id: string; title: string }>>([]);
  const [brochureInstructors, setBrochureInstructors] = useState<Array<{ id: string; name: string }>>([]);
  const sourceMode = Form.useWatch('sourceMode', brochureForm) as BrochureMode | undefined;
  const includeCourse = Form.useWatch('includeCourse', brochureForm) as boolean | undefined;
  const includeInstructor = Form.useWatch('includeInstructor', brochureForm) as boolean | undefined;
  const isDocumentReady = (doc: DocumentItem) => doc.RenderJob?.status === 'done' && !!doc.pdfUrl;

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

  useEffect(() => {
    if (!accessToken || !user?.id) return;
    let cancelled = false;
    const loadTemplateSettings = async () => {
      try {
        const [courseResult, instructorResult, brochureResult] = await Promise.all([
          api.templateList(1, 100, 'course_intro', accessToken) as Promise<{ items?: Array<{ id: string; name: string }> }>,
          api.templateList(1, 100, 'instructor_profile', accessToken) as Promise<{ items?: Array<{ id: string; name: string }> }>,
          api.templateList(1, 100, 'brochure_package', accessToken) as Promise<{ items?: Array<{ id: string; name: string }> }>,
        ]);
        if (cancelled) return;
        const courses = courseResult?.items || [];
        const instructors = instructorResult?.items || [];
        const brochures = brochureResult?.items || [];
        setCourseTemplates(courses);
        setInstructorTemplates(instructors);
        setBrochureTemplates(brochures);
        const pref = getTemplatePreference(user.id);
        setCourseTemplateId(pref.courseTemplateId || courses[0]?.id);
        setInstructorTemplateId(pref.instructorProfileTemplateId || instructors[0]?.id);
        setBrochureTemplateId(pref.brochureTemplateId || brochures[0]?.id);
      } catch (error) {
        if (!cancelled) {
          message.warning(`템플릿 설정 조회 실패: ${(error as Error).message}`);
        }
      }
    };
    void loadTemplateSettings();
    return () => {
      cancelled = true;
    };
  }, [accessToken, user?.id]);

  useEffect(() => {
    if (!accessToken || !brochureModalOpen) return;
    let cancelled = false;
    const loadBrochureOptions = async () => {
      try {
        const [courseResult, instructorResult] = await Promise.all([
          api.courseListMine(accessToken, 100, 0) as Promise<{ courses?: Array<{ id: string; title: string }> }>,
          api.instructorList(accessToken, 100, 0) as Promise<{ instructors?: Array<{ id: string; name: string }> }>,
        ]);
        if (cancelled) return;
        setBrochureCourses(courseResult?.courses || []);
        setBrochureInstructors(instructorResult?.instructors || []);
      } catch {
        if (!cancelled) {
          setBrochureCourses([]);
          setBrochureInstructors([]);
        }
      }
    };
    void loadBrochureOptions();
    return () => {
      cancelled = true;
    };
  }, [accessToken, brochureModalOpen]);

  useEffect(() => {
    if (!brochureModalOpen) return;
    brochureForm.setFieldValue('brochureTemplateId', brochureTemplateId);
  }, [brochureModalOpen, brochureTemplateId, brochureForm]);

  useEffect(() => {
    if (!brochureModalOpen || !sourceMode) return;
    if (sourceMode === 'my_documents') {
      brochureForm.setFieldsValue({ courseIds: [], instructorIds: [] });
      return;
    }
    brochureForm.setFieldsValue({ courseDocIds: [], instructorDocIds: [] });
  }, [brochureModalOpen, sourceMode, brochureForm]);

  const handleSaveTemplateSettings = () => {
    if (!user?.id) return;
    setTemplatePreference(user.id, {
      courseTemplateId,
      instructorProfileTemplateId: instructorTemplateId,
      brochureTemplateId,
    });
    message.success('기본 템플릿 설정이 저장되었습니다.');
  };

  const handleShare = async (doc: DocumentItem, regenerate = false) => {
    if (!accessToken) return;
    if (!isDocumentReady(doc)) {
      message.warning('PDF 생성이 완료된 문서만 공유할 수 있습니다.');
      return;
    }
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
    try {
      await api.documentDelete({ token: accessToken, id: doc.id });
      setItems((prev) => prev.filter((item) => item.id !== doc.id));
      if (doc.targetType === 'brochure_package') {
        message.success('브로셔 패키지와 연결 데이터가 정리되었습니다.');
      } else {
        message.success('삭제되었습니다.');
      }
      await load();
    } catch (error: any) {
      message.error(`삭제 실패: ${error.message}`);
    }
  };

  const handleCreateBrochure = async () => {
    try {
      const values = await brochureForm.validateFields();
      const nextIncludeCourse = values.includeCourse !== false;
      const nextIncludeInstructor = values.includeInstructor !== false;
      if (!nextIncludeCourse && !nextIncludeInstructor) {
        message.warning('강의 또는 강사 중 최소 하나는 포함해야 합니다.');
        return;
      }
      const selectedCourseCount = values.sourceMode === 'my_documents'
        ? (values.courseDocIds?.length || 0)
        : (values.courseIds?.length || 0);
      const selectedInstructorCount = values.sourceMode === 'my_documents'
        ? (values.instructorDocIds?.length || 0)
        : (values.instructorIds?.length || 0);
      if (nextIncludeCourse && selectedCourseCount === 0) {
        message.warning(values.sourceMode === 'my_documents'
          ? '내문서함 모드에서는 코스 문서를 1개 이상 선택하세요.'
          : 'Edux 모드에서는 코스를 1개 이상 선택하세요.');
        return;
      }
      if (nextIncludeInstructor && selectedInstructorCount === 0) {
        message.warning(values.sourceMode === 'my_documents'
          ? '내문서함 모드에서는 강사 문서를 1개 이상 선택하세요.'
          : 'Edux 모드에서는 강사를 1명 이상 선택하세요.');
        return;
      }
      const shouldQueuePdf =
        values.sourceMode === 'edux' && (values.outputMode === 'pdf' || values.outputMode === 'both');
      const renderBatchToken = shouldQueuePdf ? `brochure-batch:${Date.now()}` : undefined;
      const courseIdsToRender: string[] = nextIncludeCourse ? (values.courseIds || []) : [];
      const instructorIdsToRender: string[] = nextIncludeInstructor ? (values.instructorIds || []) : [];
      let skippedCourse = 0;
      let skippedInstructor = 0;
      let queued = 0;
      let failed = 0;
      let waitTimedOut = false;
      let preRenderWarning: string | null = null;

      if (shouldQueuePdf && accessToken) {
        const renderTasks: Array<Promise<unknown>> = [];
        if (courseIdsToRender.length > 0) {
          if (!courseTemplateId) {
            skippedCourse = courseIdsToRender.length;
          } else {
            renderTasks.push(
              ...courseIdsToRender.map((courseId) =>
                api.renderCoursePdf({
                  token: accessToken,
                  templateId: courseTemplateId,
                  courseId,
                  label: `${values.title} [${renderBatchToken}]`,
                }),
              ),
            );
          }
        }
        if (instructorIdsToRender.length > 0) {
          if (!instructorTemplateId) {
            skippedInstructor = instructorIdsToRender.length;
          } else {
            renderTasks.push(
              ...instructorIdsToRender.map((instructorId) =>
                api.renderInstructorProfilePdf({
                  token: accessToken,
                  templateId: instructorTemplateId,
                  profileId: instructorId,
                  label: `${values.title} [${renderBatchToken}]`,
                }),
              ),
            );
          }
        }

        if (renderTasks.length > 0 && renderBatchToken) {
          try {
            message.loading({ key: 'brochure-render-queue', content: 'PDF 생성 작업을 등록하는 중입니다...' });
            const settled = await Promise.allSettled(renderTasks);
            queued = settled.filter((result) => result.status === 'fulfilled').length;
            failed = settled.length - queued;
            message.destroy('brochure-render-queue');

            const expectedCourseDocs = Math.max(0, courseIdsToRender.length - skippedCourse);
            const expectedInstructorDocs = Math.max(0, instructorIdsToRender.length - skippedInstructor);
            const startedAt = Date.now();
            const timeoutMs = 45000;
            const intervalMs = 1500;

            while (Date.now() - startedAt < timeoutMs) {
              const current = (await api.documentList({
                token: accessToken,
                page: 1,
                pageSize: 100,
              })) as { items?: DocumentItem[] };
              const docs = current.items || [];
              const batched = docs.filter((doc) => (doc.label || '').includes(renderBatchToken));
              const doneCourses = batched.filter((doc) => doc.targetType === 'course' && doc.RenderJob?.status === 'done').length;
              const doneInstructors = batched.filter((doc) => doc.targetType === 'instructor_profile' && doc.RenderJob?.status === 'done').length;
              if (doneCourses >= expectedCourseDocs && doneInstructors >= expectedInstructorDocs) {
                break;
              }
              await new Promise((resolve) => setTimeout(resolve, intervalMs));
            }

            const finalCheck = (await api.documentList({
              token: accessToken,
              page: 1,
              pageSize: 100,
            })) as { items?: DocumentItem[] };
            const finalBatched = (finalCheck.items || []).filter((doc) => (doc.label || '').includes(renderBatchToken));
            const finalDoneCourses = finalBatched.filter((doc) => doc.targetType === 'course' && doc.RenderJob?.status === 'done').length;
            const finalDoneInstructors = finalBatched.filter((doc) => doc.targetType === 'instructor_profile' && doc.RenderJob?.status === 'done').length;
            const expectedCourseDone = Math.max(0, courseIdsToRender.length - skippedCourse);
            const expectedInstructorDone = Math.max(0, instructorIdsToRender.length - skippedInstructor);
            waitTimedOut = finalDoneCourses < expectedCourseDone || finalDoneInstructors < expectedInstructorDone;
          } catch (error) {
            message.destroy('brochure-render-queue');
            preRenderWarning = `사전 PDF 상태 확인 중 오류: ${(error as Error).message}`;
          }
        }
      }

      await api.brochureCreate({
        token: accessToken || '',
        title: values.title,
        summary: values.summary || undefined,
        brochureTemplateId: values.brochureTemplateId,
        courseTemplateId: courseTemplateId,
        instructorTemplateId: instructorTemplateId,
        includeToc: values.includeToc !== false,
        includeCourse: nextIncludeCourse,
        includeInstructor: nextIncludeInstructor,
        contentOrder:
          nextIncludeCourse && nextIncludeInstructor
            ? (values.contentOrder || 'course-first')
            : nextIncludeInstructor
              ? 'instructor-first'
              : 'course-first',
        outputMode: values.outputMode || 'both',
        sourceMode: values.sourceMode || 'edux',
        renderBatchToken,
        sourceCourseDocIds:
          values.sourceMode === 'my_documents' && nextIncludeCourse ? (values.courseDocIds || []) : undefined,
        sourceInstructorDocIds:
          values.sourceMode === 'my_documents' && nextIncludeInstructor ? (values.instructorDocIds || []) : undefined,
        sourceCourseIds: values.sourceMode === 'edux' && nextIncludeCourse ? (values.courseIds || []) : undefined,
        sourceInstructorIds:
          values.sourceMode === 'edux' && nextIncludeInstructor ? (values.instructorIds || []) : undefined,
      });

      setBrochureModalOpen(false);
      brochureForm.resetFields();
      setActiveTab('brochure_package');
      await load();

      const notices: string[] = ['브로셔 저장 완료'];
      if (queued > 0) notices.push(`PDF 작업 등록 ${queued}건`);
      if (failed > 0) notices.push(`등록 실패 ${failed}건`);
      if (skippedCourse > 0) notices.push(`코스 템플릿 미설정으로 ${skippedCourse}건 건너뜀`);
      if (skippedInstructor > 0) notices.push(`강사 템플릿 미설정으로 ${skippedInstructor}건 건너뜀`);
      if (waitTimedOut) notices.push('일부 PDF 완료 대기 시간이 초과되어 내부 링크로 남을 수 있음');
      if (preRenderWarning) notices.push(preRenderWarning);
      message.success(notices.join(' / '));
    } catch (error) {
      message.error(`브로셔 저장 실패: ${(error as Error).message}`);
    }
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
      render: (_: unknown, record) => {
        const status = record.RenderJob?.status || 'pending';
        const color = status === 'done' ? 'green' : status === 'failed' ? 'red' : 'orange';
        const label = status === 'done' ? '완료' : status === 'failed' ? '실패' : '처리중';
        return <Tag color={color}>{label}</Tag>;
      },
    },
    {
      title: '브로셔 모드',
      key: 'brochureMode',
      render: (_: unknown, record) => {
        if (record.targetType !== 'brochure_package') return '-';
        return '서버 저장';
      },
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
          {record.targetType === 'brochure_package' ? <Tag color="blue">브로셔</Tag> : null}
          <Tooltip title="PDF 보기">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => {
                if (!isDocumentReady(record)) {
                  message.warning('브로셔/문서 생성 완료 후 확인할 수 있습니다.');
                  return;
                }
                window.open(record.pdfUrl, '_blank');
              }}
            />
          </Tooltip>
          <Tooltip title="공유 링크 생성">
            <Button
              size="small"
              icon={<LinkOutlined />}
              onClick={() => handleShare(record)}
              disabled={!isDocumentReady(record)}
            />
          </Tooltip>
          <Tooltip title="공유 해제">
            <Button
              size="small"
              icon={<StopOutlined />}
              onClick={() => handleRevoke(record)}
              disabled={!record.shareToken}
            />
          </Tooltip>
          <Popconfirm
            title="문서를 삭제할까요?"
            description={
              record.targetType === 'brochure_package'
                ? '삭제하면 패키지와 연결된 문서/렌더 작업도 함께 정리되며 복구할 수 없습니다.'
                : '삭제하면 복구할 수 없습니다.'
            }
            okText="삭제"
            cancelText="취소"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDelete(record)}
          >
            <Tooltip title="삭제">
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const courseCount = useMemo(
    () => items.filter((item) => item.targetType === 'course').length,
    [items],
  );
  const instructorCount = useMemo(
    () => items.filter((item) => item.targetType === 'instructor_profile').length,
    [items],
  );
  const courseDocumentOptions = useMemo(
    () =>
      items
        .filter((item) => item.targetType === 'course')
        .map((item) => ({ value: item.id, label: item.label || item.Template?.name || item.id })),
    [items],
  );
  const instructorDocumentOptions = useMemo(
    () =>
      items
        .filter((item) => item.targetType === 'instructor_profile')
        .map((item) => ({ value: item.id, label: item.label || item.Template?.name || item.id })),
    [items],
  );
  const brochureCount = useMemo(
    () => items.filter((item) => item.targetType === 'brochure_package').length,
    [items],
  );
  const filteredItems = useMemo(() => {
    if (activeTab === 'course') {
      return items.filter((item) => item.targetType === 'course');
    }
    if (activeTab === 'instructor_profile') {
      return items.filter((item) => item.targetType === 'instructor_profile');
    }
    if (activeTab === 'brochure_package') {
      return items.filter((item) => item.targetType === 'brochure_package');
    }
    return items;
  }, [activeTab, items]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>내 문서함</h2>
        <Space>
          <Button icon={<PlusOutlined />} type="primary" onClick={() => setBrochureModalOpen(true)}>
            새 브로셔
          </Button>
          <Button onClick={load} loading={loading}>
            새로고침
          </Button>
        </Space>
      </div>
      <Card
        size="small"
        title="기본 PDF 템플릿 설정"
        style={{ marginBottom: 16 }}
      >
        <Space wrap>
          <Select
            style={{ width: 240 }}
            placeholder="코스 기본 템플릿"
            value={courseTemplateId}
            onChange={setCourseTemplateId}
            options={courseTemplates.map((tpl) => ({ value: tpl.id, label: tpl.name }))}
            allowClear
          />
          <Select
            style={{ width: 260 }}
            placeholder="강사 프로필 기본 템플릿"
            value={instructorTemplateId}
            onChange={setInstructorTemplateId}
            options={instructorTemplates.map((tpl) => ({ value: tpl.id, label: tpl.name }))}
            allowClear
          />
          <Select
            style={{ width: 240 }}
            placeholder="브로셔 기본 템플릿"
            value={brochureTemplateId}
            onChange={setBrochureTemplateId}
            options={brochureTemplates.map((tpl) => ({ value: tpl.id, label: tpl.name }))}
            allowClear
          />
          <Button type="primary" onClick={handleSaveTemplateSettings}>
            기본 설정 저장
          </Button>
        </Space>
      </Card>
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as 'all' | 'course' | 'instructor_profile' | 'brochure_package')}
        items={[
          { key: 'all', label: `전체 (${items.length})` },
          { key: 'course', label: `코스 (${courseCount})` },
          { key: 'instructor_profile', label: `강사 프로필 (${instructorCount})` },
          { key: 'brochure_package', label: `패키지 브로셔 (${brochureCount})` },
        ]}
      />
      <Table
        rowKey="id"
        columns={columns}
        dataSource={filteredItems}
        loading={loading}
        pagination={{ pageSize: 20 }}
      />
      <Modal
        title="새 브로셔"
        open={brochureModalOpen}
        width="92%"
        style={{ top: 16, maxWidth: 1280 }}
        styles={{ body: { maxHeight: '78vh', overflowY: 'auto' } }}
        onCancel={() => {
          setBrochureModalOpen(false);
          brochureForm.resetFields();
        }}
        onOk={handleCreateBrochure}
        okText="저장"
      >
        <Form form={brochureForm} layout="vertical">
          <Alert
            type="info"
            style={{ marginBottom: 12 }}
            message="브로셔 모드 선택"
            description="내문서함 모드: 내 문서 기반 / Edux 모드: 사이트 데이터 기반 (서버에 즉시 저장)"
          />
          <Form.Item
            name="sourceMode"
            label="브로셔 데이터 모드"
            initialValue="edux"
          >
            <Segmented
              block
              options={[
                { label: '내문서함 모드', value: 'my_documents' },
                { label: 'Edux 모드', value: 'edux' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="brochureTemplateId"
            label="브로셔 템플릿"
            initialValue={brochureTemplateId}
            rules={[{ required: true, message: '브로셔 템플릿을 선택하세요.' }]}
          >
            <Select
              placeholder="브로셔 템플릿을 선택하세요"
              options={brochureTemplates.map((tpl) => ({ value: tpl.id, label: tpl.name }))}
              allowClear
            />
          </Form.Item>
          <Card size="small" style={{ marginBottom: 12, borderRadius: 10, border: '1px solid #dbe4f0' }}>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Space wrap>
                <Checkbox checked disabled>표지 포함</Checkbox>
                <Form.Item name="includeToc" valuePropName="checked" initialValue style={{ marginBottom: 0 }}>
                  <Checkbox>목차 포함</Checkbox>
                </Form.Item>
                <Form.Item name="includeCourse" valuePropName="checked" initialValue style={{ marginBottom: 0 }}>
                  <Checkbox>강의 포함</Checkbox>
                </Form.Item>
                <Form.Item name="includeInstructor" valuePropName="checked" initialValue style={{ marginBottom: 0 }}>
                  <Checkbox>강사 포함</Checkbox>
                </Form.Item>
              </Space>
              {includeCourse !== false && includeInstructor !== false ? (
                <Form.Item name="contentOrder" label="순서" initialValue="course-first" style={{ marginBottom: 0 }}>
                  <Segmented
                    options={[
                      { label: '강의 → 강사', value: 'course-first' },
                      { label: '강사 → 강의', value: 'instructor-first' },
                    ]}
                  />
                </Form.Item>
              ) : null}
              <Form.Item name="outputMode" label="출력 방식" initialValue="both" style={{ marginBottom: 0 }}>
                <Segmented
                  options={[
                    { label: '웹', value: 'web' },
                    { label: 'PDF', value: 'pdf' },
                    { label: '둘다', value: 'both' },
                  ]}
                />
              </Form.Item>
            </Space>
          </Card>
          <Form.Item
            name="title"
            label="브로셔 제목"
            rules={[{ required: true, message: '브로셔 제목을 입력하세요.' }]}
          >
            <Input placeholder="예: 2026 리더십 프로그램 통합 소개서" />
          </Form.Item>
          <Form.Item name="summary" label="요약 설명">
            <Input.TextArea rows={3} placeholder="소개 문구를 입력하세요." />
          </Form.Item>
          {sourceMode === 'my_documents' ? (
            <>
              <Form.Item name="courseDocIds" label="내문서함 기반 코스 문서" initialValue={[]}>
                <Select
                  mode="multiple"
                  placeholder="내문서함의 코스 문서를 선택하세요"
                  options={courseDocumentOptions}
                  allowClear
                />
              </Form.Item>
              <Form.Item name="instructorDocIds" label="내문서함 기반 강사 문서" initialValue={[]}>
                <Select
                  mode="multiple"
                  placeholder="내문서함의 강사 문서를 선택하세요"
                  options={instructorDocumentOptions}
                  allowClear
                />
              </Form.Item>
            </>
          ) : (
            <>
              <Form.Item name="courseIds" label="Edux 코스" initialValue={[]}>
                <Select
                  mode="multiple"
                  placeholder="사이트 코스를 선택하세요"
                  options={brochureCourses.map((course) => ({ value: course.id, label: course.title }))}
                  allowClear
                />
              </Form.Item>
              <Form.Item name="instructorIds" label="Edux 강사" initialValue={[]}>
                <Select
                  mode="multiple"
                  placeholder="사이트 강사를 선택하세요"
                  options={brochureInstructors.map((instructor) => ({ value: instructor.id, label: instructor.name }))}
                  allowClear
                />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </div>
  );
}
