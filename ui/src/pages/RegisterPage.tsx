import { LockOutlined, MailOutlined, UserOutlined } from "@ant-design/icons";
import { Button, Card, Checkbox, Divider, Form, Input, message, Typography } from "antd";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import PlannedFeaturePanel from "../components/PlannedFeaturePanel";
import { parseMcpError } from "../utils/error";
import AuthCardLayout from "../components/AuthCardLayout";

const { Text } = Typography;

interface RegisterForm {
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
  isInstructorRequested?: boolean;
  displayName?: string;
  title?: string;
  bio?: string;
  phone?: string;
  website?: string;
}

// Password validation: 8+ chars, letters and numbers
const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;

export default function RegisterPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const parseError = (errorMessage: string): string => parseMcpError(errorMessage);

  const onFinish = async (values: RegisterForm) => {
    if (values.password !== values.confirmPassword) {
      message.error("비밀번호가 일치하지 않습니다.");
      return;
    }

    if (!passwordRegex.test(values.password)) {
      message.error("비밀번호는 8자 이상, 영문과 숫자를 포함해야 합니다.");
      return;
    }

    setLoading(true);
    try {
      await register(
        values.email,
        values.password,
        values.name,
        values.isInstructorRequested,
        values.isInstructorRequested
          ? {
              displayName: values.displayName,
              title: values.title,
              bio: values.bio,
              phone: values.phone,
              website: values.website,
            }
          : undefined,
      );
      message.success("회원가입이 완료되었습니다!");
      navigate("/courses");
    } catch (error) {
      const err = error as Error;
      message.error(parseError(err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCardLayout title="회원가입" subtitle="Edux 계정을 생성하세요">

        <Form
          form={form}
          name="register"
          onFinish={onFinish}
          layout="vertical"
          requiredMark={false}
        >
          <Form.Item
            name="name"
            rules={[{ required: true, message: "이름을 입력하세요" }]}
          >
            <Input prefix={<UserOutlined />} placeholder="이름" size="large" />
          </Form.Item>

          <Form.Item
            name="email"
            rules={[
              { required: true, message: "이메일을 입력하세요" },
              { type: "email", message: "올바른 이메일 형식을 입력하세요" },
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
              { required: true, message: "비밀번호를 입력하세요" },
              { min: 8, message: "비밀번호는 8자 이상이어야 합니다" },
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
            dependencies={["password"]}
            rules={[
              { required: true, message: "비밀번호를 다시 입력하세요" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("password") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(
                    new Error("비밀번호가 일치하지 않습니다"),
                  );
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

          <Form.Item name="isInstructorRequested" valuePropName="checked">
            <Checkbox>강사로 등록 신청</Checkbox>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.isInstructorRequested !==
              currentValues.isInstructorRequested
            }
          >
            {({ getFieldValue }) =>
              getFieldValue("isInstructorRequested") ? (
                <Card
                  size="small"
                  style={{ marginBottom: 16, backgroundColor: "#fafafa" }}
                >
                  <Text strong style={{ display: "block", marginBottom: 12 }}>
                    강사 프로파일 정보
                  </Text>

                  <Form.Item
                    name="displayName"
                    label="표시 이름"
                    rules={[{ message: "표시 이름을 입력하세요" }]}
                  >
                    <Input placeholder="강사로 표시될 이름" />
                  </Form.Item>

                  <Form.Item
                    name="title"
                    label="직함"
                    rules={[{ message: "직함을 입력하세요" }]}
                  >
                    <Input placeholder="예: 교수, 강사, 전문가 등" />
                  </Form.Item>

                  <Form.Item
                    name="bio"
                    label="자기소개"
                    rules={[{ message: "자기소개를 입력하세요" }]}
                  >
                    <Input.TextArea
                      placeholder="자신의 경력, 전문성 등을 소개해주세요"
                      rows={3}
                    />
                  </Form.Item>

                  <Form.Item
                    name="phone"
                    label="연락처"
                    rules={[{ message: "연락처를 입력하세요" }]}
                  >
                    <Input placeholder="예: 010-1234-5678" />
                  </Form.Item>

                  <Form.Item
                    name="website"
                    label="웹사이트"
                    rules={[{ message: "웹사이트 주소를 입력하세요" }]}
                  >
                    <Input placeholder="https://example.com" />
                  </Form.Item>
                </Card>
              ) : null
            }
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

          <Divider style={{ margin: "8px 0 16px" }} />

          <Form.Item style={{ marginBottom: 8 }}>
            <PlannedFeaturePanel
              title="소셜 회원가입/로그인"
              description="현재는 이메일 기반 회원가입만 지원합니다."
            />
          </Form.Item>

          <Form.Item>
            <Button block size="large" disabled>
              Google로 시작하기
            </Button>
          </Form.Item>

          <Form.Item>
            <Button block size="large" disabled>
              NAVER로 시작하기
            </Button>
          </Form.Item>

          <div style={{ textAlign: "center" }}>
            <Text type="secondary">이미 계정이 있으신가요? </Text>
            <Link to="/login">로그인</Link>
          </div>
        </Form>
    </AuthCardLayout>
  );
}
