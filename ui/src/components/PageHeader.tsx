import type { ReactNode } from 'react';
import { Button, Space, Tooltip } from 'antd';
import { SettingOutlined } from '@ant-design/icons';

type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  showOutlineShortcut?: boolean;
  onClickOutlineShortcut?: () => void;
};

export default function PageHeader({
  title,
  description,
  actions,
  showOutlineShortcut = false,
  onClickOutlineShortcut,
}: PageHeaderProps) {
  return (
    <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <Space size={8} align="center">
          <h2 style={{ margin: 0 }}>{title}</h2>
          {showOutlineShortcut && onClickOutlineShortcut && (
            <Tooltip title="목차 설정으로 이동">
              <Button
                type="text"
                size="small"
                icon={<SettingOutlined />}
                onClick={onClickOutlineShortcut}
                style={{ padding: 4 }}
              />
            </Tooltip>
          )}
        </Space>
        {description ? <div style={{ color: '#666', marginTop: 4 }}>{description}</div> : null}
      </div>
      {actions ? <Space>{actions}</Space> : null}
    </div>
  );
}
