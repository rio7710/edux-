import { useState } from 'react';
import {
  Button,
  Form,
  Input,
  Select,
  message,
  Card,
  Space,
  Alert,
  Result,
} from 'antd';
import { FilePdfOutlined, DownloadOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api/mcpClient';
import { useAuth } from '../contexts/AuthContext';

interface RenderResult {
  jobId: string;
  status: string;
}

export default function RenderPage() {
  const [form] = Form.useForm();
  const [renderResult, setRenderResult] = useState<RenderResult | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const { accessToken } = useAuth();

  const renderCourseMutation = useMutation({
    mutationFn: ({ templateId, courseId, label }: { templateId: string; courseId: string; label?: string }) =>
      api.renderCoursePdf({ token: accessToken || '', templateId, courseId, label }),
    onSuccess: (result: unknown) => {
      const data = result as RenderResult;
      setRenderResult(data);
      message.success('PDF 생성 작업이 등록되었습니다');
    },
    onError: (error: Error) => {
      message.error(`PDF 생성 실패: ${error.message}`);
    },
  });

  const renderScheduleMutation = useMutation({
    mutationFn: ({ templateId, scheduleId, label }: { templateId: string; scheduleId: string; label?: string }) =>
      api.renderSchedulePdf({ token: accessToken || '', templateId, scheduleId, label }),
    onSuccess: (result: unknown) => {
      const data = result as RenderResult;
      setRenderResult(data);
      message.success('PDF 생성 작업이 등록되었습니다');
    },
    onError: (error: Error) => {
      message.error(`PDF 생성 실패: ${error.message}`);
    },
  });

  const renderProfileMutation = useMutation({
    mutationFn: ({ templateId, profileId, label }: { templateId: string; profileId: string; label?: string }) =>
      api.renderInstructorProfilePdf({ token: accessToken || '', templateId, profileId, label }),
    onSuccess: (result: unknown) => {
      const data = result as RenderResult;
      setRenderResult(data);
      message.success('PDF 생성 작업이 등록되었습니다');
    },
    onError: (error: Error) => {
      message.error(`PDF 생성 실패: ${error.message}`);
    },
  });

  const handleSubmit = async (values: {
    type: 'course' | 'schedule' | 'instructor_profile';
    templateId: string;
    targetId: string;
    label?: string;
  }) => {
    if (!accessToken) {
      message.warning('로그인 후 이용해주세요.');
      return;
    }
    setRenderResult(null);
    setPdfUrl(null);

    if (values.type === 'course') {
      renderCourseMutation.mutate({
        templateId: values.templateId,
        courseId: values.targetId,
        label: values.label,
      });
    } else if (values.type === 'schedule') {
      renderScheduleMutation.mutate({
        templateId: values.templateId,
        scheduleId: values.targetId,
        label: values.label,
      });
    } else {
      renderProfileMutation.mutate({
        templateId: values.templateId,
        profileId: values.targetId,
        label: values.label,
      });
    }
  };

  const isPending = renderCourseMutation.isPending || renderScheduleMutation.isPending || renderProfileMutation.isPending;

  return (
    <div>
      <h2>PDF 생성</h2>
      <Alert
        type="info"
        showIcon
        message="템플릿과 대상 ID를 지정해 PDF 렌더 작업을 등록합니다."
        description="렌더는 백그라운드로 처리되며, 완료된 파일은 /pdf 경로에서 확인합니다."
        style={{ marginBottom: 16 }}
      />

      <Card style={{ maxWidth: 600 }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ type: 'course' }}
        >
          <Form.Item
            name="type"
            label="렌더 타입"
            rules={[{ required: true }]}
          >
            <Select>
              <Select.Option value="course">코스</Select.Option>
              <Select.Option value="schedule">일정</Select.Option>
              <Select.Option value="instructor_profile">강사 프로필</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="templateId"
            label="템플릿 ID"
            rules={[{ required: true, message: '템플릿 ID를 입력하세요' }]}
          >
            <Input placeholder="템플릿 ID를 입력하세요" />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.type !== currentValues.type
            }
          >
            {({ getFieldValue }) => (
              <Form.Item
                name="targetId"
                label={
                  getFieldValue('type') === 'course'
                    ? '코스 ID'
                    : getFieldValue('type') === 'schedule'
                    ? '일정 ID'
                    : '강사 프로필 ID'
                }
                rules={[{ required: true, message: 'ID를 입력하세요' }]}
              >
                <Input
                  placeholder={
                    getFieldValue('type') === 'course'
                      ? '코스 ID를 입력하세요'
                      : getFieldValue('type') === 'schedule'
                      ? '일정 ID를 입력하세요'
                      : '강사 프로필 ID를 입력하세요'
                  }
                />
              </Form.Item>
            )}
          </Form.Item>

          <Form.Item name="label" label="문서 라벨 (선택)">
            <Input placeholder="예: 리더십 강사 소개서" />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              icon={<FilePdfOutlined />}
              loading={isPending}
            >
              PDF 생성
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {renderResult && (
        <Card style={{ maxWidth: 600, marginTop: 24 }}>
          <Result
            status="success"
            title="PDF 생성 작업 등록 완료"
            subTitle={
              <>
                <p>작업 ID: {renderResult.jobId}</p>
                <p>상태: {renderResult.status}</p>
              </>
            }
            extra={[
              <Alert
                key="info"
                type="info"
                message="PDF 생성은 백그라운드에서 처리됩니다"
                description={
                  <>
                    <p>워커가 작업을 처리하면 PDF가 생성됩니다.</p>
                    <p>생성된 PDF는 <code>/pdf/</code> 경로에서 확인할 수 있습니다.</p>
                  </>
                }
              />,
            ]}
          />
        </Card>
      )}

      <Card style={{ maxWidth: 600, marginTop: 24 }}>
        <h3>PDF 직접 다운로드</h3>
        <Space.Compact style={{ width: '100%' }}>
          <Input
            placeholder="PDF 파일명 (예: course-xxx.pdf)"
            value={pdfUrl || ''}
            onChange={(e) => setPdfUrl(e.target.value)}
          />
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => {
              if (pdfUrl) {
                window.open(`/pdf/${pdfUrl}`, '_blank');
              }
            }}
            disabled={!pdfUrl}
          >
            다운로드
          </Button>
        </Space.Compact>
      </Card>
    </div>
  );
}
