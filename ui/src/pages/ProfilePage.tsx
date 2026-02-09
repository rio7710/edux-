import { useState } from 'react';
import { Card, Form, Input, Button, message, Divider, Modal, Typography, Descriptions, Tag } from 'antd';
import { UserOutlined, LockOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/mcpClient';

const { Title, Text } = Typography;

export default function ProfilePage() {
  const { user, accessToken, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [nameForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [deleteForm] = Form.useForm();
  const [nameLoading, setNameLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  if (!user || !accessToken) {
    return (
      <Card>
        <Text>로그인이 필요합니다.</Text>
        <Button type="link" onClick={() => navigate('/login')}>
          로그인하기
        </Button>
      </Card>
    );
  }

  const parseError = (errorMessage: string): string => {
    if (errorMessage.includes('MCP error')) {
      const match = errorMessage.match(/MCP error -?\d+: (.+)/);
      if (match) return match[1];
    }
    return errorMessage;
  };

  const handleNameUpdate = async (values: { name: string }) => {
    setNameLoading(true);
    try {
      const result = await api.userUpdate({ token: accessToken, name: values.name }) as { name: string };
      updateUser({ ...user, name: result.name });
      message.success('이름이 변경되었습니다.');
    } catch (error) {
      message.error(parseError((error as Error).message));
    } finally {
      setNameLoading(false);
    }
  };

  const handlePasswordUpdate = async (values: { currentPassword: string; newPassword: string; confirmPassword: string }) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error('새 비밀번호가 일치하지 않습니다.');
      return;
    }

    setPasswordLoading(true);
    try {
      await api.userUpdate({
        token: accessToken,
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      message.success('비밀번호가 변경되었습니다.');
      passwordForm.resetFields();
    } catch (error) {
      message.error(parseError((error as Error).message));
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleDelete = async (values: { password: string }) => {
    setDeleteLoading(true);
    try {
      await api.userDelete({ token: accessToken, password: values.password });
      message.success('계정이 비활성화되었습니다.');
      logout();
      navigate('/login');
    } catch (error) {
      message.error(parseError((error as Error).message));
    } finally {
      setDeleteLoading(false);
      setDeleteModalOpen(false);
    }
  };

  const roleLabel = {
    admin: { color: 'red', text: '관리자' },
    editor: { color: 'blue', text: '편집자' },
    viewer: { color: 'default', text: '조회자' },
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Title level={3}>내 정보</Title>

      {/* User Info Card */}
      <Card style={{ marginBottom: 24 }}>
        <Descriptions column={1} labelStyle={{ width: 120 }}>
          <Descriptions.Item label="이메일">{user.email}</Descriptions.Item>
          <Descriptions.Item label="이름">{user.name}</Descriptions.Item>
          <Descriptions.Item label="역할">
            <Tag color={roleLabel[user.role].color}>{roleLabel[user.role].text}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="가입일">
            {new Date(user.createdAt).toLocaleDateString('ko-KR')}
          </Descriptions.Item>
          {user.lastLoginAt && (
            <Descriptions.Item label="마지막 로그인">
              {new Date(user.lastLoginAt).toLocaleString('ko-KR')}
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {/* Name Change */}
      <Card title="이름 변경" style={{ marginBottom: 24 }}>
        <Form
          form={nameForm}
          onFinish={handleNameUpdate}
          layout="inline"
          initialValues={{ name: user.name }}
        >
          <Form.Item
            name="name"
            rules={[{ required: true, message: '이름을 입력하세요' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="새 이름" style={{ width: 200 }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={nameLoading}>
              변경
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* Password Change */}
      <Card title="비밀번호 변경" style={{ marginBottom: 24 }}>
        <Form
          form={passwordForm}
          onFinish={handlePasswordUpdate}
          layout="vertical"
          style={{ maxWidth: 400 }}
        >
          <Form.Item
            name="currentPassword"
            label="현재 비밀번호"
            rules={[{ required: true, message: '현재 비밀번호를 입력하세요' }]}
          >
            <Input.Password prefix={<LockOutlined />} />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="새 비밀번호"
            rules={[
              { required: true, message: '새 비밀번호를 입력하세요' },
              { min: 8, message: '8자 이상 입력하세요' },
            ]}
            extra="8자 이상, 영문과 숫자를 포함해야 합니다"
          >
            <Input.Password prefix={<LockOutlined />} />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="새 비밀번호 확인"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '새 비밀번호를 다시 입력하세요' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('비밀번호가 일치하지 않습니다'));
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined />} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={passwordLoading}>
              비밀번호 변경
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* Account Delete */}
      <Card title="계정 삭제" style={{ marginBottom: 24 }}>
        <Text type="secondary">
          계정을 삭제하면 더 이상 로그인할 수 없습니다. 이 작업은 취소할 수 없습니다.
        </Text>
        <Divider />
        <Button danger onClick={() => setDeleteModalOpen(true)}>
          계정 삭제
        </Button>
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal
        title={
          <span>
            <ExclamationCircleOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />
            계정 삭제 확인
          </span>
        }
        open={deleteModalOpen}
        onCancel={() => setDeleteModalOpen(false)}
        footer={null}
      >
        <Text>계정을 삭제하려면 비밀번호를 입력하세요.</Text>
        <Form
          form={deleteForm}
          onFinish={handleDelete}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="password"
            rules={[{ required: true, message: '비밀번호를 입력하세요' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="비밀번호" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button onClick={() => setDeleteModalOpen(false)} style={{ marginRight: 8 }}>
              취소
            </Button>
            <Button type="primary" danger htmlType="submit" loading={deleteLoading}>
              삭제
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
