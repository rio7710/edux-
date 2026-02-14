import { useEffect, useRef, useState } from 'react';
import { Form, Input, Button, message, Typography } from 'antd';
import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import PlannedFeaturePanel from '../components/PlannedFeaturePanel';
import AuthCardLayout from '../components/AuthCardLayout';
import {
  clearClientErrorReports,
  downloadClientErrorReports,
  getClientErrorReports,
  withErrorReportId,
} from '../utils/errorReport';

const { Text } = Typography;

interface LoginForm {
  email: string;
  password: string;
}

export default function LoginPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { login, loginWithTokens } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const socialHandledRef = useRef(false);
  const socialLoginEnabled = false;

  const decodeBase64Url = (value: string): string => {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    return atob(padded);
  };

  const parseError = (error: unknown): string => {
    const errorMessage =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : '로그인 중 알 수 없는 오류가 발생했습니다.';

    if (
      errorMessage.includes('MCP 서버에 연결할 수 없습니다') ||
      errorMessage.includes('MCP 연결 시간이 초과되었습니다') ||
      errorMessage.includes('요청 시간이 초과되었습니다') ||
      errorMessage.includes('MCP request failed (500)') ||
      errorMessage.includes('EventSource')
    ) {
      return '서버 응답이 지연되고 있습니다. 백엔드(7777) 상태 확인 후 다시 시도하세요.';
    }

    if (errorMessage.includes('MCP error')) {
      const match = errorMessage.match(/MCP error -?\d+: (.+)/);
      if (match) return match[1];
    }
    return errorMessage;
  };

  const downloadErrorReports = () => {
    const reports = getClientErrorReports();
    if (reports.length === 0) {
      message.info('저장된 오류 로그가 없습니다.');
      return;
    }
    const filename = downloadClientErrorReports(reports);
    if (!filename) {
      message.error('오류 로그 저장에 실패했습니다.');
      return;
    }
    message.success(`오류 로그 저장 완료: ${filename}`);
  };

  const clearErrorReports = () => {
    clearClientErrorReports();
    message.success('오류 로그를 삭제했습니다.');
  };

  const onFinish = async (values: LoginForm) => {
    setLoading(true);
    try {
      await login(values.email, values.password);
      message.success('로그인되었습니다!');
      navigate('/dashboard');
    } catch (error) {
      message.error(withErrorReportId(parseError(error), error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (socialHandledRef.current) return;

    const accessToken = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');
    const encodedUser = searchParams.get('user');
    const socialError = searchParams.get('socialError');

    if (socialError) {
      socialHandledRef.current = true;
      message.error(socialError);
      navigate('/login', { replace: true });
      return;
    }

    if (!accessToken || !refreshToken || !encodedUser) return;

    try {
      const user = JSON.parse(decodeBase64Url(encodedUser));
      loginWithTokens({ user, accessToken, refreshToken });
      socialHandledRef.current = true;
      message.success('소셜 로그인되었습니다.');
      navigate('/dashboard', { replace: true });
    } catch {
      socialHandledRef.current = true;
      message.error('소셜 로그인 응답을 처리하지 못했습니다.');
      navigate('/login', { replace: true });
    }
  }, [loginWithTokens, navigate, searchParams]);

  return (
    <AuthCardLayout title="로그인" subtitle="Edux에 오신 것을 환영합니다">

        <Form
          form={form}
          name="login"
          onFinish={onFinish}
          layout="vertical"
          requiredMark={false}
        >
          <Form.Item
            name="email"
            rules={[
              { required: true, message: '이메일을 입력하세요' },
              { type: 'email', message: '올바른 이메일 형식을 입력하세요' },
            ]}
          >
            <Input
              prefix={<MailOutlined />}
              placeholder="이메일"
              size="large"
              autoComplete="email"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '비밀번호를 입력하세요' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="비밀번호"
              size="large"
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={loading}
            >
              로그인
            </Button>
          </Form.Item>

          <Form.Item style={{ marginBottom: 8 }}>
            <PlannedFeaturePanel
              title="소셜 로그인"
              description="현재는 이메일/비밀번호 로그인만 지원합니다."
            />
          </Form.Item>

          <Form.Item>
            <Button
              block
              size="large"
              disabled={!socialLoginEnabled}
              onClick={() => {
                if (!socialLoginEnabled) return;
                window.location.href = '/auth/google/start';
              }}
            >
              Google로 로그인
            </Button>
          </Form.Item>

          <Form.Item>
            <Button
              block
              size="large"
              disabled={!socialLoginEnabled}
              onClick={() => {
                if (!socialLoginEnabled) return;
                window.location.href = '/auth/naver/start';
              }}
            >
              NAVER로 로그인
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center' }}>
            <Text type="secondary">계정이 없으신가요? </Text>
            <Link to="/register">회원가입</Link>
          </div>
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <Button type="link" size="small" onClick={downloadErrorReports}>
              오류 로그 다운로드
            </Button>
            <Button type="link" size="small" danger onClick={clearErrorReports}>
              로그 삭제
            </Button>
          </div>
        </Form>
    </AuthCardLayout>
  );
}
