// ui/src/pages/TestEchoPage.tsx
import { useState } from 'react';
import { Button, Input, Space, Typography, message } from 'antd';
import { api } from '../api/mcpClient';
import { useMutation } from '@tanstack/react-query';

const { Title, Paragraph } = Typography;

export function TestEchoPage() {
  const [echoMessage, setEchoMessage] = useState('');
  const [response, setResponse] = useState('');

  const echoMutation = useMutation({
    mutationFn: (message: string) => api.testEcho(message),
    onSuccess: (data) => {
      console.log('Echo successful:', data);
      setResponse(`Backend responded: ${data}`);
      message.success('Echo successful!');
    },
    onError: (error) => {
      console.error('Echo failed:', error);
      setResponse(`Error: ${error.message}`);
      message.error(`Echo failed: ${error.message}`);
    },
  });

  const handleEcho = () => {
    echoMutation.mutate(echoMessage);
  };

  return (
    <div>
      <Title level={2}>Test Echo Tool</Title>
      <Paragraph>
        Enter a message below to send to the backend's <code>test.echo</code> tool.
        The backend will echo the message back. This helps verify basic communication.
      </Paragraph>
      <Space>
        <Input
          placeholder="Enter message to echo"
          value={echoMessage}
          onChange={(e) => setEchoMessage(e.target.value)}
          style={{ width: 300 }}
        />
        <Button
          type="primary"
          onClick={handleEcho}
          loading={echoMutation.isPending}
          disabled={!echoMessage || echoMutation.isPending}
        >
          Send Echo
        </Button>
      </Space>
      {response && (
        <Paragraph style={{ marginTop: 20, color: echoMutation.isError ? 'red' : 'green' }}>
          {response}
        </Paragraph>
      )}
    </div>
  );
}
