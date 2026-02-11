import {
    ExclamationCircleOutlined,
    LockOutlined,
    MinusCircleOutlined,
    PlusOutlined,
    UserOutlined,
} from "@ant-design/icons";
import {
    Button,
    Card,
    Descriptions,
    Divider,
    Form,
    Input,
    message,
    Modal,
    Select,
    Space,
    Tag,
    Typography,
} from "antd";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/mcpClient";
import { useAuth } from "../contexts/AuthContext";

const { Title, Text } = Typography;

interface InstructorProfileData {
  id?: string | null;
  displayName?: string | null;
  title?: string | null;
  bio?: string | null;
  phone?: string | null;
  website?: string | null;
  links?: unknown;
  isApproved?: boolean;
  isPending?: boolean;
}

interface InstructorDataFallback {
  name?: string | null;
  title?: string | null;
  bio?: string | null;
  phone?: string | null;
  links?: unknown;
}

interface Degree {
  name: string;
  school: string;
  major: string;
  year: string;
  fileUrl?: string;
}

interface Career {
  company: string;
  role: string;
  period: string;
  description?: string;
}

interface Publication {
  title: string;
  type: string;
  year?: string;
  publisher?: string;
  url?: string;
}

interface Certification {
  name: string;
  issuer?: string;
  date?: string;
  fileUrl?: string;
}

interface InstructorEntityData {
  id?: string;
  userId?: string;
  name?: string;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  affiliation?: string | null;
  bio?: string | null;
  specialties?: string[] | null;
  degrees?: Degree[] | null;
  careers?: Career[] | null;
  publications?: Publication[] | null;
  certifications?: Certification[] | null;
}

const toOptionalString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

export default function ProfilePage() {
  const { user, accessToken, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [nameForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [deleteForm] = Form.useForm();
  const [instructorForm] = Form.useForm();
  const [instructorDetailForm] = Form.useForm();
  const [exportForm] = Form.useForm();
  const [nameLoading, setNameLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [instructorLoading, setInstructorLoading] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [instructorDetailLoading, setInstructorDetailLoading] = useState(false);
  const [templates, setTemplates] = useState<Array<{ id: string; name: string }>>([]);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [instructorProfile, setInstructorProfile] = useState<InstructorProfileData | null>(null);
  const [instructorEntity, setInstructorEntity] = useState<InstructorEntityData | null>(null);

  if (!user || !accessToken) {
    return (
      <Card>
        <Text>로그인이 필요합니다.</Text>
        <Button type="link" onClick={() => navigate("/login")}>
          로그인하기
        </Button>
      </Card>
    );
  }

  const parseError = (errorMessage: string): string => {
    if (errorMessage.includes("MCP error")) {
      const match = errorMessage.match(/MCP error -?\d+: (.+)/);
      if (match) return match[1];
    }
    return errorMessage;
  };

  const normalizeInstructorPayload = (values: any) => {
    let parsedLinks: unknown = undefined;
    if (typeof values.linksText === "string") {
      const trimmed = values.linksText.trim();
      if (!trimmed) {
        parsedLinks = null;
      } else {
        try {
          const parsed = JSON.parse(trimmed);
          const valid =
            Array.isArray(parsed) &&
            parsed.every(
              (item) =>
                item &&
                typeof item === "object" &&
                typeof item.label === "string" &&
                typeof item.url === "string",
            );
          if (!valid) {
            throw new Error();
          }
          parsedLinks = parsed;
        } catch {
          throw new Error(
            "추가 링크(JSON)는 [{\"label\":\"...\",\"url\":\"...\"}] 형식이어야 합니다.",
          );
        }
      }
    }

    return {
      displayName: values.name || values.displayName,
      title: values.title,
      bio: values.bio,
      phone: values.phone,
      website: values.website,
      links: parsedLinks,
    };
  };

  const handleBasicInfoUpdate = async (values: {
    name: string;
    phone?: string;
    website?: string;
  }) => {
    setNameLoading(true);
    try {
      const result = (await api.userUpdate({
        token: accessToken,
        name: values.name,
        phone: values.phone ?? null,
        website: values.website ?? null,
      })) as { name: string; phone?: string | null; website?: string | null };
      updateUser({
        ...user,
        name: result.name,
        phone: result.phone ?? null,
        website: result.website ?? null,
      });
      if (user.role === "instructor") {
        try {
          const current = instructorEntity
            ? instructorEntity
            : ((await api.instructorGetByUser(accessToken)) as InstructorEntityData);
          if (current?.id) {
            await api.instructorUpsert({
              token: accessToken,
              id: current.id,
              name: result.name,
              title: toOptionalString(current.title),
              email: toOptionalString(current.email),
              phone: result.phone ?? undefined,
              affiliation: toOptionalString(current.affiliation),
              bio: toOptionalString(current.bio),
              specialties: current.specialties || [],
              degrees: current.degrees || [],
              careers: current.careers || [],
              publications: current.publications || [],
              certifications: current.certifications || [],
            });
            setInstructorEntity({ ...current, name: result.name });
          }
          await api.updateInstructorProfile({
            token: accessToken,
            displayName: result.name,
            phone: result.phone ?? undefined,
            website: result.website ?? undefined,
          });
          instructorDetailForm.setFieldValue("name", result.name);
          instructorDetailForm.setFieldValue("phone", result.phone ?? undefined);
        } catch {
          // Keep name change successful even if sync fails.
        }
      }
      message.success("기본 정보가 변경되었습니다.");
    } catch (error) {
      message.error(parseError((error as Error).message));
    } finally {
      setNameLoading(false);
    }
  };

  const handlePasswordUpdate = async (values: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error("새 비밀번호가 일치하지 않습니다.");
      return;
    }

    setPasswordLoading(true);
    try {
      await api.userUpdate({
        token: accessToken,
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      message.success("비밀번호가 변경되었습니다.");
      passwordForm.resetFields();
      setPasswordModalOpen(false);
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
      message.success("계정이 비활성화되었습니다.");
      logout();
      navigate("/login");
    } catch (error) {
      message.error(parseError((error as Error).message));
    } finally {
      setDeleteLoading(false);
      setDeleteModalOpen(false);
    }
  };

  const handleRequestInstructor = async (values: any) => {
    setInstructorLoading(true);
    try {
      const payload = normalizeInstructorPayload(values);
      await api.requestInstructor({ token: accessToken!, ...payload });
      message.success(
        "강사 신청이 제출되었습니다. 관리자 승인을 기다려주세요.",
      );
      const latest = (await api.getInstructorProfile(
        accessToken!,
      )) as InstructorProfileData | null;
      setInstructorProfile(latest);
      setProfileId(latest?.id || null);
    } catch (error) {
      message.error(parseError((error as Error).message));
    } finally {
      setInstructorLoading(false);
    }
  };

  const handleUpdateInstructorDetail = async (values: any) => {
    if (!accessToken) return;
    setInstructorDetailLoading(true);
    try {
      const specialties = values.specialties
        ? values.specialties
            .split(",")
            .map((s: string) => s.trim())
            .filter(Boolean)
        : [];

      await api.instructorUpsert({
        token: accessToken,
        id: instructorEntity?.id,
        name: values.name || user.name,
        title: toOptionalString(values.title),
        email: toOptionalString(values.email),
        phone: toOptionalString(values.phone),
        affiliation: toOptionalString(values.affiliation),
        bio: toOptionalString(values.bio),
        specialties,
        degrees: (values.degrees || []).filter((d: Degree) => d?.name || d?.school),
        careers: (values.careers || []).filter((c: Career) => c?.company || c?.role),
        publications: (values.publications || []).filter((p: Publication) => p?.title),
        certifications: (values.certifications || []).filter((c: Certification) => c?.name),
      });
      await api.updateInstructorProfile({
        token: accessToken,
        displayName: values.name || user.name,
        title: toOptionalString(values.title),
        bio: toOptionalString(values.bio),
        phone: toOptionalString(values.phone),
      });
      await api.userUpdate({
        token: accessToken,
        phone: toOptionalString(values.phone) ?? null,
      });
      updateUser({
        ...user,
        phone: toOptionalString(values.phone) ?? null,
      });

      const latest = (await api.instructorGetByUser(accessToken)) as InstructorEntityData;
      setInstructorEntity(latest);
      instructorDetailForm.setFieldsValue({
        id: latest?.id,
        userId: latest?.userId || user.id,
        name: latest?.name || user.name,
        title: latest?.title || undefined,
        email: latest?.email || user.email,
        phone: latest?.phone || undefined,
        affiliation: latest?.affiliation || undefined,
        bio: latest?.bio || undefined,
        specialties: latest?.specialties?.join(", ") || undefined,
        degrees: latest?.degrees || [],
        careers: latest?.careers || [],
        publications: latest?.publications || [],
        certifications: latest?.certifications || [],
      });
      message.success("강사 상세 정보가 저장되었습니다.");
    } catch (error) {
      message.error(parseError((error as Error).message));
    } finally {
      setInstructorDetailLoading(false);
    }
  };

  const roleLabel = {
    admin: { color: "red", text: "관리자" },
    operator: { color: "orange", text: "운영자" },
    editor: { color: "blue", text: "편집자" },
    instructor: { color: "green", text: "강의자" },
    viewer: { color: "default", text: "조회자" },
    guest: { color: "gray", text: "게스트" },
  };

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    const load = async () => {
      try {
        const profileResult = (await api.getInstructorProfile(
          accessToken,
        )) as InstructorProfileData | null;
        let fallbackInstructor: InstructorDataFallback | null = null;
        if (
          profileResult &&
          !profileResult.title &&
          !profileResult.bio &&
          !profileResult.phone
        ) {
          try {
            fallbackInstructor = (await api.instructorGetByUser(
              accessToken,
            )) as InstructorDataFallback;
          } catch {
            fallbackInstructor = null;
          }
        }
        let instructorEntityResult: InstructorEntityData | null = null;
        try {
          instructorEntityResult = (await api.instructorGetByUser(
            accessToken,
          )) as InstructorEntityData;
        } catch {
          instructorEntityResult = null;
        }
        if (cancelled) return;
        setInstructorProfile(profileResult);
        setProfileId(profileResult?.id || null);
        setInstructorEntity(instructorEntityResult);
        instructorForm.setFieldsValue({
          name: profileResult?.displayName || user.name,
          title: profileResult?.title || fallbackInstructor?.title || undefined,
          bio: profileResult?.bio || fallbackInstructor?.bio || undefined,
          phone: user.phone || profileResult?.phone || fallbackInstructor?.phone || undefined,
          website: user.website || profileResult?.website || undefined,
          linksText: profileResult?.links
            ? JSON.stringify(profileResult.links, null, 2)
            : fallbackInstructor?.links
            ? JSON.stringify(fallbackInstructor.links, null, 2)
            : undefined,
        });
        instructorDetailForm.setFieldsValue({
          id: instructorEntityResult?.id,
          userId: instructorEntityResult?.userId || user.id,
          name: instructorEntityResult?.name || user.name,
          title: instructorEntityResult?.title || undefined,
          email: instructorEntityResult?.email || user.email,
          phone: instructorEntityResult?.phone || user.phone || undefined,
          affiliation: instructorEntityResult?.affiliation || undefined,
          bio: instructorEntityResult?.bio || undefined,
          specialties: instructorEntityResult?.specialties?.join(", ") || undefined,
          degrees: instructorEntityResult?.degrees || [],
          careers: instructorEntityResult?.careers || [],
          publications: instructorEntityResult?.publications || [],
          certifications: instructorEntityResult?.certifications || [],
        });
      } catch (error) {
        if (!cancelled) {
          instructorForm.setFieldsValue({ name: user.name });
          instructorDetailForm.setFieldsValue({
            userId: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone || undefined,
            degrees: [],
            careers: [],
            publications: [],
            certifications: [],
          });
          message.error("강사 프로필 정보를 불러오지 못했습니다.");
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [accessToken, user.name, user.email, user.phone, user.website, instructorForm, instructorDetailForm, user.id]);

  useEffect(() => {
    nameForm.setFieldsValue({
      name: user.name,
      phone: user.phone || undefined,
      website: user.website || undefined,
    });
  }, [nameForm, user.name, user.phone, user.website]);

  useEffect(() => {
    if (!accessToken || user?.role !== "instructor") return;
    let cancelled = false;
    const loadTemplates = async () => {
      try {
        const templateResult = (await api.templateList(
          1,
          50,
          "instructor_profile",
        )) as { items: { id: string; name: string }[] };
        if (cancelled) return;
        setTemplates(templateResult?.items || []);
      } catch {
        if (!cancelled) {
          message.error("내보내기 템플릿을 불러오지 못했습니다.");
        }
      }
    };
    loadTemplates();
    return () => {
      cancelled = true;
    };
  }, [accessToken, user?.role]);

  const handleExportProfile = async (values: { templateId: string; label?: string }) => {
    if (!accessToken) {
      message.warning("로그인 후 이용해주세요.");
      return;
    }
    setExportLoading(true);
    try {
      let resolvedProfileId = profileId;
      if (!resolvedProfileId) {
        const latest = (await api.getInstructorProfile(
          accessToken,
        )) as InstructorProfileData | null;
        resolvedProfileId = latest?.id || null;
      }
      if (!resolvedProfileId) {
        const detailName =
          (instructorDetailForm.getFieldValue("name") as string | undefined) ||
          user.name;
        const detailTitle = instructorDetailForm.getFieldValue("title") as
          | string
          | undefined;
        const detailBio = instructorDetailForm.getFieldValue("bio") as
          | string
          | undefined;
        const detailPhone = instructorDetailForm.getFieldValue("phone") as
          | string
          | undefined;
        await api.updateInstructorProfile({
          token: accessToken,
          displayName: detailName,
          title: toOptionalString(detailTitle),
          bio: toOptionalString(detailBio),
          phone: toOptionalString(detailPhone),
          website: user.website ?? undefined,
        });
        const created = (await api.getInstructorProfile(
          accessToken,
        )) as InstructorProfileData | null;
        resolvedProfileId = created?.id || null;
      }
      if (!resolvedProfileId) {
        message.warning("강사 프로필이 없어 내보내기를 진행할 수 없습니다.");
        return;
      }
      setProfileId(resolvedProfileId);
      await api.renderInstructorProfilePdf({
        token: accessToken,
        templateId: values.templateId,
        profileId: resolvedProfileId,
        label: values.label,
      });
      message.success("내보내기 작업이 등록되었습니다. 내 문서함에서 확인하세요.");
      exportForm.resetFields();
    } catch (error) {
      message.error(parseError((error as Error).message));
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <Title level={3}>내 정보</Title>

      {/* User Info Card */}
      <Card style={{ marginBottom: 24 }}>
        <Form
          form={nameForm}
          onFinish={handleBasicInfoUpdate}
          layout="vertical"
          initialValues={{
            name: user.name,
            phone: user.phone || undefined,
            website: user.website || undefined,
          }}
        >
          <Form.Item
            name="name"
            label="이름"
            rules={[{ required: true, message: "이름을 입력하세요" }]}
          >
            <Input prefix={<UserOutlined />} placeholder="이름" style={{ maxWidth: 320 }} />
          </Form.Item>
          <Form.Item label="이메일">
            <Input value={user.email} disabled style={{ maxWidth: 420 }} />
          </Form.Item>
          <Form.Item name="phone" label="전화번호">
            <Input placeholder="예: 010-1234-5678" style={{ maxWidth: 320 }} />
          </Form.Item>
          <Form.Item name="website" label="웹사이트">
            <Input placeholder="https://example.com" style={{ maxWidth: 420 }} />
          </Form.Item>
          <Descriptions column={1} labelStyle={{ width: 120 }} style={{ marginBottom: 16 }}>
            <Descriptions.Item label="역할">
              <Tag color={roleLabel[user.role].color}>
                {roleLabel[user.role].text}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="가입일">
              {new Date(user.createdAt).toLocaleDateString("ko-KR")}
            </Descriptions.Item>
            {user.lastLoginAt && (
              <Descriptions.Item label="마지막 로그인">
                {new Date(user.lastLoginAt).toLocaleString("ko-KR")}
              </Descriptions.Item>
            )}
          </Descriptions>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={nameLoading}>
              저장
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* Password Change */}
      <Card title="비밀번호 변경" style={{ marginBottom: 24 }}>
        <Text type="secondary">
          비밀번호 변경은 확인 모달에서 진행합니다.
        </Text>
        <Divider />
        <Button type="primary" onClick={() => setPasswordModalOpen(true)}>
          비밀번호 변경
        </Button>
      </Card>

      {/* Instructor Profile Section */}
      {user.role !== "instructor" ? (
        <Card title="강사 신청" style={{ marginBottom: 24 }}>
          <Text type="secondary">
            강사로 등록하면 더 많은 기능을 이용할 수 있습니다.
          </Text>
          {instructorProfile?.isPending && (
            <div style={{ marginTop: 12 }}>
              <Tag color="orange">승인 대기중</Tag>
            </div>
          )}
          <Form
            form={instructorForm}
            onFinish={handleRequestInstructor}
            layout="vertical"
            style={{ marginTop: 16 }}
          >
            <Form.Item
              name="name"
              label="이름"
              initialValue={user.name}
            >
              <Input placeholder="강사 이름" />
            </Form.Item>

            <Form.Item name="title" label="직함">
              <Input placeholder="예: 교수, 강사, 전문가 등" />
            </Form.Item>

            <Form.Item name="bio" label="자기소개">
              <Input.TextArea
                placeholder="자신의 경력, 전문성 등을 소개해주세요"
                rows={3}
              />
            </Form.Item>

            <Form.Item name="phone" label="연락처">
              <Input placeholder="예: 010-1234-5678" />
            </Form.Item>

            <Form.Item name="website" label="웹사이트">
              <Input placeholder="https://example.com" />
            </Form.Item>

            <Form.Item name="linksText" label="추가 링크(JSON)">
              <Input.TextArea
                rows={3}
                placeholder='예: [{"label":"LinkedIn","url":"https://..."}]'
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={instructorLoading}
              >
                강사 신청 제출
              </Button>
            </Form.Item>
          </Form>
        </Card>
      ) : (
        <>
          <Card title="강사 상세 정보 수정 (강사관리 연동)" style={{ marginBottom: 24 }}>
            {instructorProfile?.isApproved ? (
              <div style={{ marginBottom: 12 }}>
                <Tag color="green">승인 완료</Tag>
              </div>
            ) : instructorProfile?.isPending ? (
              <div style={{ marginBottom: 12 }}>
                <Tag color="orange">승인 대기중</Tag>
              </div>
            ) : null}
            <Form
              form={instructorDetailForm}
              onFinish={handleUpdateInstructorDetail}
              layout="vertical"
              initialValues={{
                degrees: [],
                careers: [],
                publications: [],
                certifications: [],
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                <Form.Item name="id" label="강사 ID">
                  <Input disabled />
                </Form.Item>
                <Form.Item name="userId" label="사용자 ID">
                  <Input disabled />
                </Form.Item>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                <Form.Item
                  name="name"
                  label="이름"
                  rules={[{ required: true, message: "이름을 입력하세요" }]}
                >
                  <Input />
                </Form.Item>
                <Form.Item name="title" label="직함">
                  <Input />
                </Form.Item>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                <Form.Item
                  name="email"
                  label="이메일"
                  rules={[{ type: "email", message: "올바른 이메일 형식을 입력하세요" }]}
                >
                  <Input />
                </Form.Item>
                <Form.Item name="phone" label="전화번호">
                  <Input />
                </Form.Item>
              </div>

              <Form.Item name="affiliation" label="소속">
                <Input />
              </Form.Item>
              <Form.Item name="specialties" label="전문분야 (쉼표로 구분)">
                <Input placeholder="예: 리더십, 커뮤니케이션, 조직문화" />
              </Form.Item>
              <Form.Item name="bio" label="자기소개">
                <Input.TextArea rows={3} />
              </Form.Item>

              <Divider titlePlacement="start">학위</Divider>
              <Form.List name="degrees">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map(({ key, name, ...restField }) => (
                      <Space key={key} align="start" style={{ display: "flex", marginBottom: 8 }}>
                        <Form.Item {...restField} name={[name, "name"]}>
                          <Select
                            placeholder="학위"
                            style={{ width: 100 }}
                            options={[
                              { value: "학사", label: "학사" },
                              { value: "석사", label: "석사" },
                              { value: "박사", label: "박사" },
                              { value: "기타", label: "기타" },
                            ]}
                          />
                        </Form.Item>
                        <Form.Item {...restField} name={[name, "school"]}>
                          <Input placeholder="학교" />
                        </Form.Item>
                        <Form.Item {...restField} name={[name, "major"]}>
                          <Input placeholder="전공" />
                        </Form.Item>
                        <Form.Item {...restField} name={[name, "year"]}>
                          <Input placeholder="연도" />
                        </Form.Item>
                        <Form.Item {...restField} name={[name, "fileUrl"]}>
                          <Input placeholder="첨부파일 URL(선택)" />
                        </Form.Item>
                        <MinusCircleOutlined onClick={() => remove(name)} />
                      </Space>
                    ))}
                    <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                      학위 추가
                    </Button>
                  </>
                )}
              </Form.List>

              <Divider titlePlacement="start">주요경력</Divider>
              <Form.List name="careers">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map(({ key, name, ...restField }) => (
                      <Space key={key} align="start" style={{ display: "flex", marginBottom: 8 }}>
                        <Form.Item {...restField} name={[name, "company"]}>
                          <Input placeholder="회사/기관" />
                        </Form.Item>
                        <Form.Item {...restField} name={[name, "role"]}>
                          <Input placeholder="직책/역할" />
                        </Form.Item>
                        <Form.Item {...restField} name={[name, "period"]}>
                          <Input placeholder="기간" />
                        </Form.Item>
                        <Form.Item {...restField} name={[name, "description"]}>
                          <Input placeholder="설명(선택)" />
                        </Form.Item>
                        <MinusCircleOutlined onClick={() => remove(name)} />
                      </Space>
                    ))}
                    <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                      경력 추가
                    </Button>
                  </>
                )}
              </Form.List>

              <Divider titlePlacement="start">출판/논문</Divider>
              <Form.List name="publications">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map(({ key, name, ...restField }) => (
                      <Space key={key} align="start" style={{ display: "flex", marginBottom: 8 }}>
                        <Form.Item {...restField} name={[name, "title"]}>
                          <Input placeholder="제목" />
                        </Form.Item>
                        <Form.Item {...restField} name={[name, "type"]}>
                          <Select
                            placeholder="구분"
                            style={{ width: 100 }}
                            options={[
                              { value: "출판", label: "출판" },
                              { value: "논문", label: "논문" },
                            ]}
                          />
                        </Form.Item>
                        <Form.Item {...restField} name={[name, "year"]}>
                          <Input placeholder="연도" />
                        </Form.Item>
                        <Form.Item {...restField} name={[name, "publisher"]}>
                          <Input placeholder="출판사/학회" />
                        </Form.Item>
                        <MinusCircleOutlined onClick={() => remove(name)} />
                      </Space>
                    ))}
                    <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                      출판/논문 추가
                    </Button>
                  </>
                )}
              </Form.List>

              <Divider titlePlacement="start">자격증</Divider>
              <Form.List name="certifications">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map(({ key, name, ...restField }) => (
                      <Space key={key} align="start" style={{ display: "flex", marginBottom: 8 }}>
                        <Form.Item {...restField} name={[name, "name"]}>
                          <Input placeholder="자격증명" />
                        </Form.Item>
                        <Form.Item {...restField} name={[name, "issuer"]}>
                          <Input placeholder="발급기관" />
                        </Form.Item>
                        <Form.Item {...restField} name={[name, "date"]}>
                          <Input placeholder="취득일" />
                        </Form.Item>
                        <Form.Item {...restField} name={[name, "fileUrl"]}>
                          <Input placeholder="사본 URL(선택)" />
                        </Form.Item>
                        <MinusCircleOutlined onClick={() => remove(name)} />
                      </Space>
                    ))}
                    <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                      자격증 추가
                    </Button>
                  </>
                )}
              </Form.List>

              <Form.Item style={{ marginTop: 16 }}>
                <Button type="primary" htmlType="submit" loading={instructorDetailLoading}>
                  강사 상세 저장
                </Button>
              </Form.Item>
            </Form>
          </Card>
          <Card title="프로필 내보내기" style={{ marginBottom: 24 }}>
            <Form form={exportForm} layout="vertical" onFinish={handleExportProfile}>
              <Form.Item
                name="templateId"
                label="템플릿 선택"
                rules={[{ required: true, message: "템플릿을 선택하세요" }]}
              >
                <Select
                  placeholder="강사 프로필 템플릿 선택"
                  options={templates.map((t) => ({ value: t.id, label: t.name }))}
                />
              </Form.Item>
              <Form.Item name="label" label="문서 라벨 (선택)">
                <Input placeholder="예: 리더십 강사 소개서" />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" loading={exportLoading}>
                  내보내기
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </>
      )}

      {/* Account Delete */}
      <Card title="계정 삭제" style={{ marginBottom: 24 }}>
        <Text type="secondary">
          계정을 삭제하면 더 이상 로그인할 수 없습니다. 이 작업은 취소할 수
          없습니다.
        </Text>
        <Divider />
        <Button danger onClick={() => setDeleteModalOpen(true)}>
          계정 삭제
        </Button>
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal
        title="비밀번호 변경"
        open={passwordModalOpen}
        onCancel={() => {
          setPasswordModalOpen(false);
          passwordForm.resetFields();
        }}
        footer={null}
      >
        <Form
          form={passwordForm}
          onFinish={handlePasswordUpdate}
          layout="vertical"
        >
          <Form.Item
            name="currentPassword"
            label="현재 비밀번호"
            rules={[{ required: true, message: "현재 비밀번호를 입력하세요" }]}
          >
            <Input.Password prefix={<LockOutlined />} />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="새 비밀번호"
            rules={[
              { required: true, message: "새 비밀번호를 입력하세요" },
              { min: 8, message: "8자 이상 입력하세요" },
            ]}
            extra="8자 이상, 영문과 숫자를 포함해야 합니다"
          >
            <Input.Password prefix={<LockOutlined />} />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="새 비밀번호 확인"
            dependencies={["newPassword"]}
            rules={[
              { required: true, message: "새 비밀번호를 다시 입력하세요" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("newPassword") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(
                    new Error("비밀번호가 일치하지 않습니다"),
                  );
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined />} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: "right" }}>
            <Button
              onClick={() => {
                setPasswordModalOpen(false);
                passwordForm.resetFields();
              }}
              style={{ marginRight: 8 }}
            >
              취소
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={passwordLoading}
            >
              변경
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          <span>
            <ExclamationCircleOutlined
              style={{ color: "#ff4d4f", marginRight: 8 }}
            />
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
            rules={[{ required: true, message: "비밀번호를 입력하세요" }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="비밀번호" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: "right" }}>
            <Button
              onClick={() => setDeleteModalOpen(false)}
              style={{ marginRight: 8 }}
            >
              취소
            </Button>
            <Button
              type="primary"
              danger
              htmlType="submit"
              loading={deleteLoading}
            >
              삭제
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
