import {
  Button,
  Divider,
  Form,
  Input,
  Select,
  Typography,
  Upload,
  message,
} from "antd";
import { MinusCircleOutlined, PlusOutlined, UploadOutlined } from "@ant-design/icons";
import type { RcFile } from "antd/es/upload";
import CollapsibleSection from "./CollapsibleSection";

const { Text } = Typography;

type InstructorCareerSectionProps = {
  form: ReturnType<typeof Form.useForm>[0];
  mode?: "simple" | "upload";
  onUploadFile?: (file: RcFile) => Promise<string>;
  defaultOpen?: boolean;
  titlePlacement?: "left" | "start";
  compactAddButton?: boolean;
};

function DegreeFileUpload({
  name,
  form,
  onUpload,
}: {
  name: number;
  form: ReturnType<typeof Form.useForm>[0];
  onUpload: (file: RcFile) => Promise<string>;
}) {
  const fileUrl = Form.useWatch(["degrees", name, "fileUrl"], form);
  return (
    <div>
      <Form.Item name={[name, "fileUrl"]} hidden>
        <Input />
      </Form.Item>
      <Upload
        showUploadList={false}
        accept="image/*,.pdf"
        beforeUpload={async (file) => {
          try {
            const url = await onUpload(file as RcFile);
            form.setFieldValue(["degrees", name, "fileUrl"], url);
            message.success("첨부 완료");
          } catch {
            message.error("업로드 실패");
          }
          return false;
        }}
      >
        <Button size="small" icon={<UploadOutlined />} type={fileUrl ? "primary" : "default"}>
          {fileUrl ? "첨부됨" : "첨부"}
        </Button>
      </Upload>
    </div>
  );
}

function CertFileUpload({
  name,
  form,
  onUpload,
}: {
  name: number;
  form: ReturnType<typeof Form.useForm>[0];
  onUpload: (file: RcFile) => Promise<string>;
}) {
  const fileUrl = Form.useWatch(["certifications", name, "fileUrl"], form);
  return (
    <div>
      <Form.Item name={[name, "fileUrl"]} hidden>
        <Input />
      </Form.Item>
      <Upload
        showUploadList={false}
        accept="image/*,.pdf"
        beforeUpload={async (file) => {
          try {
            const url = await onUpload(file as RcFile);
            form.setFieldValue(["certifications", name, "fileUrl"], url);
            message.success("사본 첨부 완료");
          } catch {
            message.error("업로드 실패");
          }
          return false;
        }}
      >
        <Button size="small" icon={<UploadOutlined />} type={fileUrl ? "primary" : "default"}>
          {fileUrl ? "첨부됨" : "사본"}
        </Button>
      </Upload>
    </div>
  );
}

export default function InstructorCareerSection({
  form,
  mode = "simple",
  onUploadFile,
  defaultOpen = true,
  titlePlacement = "left",
  compactAddButton = false,
}: InstructorCareerSectionProps) {
  const addButtonProps = compactAddButton ? { size: "small" as const } : {};
  const isUploadMode = mode === "upload" && !!onUploadFile;

  return (
    <CollapsibleSection
      title="전문 이력"
      defaultOpen={defaultOpen}
      containerStyle={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 12, marginTop: 8 }}
      summaryStyle={{ fontWeight: 600 }}
    >
      <Text type="secondary" style={{ fontSize: 12 }}>
        학위, 주요경력, 출판/논문, 자격증 정보를 입력하세요.
      </Text>

      <Divider titlePlacement={titlePlacement} plain>
        학위
      </Divider>
      <Form.List name="degrees">
        {(fields, { add, remove }) => (
          <>
            {fields.map(({ key, name, ...restField }) => (
              <div key={key} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
                <Form.Item {...restField} name={[name, "name"]} style={{ flex: 1, marginBottom: 0 }}>
                  <Select
                    placeholder="학위"
                    options={[
                      { value: "학사", label: "학사" },
                      { value: "석사", label: "석사" },
                      { value: "박사", label: "박사" },
                      { value: "기타", label: "기타" },
                    ]}
                  />
                </Form.Item>
                <Form.Item {...restField} name={[name, "school"]} style={{ flex: 2, marginBottom: 0 }}>
                  <Input placeholder="학교" />
                </Form.Item>
                <Form.Item {...restField} name={[name, "major"]} style={{ flex: 2, marginBottom: 0 }}>
                  <Input placeholder="전공" />
                </Form.Item>
                <Form.Item {...restField} name={[name, "year"]} style={{ flex: 1, marginBottom: 0 }}>
                  <Input placeholder="연도" />
                </Form.Item>
                {isUploadMode ? (
                  <DegreeFileUpload name={name} form={form} onUpload={onUploadFile} />
                ) : null}
                <MinusCircleOutlined onClick={() => remove(name)} style={{ marginTop: 8, color: "#999" }} />
              </div>
            ))}
            <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />} {...addButtonProps}>
              학위 추가
            </Button>
          </>
        )}
      </Form.List>

      <Divider titlePlacement={titlePlacement} plain>
        주요경력
      </Divider>
      <Form.List name="careers">
        {(fields, { add, remove }) => (
          <>
            {fields.map(({ key, name, ...restField }) => (
              <div key={key} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
                <Form.Item {...restField} name={[name, "company"]} style={{ flex: 2, marginBottom: 0 }}>
                  <Input placeholder="회사/기관" />
                </Form.Item>
                <Form.Item {...restField} name={[name, "role"]} style={{ flex: 2, marginBottom: 0 }}>
                  <Input placeholder="직책/역할" />
                </Form.Item>
                <Form.Item {...restField} name={[name, "period"]} style={{ flex: 1.5, marginBottom: 0 }}>
                  <Input placeholder="기간 (예: 2018~2023)" />
                </Form.Item>
                <Form.Item {...restField} name={[name, "description"]} style={{ flex: 2, marginBottom: 0 }}>
                  <Input placeholder="설명 (선택)" />
                </Form.Item>
                <MinusCircleOutlined onClick={() => remove(name)} style={{ marginTop: 8, color: "#999" }} />
              </div>
            ))}
            <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />} {...addButtonProps}>
              경력 추가
            </Button>
          </>
        )}
      </Form.List>

      <Divider titlePlacement={titlePlacement} plain>
        출판/논문
      </Divider>
      <Form.List name="publications">
        {(fields, { add, remove }) => (
          <>
            {fields.map(({ key, name, ...restField }) => (
              <div key={key} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
                <Form.Item {...restField} name={[name, "title"]} style={{ flex: 3, marginBottom: 0 }}>
                  <Input placeholder="제목" />
                </Form.Item>
                <Form.Item {...restField} name={[name, "type"]} style={{ flex: 1, marginBottom: 0 }}>
                  <Select
                    placeholder="구분"
                    options={[
                      { value: "출판", label: "출판" },
                      { value: "논문", label: "논문" },
                    ]}
                  />
                </Form.Item>
                <Form.Item {...restField} name={[name, "year"]} style={{ flex: 1, marginBottom: 0 }}>
                  <Input placeholder="연도" />
                </Form.Item>
                <Form.Item {...restField} name={[name, "publisher"]} style={{ flex: 2, marginBottom: 0 }}>
                  <Input placeholder="출판사/학회" />
                </Form.Item>
                <MinusCircleOutlined onClick={() => remove(name)} style={{ marginTop: 8, color: "#999" }} />
              </div>
            ))}
            <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />} {...addButtonProps}>
              출판/논문 추가
            </Button>
          </>
        )}
      </Form.List>

      <Divider titlePlacement={titlePlacement} plain>
        자격증
      </Divider>
      <Form.List name="certifications">
        {(fields, { add, remove }) => (
          <>
            {fields.map(({ key, name, ...restField }) => (
              <div key={key} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
                <Form.Item {...restField} name={[name, "name"]} style={{ flex: 2, marginBottom: 0 }}>
                  <Input placeholder="자격증명" />
                </Form.Item>
                <Form.Item {...restField} name={[name, "issuer"]} style={{ flex: 2, marginBottom: 0 }}>
                  <Input placeholder="발급기관" />
                </Form.Item>
                <Form.Item {...restField} name={[name, "date"]} style={{ flex: 1.5, marginBottom: 0 }}>
                  <Input placeholder="취득일 (예: 2023-05)" />
                </Form.Item>
                {isUploadMode ? (
                  <CertFileUpload name={name} form={form} onUpload={onUploadFile} />
                ) : null}
                <MinusCircleOutlined onClick={() => remove(name)} style={{ marginTop: 8, color: "#999" }} />
              </div>
            ))}
            <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />} {...addButtonProps}>
              자격증 추가
            </Button>
          </>
        )}
      </Form.List>
    </CollapsibleSection>
  );
}
