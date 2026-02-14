import { Avatar, Form, Input, Upload } from "antd";
import { UserOutlined } from "@ant-design/icons";
import type { RcFile } from "antd/es/upload";

type AvatarUploadFieldProps = {
  form: ReturnType<typeof Form.useForm>[0];
  fieldName?: string;
  onUpload: (file: RcFile) => Promise<void>;
  uploading?: boolean;
  serverUrl?: string;
  size?: number;
};

export default function AvatarUploadField({
  form,
  fieldName = "avatarUrl",
  onUpload,
  uploading = false,
  serverUrl = "",
  size = 100,
}: AvatarUploadFieldProps) {
  const value = form.getFieldValue(fieldName) as string | undefined;
  const src = value ? `${serverUrl}${value}` : undefined;

  return (
    <div style={{ textAlign: "center" }}>
      <Upload
        showUploadList={false}
        accept="image/*"
        customRequest={({ file, onSuccess }) => {
          void onUpload(file as RcFile).finally(() => onSuccess?.("ok"));
        }}
      >
        <div style={{ cursor: "pointer" }}>
          <Avatar size={size} src={src} icon={<UserOutlined />} />
          <div style={{ marginTop: 8, color: "#1890ff", fontSize: 12 }}>
            {uploading ? "업로드 중..." : "사진 업로드"}
          </div>
        </div>
      </Upload>
      <Form.Item name={fieldName} hidden>
        <Input />
      </Form.Item>
    </div>
  );
}
