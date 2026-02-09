import { useState } from 'react';
import { Form, Input, Button, Card, message, Typography } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text } = Typography;

interface RegisterForm {
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
}

// Password validation: 8+ chars, letters and numbers
const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;

export default function RegisterPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const parseError = (errorMessage: string): string => {
    // Handle MCP wrapped errors
    if (errorMessage.includes('MCP error')) {
      const match = errorMessage.match(/MCP error -?\d+: (.+)/);
      if (match) return match[1];
    }
    return errorMessage;
  };

  const onFinish = async (values: RegisterForm) => {
    if (values.password !== values.confirmPassword) {
      message.error('비밀번호가 일치하지 않습니다.');
      return;
    }

    if (!passwordRegex.test(values.password)) {
      message.error('비밀번호는 8자 이상, 영문과 숫자를 포함해야 합니다.');
      return;
    }

    setLoading(true);
    try {
      await register(values.email, values.password, values.name);
      message.success('회원가입이 완료되었습니다!');
      navigate('/courses');
    } catch (error) {
      const err = error as Error;
      message.error(parseError(err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f0f2f5',
      }}
    >
      <Card style={{ width: 400, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={3} style={{ margin: 0 }}>
            회원가입
          </Title>
          <Text type="secondary">Edux 계정을 생성하세요</Text>
        </div>

        <Form
          form={form}
          name="register"
          onFinish={onFinish}
          layout="vertical"
          requiredMark={false}
        >
          <Form.Item
            name="name"
            rules={[{ required: true, message: '이름을 입력하세요' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="이름"
              size="large"
            />
          </Form.Item>

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
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: '비밀번호를 입력하세요' },
              { min: 8, message: '비밀번호는 8자 이상이어야 합니다' },
            ]}
            extra="8자 이상, 영문과 숫자를 포함해야 합니다"
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="비밀번호"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            dependencies={['password']}
            rules={[
              { required: true, message: '비밀번호를 다시 입력하세요' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('비밀번호가 일치하지 않습니다'));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="비밀번호 확인"
              size="large"
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
              회원가입
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center' }}>
            <Text type="secondary">이미 계정이 있으신가요? </Text>
            <Link to="/login">로그인</Link>
          </div>
        </Form>
      </Card>
    </div>
  );
}
