import {
    ExclamationCircleOutlined,
    LockOutlined,
    UserOutlined,
} from "@ant-design/icons";
import {
    Avatar,
    Button,
    Card,
    theme,
    Descriptions,
    Divider,
    Form,
    Input,
    message,
    Modal,
    Select,
    Space,
    Tag,
    Tabs,
    Typography,
} from "antd";
import { useEffect, useState } from "react";
import type { RcFile } from "antd/es/upload";
import { useNavigate } from "react-router-dom";
import { api } from "../api/mcpClient";
import { useAuth } from "../contexts/AuthContext";
import AvatarUploadField from "../components/AvatarUploadField";
import InstructorCareerSection from "../components/InstructorCareerSection";
import PlannedFeaturePanel from "../components/PlannedFeaturePanel";
import SecuritySettingSection from "../components/SecuritySettingSection";
import { parseMcpError } from "../utils/error";
import {
  linksTextToJson,
  normalizeInstructorCollections,
  toCsvText,
  toOptionalString,
  type Career,
  type Certification,
  type Degree,
  type Publication,
} from "../utils/instructorPayload";

const { Title, Text } = Typography;

interface InstructorProfileData {
  id?: string | null;
  displayName?: string | null;
  title?: string | null;
  bio?: string | null;
  phone?: string | null;
  website?: string | null;
  links?: unknown;
  degrees?: Degree[] | null;
  careers?: Career[] | null;
  publications?: Publication[] | null;
  certifications?: Certification[] | null;
  specialties?: string[] | null;
  affiliation?: string | null;
  email?: string | null;
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

interface InstructorEntityData {
  id?: string;
  userId?: string;
  name?: string;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  affiliation?: string | null;
  tagline?: string | null;
  awards?: string[] | null;
  bio?: string | null;
  specialties?: string[] | null;
  degrees?: Degree[] | null;
  careers?: Career[] | null;
  publications?: Publication[] | null;
  certifications?: Certification[] | null;
}

const SERVER_URL = "";

export default function ProfilePage() {
  const { user, accessToken, logout, updateUser } = useAuth();
  const { token } = theme.useToken();
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
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [instructorLoading, setInstructorLoading] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [instructorDetailLoading, setInstructorDetailLoading] = useState(false);
  const [templates, setTemplates] = useState<Array<{ id: string; name: string }>>([]);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [instructorProfile, setInstructorProfile] = useState<InstructorProfileData | null>(null);
  const [instructorEntity, setInstructorEntity] = useState<InstructorEntityData | null>(null);
  const [profileTab, setProfileTab] = useState<"overview" | "instructor" | "security">("overview");
  const [avatarUploading, setAvatarUploading] = useState(false);


  useEffect(() => {
    if (!accessToken || !user) return;
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
          degrees: profileResult?.degrees || [],
          careers: profileResult?.careers || [],
          publications: profileResult?.publications || [],
          certifications: profileResult?.certifications || [],
          specialtiesText: profileResult?.specialties?.join(", ") || undefined,
          affiliation: profileResult?.affiliation || undefined,
          email: profileResult?.email || user.email || undefined,
          avatarUrl: user.avatarUrl || undefined,
        });
        instructorDetailForm.setFieldsValue({
          id: instructorEntityResult?.id,
          userId: instructorEntityResult?.userId || user.id,
          name: instructorEntityResult?.name || user.name,
          title: instructorEntityResult?.title || undefined,
          email: instructorEntityResult?.email || user.email,
          phone: instructorEntityResult?.phone || user.phone || undefined,
          avatarUrl: instructorEntityResult?.avatarUrl || undefined,
          affiliation: instructorEntityResult?.affiliation || undefined,
          tagline: instructorEntityResult?.tagline || undefined,
          awards: toCsvText(instructorEntityResult?.awards) || undefined,
          bio: instructorEntityResult?.bio || undefined,
          specialties: toCsvText(instructorEntityResult?.specialties) || undefined,
          degrees: instructorEntityResult?.degrees || [],
          careers: instructorEntityResult?.careers || [],
          publications: instructorEntityResult?.publications || [],
          certifications: instructorEntityResult?.certifications || [],
        });
      } catch {
        if (!cancelled) {
          instructorForm.setFieldsValue({
            name: user.name,
            avatarUrl: user.avatarUrl || undefined,
            degrees: [],
            careers: [],
            publications: [],
            certifications: [],
          });
          instructorDetailForm.setFieldsValue({
            userId: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone || undefined,
            avatarUrl: undefined,
            tagline: undefined,
            awards: undefined,
            degrees: [],
            careers: [],
            publications: [],
            certifications: [],
          });
          message.error("강사 프로필 정보를 불러오지 못했습니다.");
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [
    accessToken,
    user?.id,
    user?.name,
    user?.email,
    user?.phone,
    user?.website,
    user?.avatarUrl,
    instructorForm,
    instructorDetailForm,
  ]);

  useEffect(() => {
    if (!user) return;
    nameForm.setFieldsValue({
      name: user.name,
      phone: user.phone || undefined,
      website: user.website || undefined,
      avatarUrl: user.avatarUrl || undefined,
    });
  }, [nameForm, user?.name, user?.phone, user?.website, user?.avatarUrl]);

  useEffect(() => {
    if (!accessToken || !user || user.role !== "instructor") return;
    let cancelled = false;
    const loadTemplates = async () => {
      try {
        const templateResult = (await api.templateList(
          1,
          50,
          "instructor_profile",
          accessToken,
        )) as { items: { id: string; name: string }[] };
        if (cancelled) return;
        setTemplates(templateResult?.items || []);
      } catch {
        if (!cancelled) {
          message.error("내보내기 템플릿을 불러오지 못했습니다.");
        }
      }
    };
    void loadTemplates();
    return () => {
      cancelled = true;
    };
  }, [accessToken, user?.role]);
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

  const parseError = (errorMessage: string): string => parseMcpError(errorMessage);

  const normalizeInstructorPayload = (values: any) => ({
    displayName: values.name || values.displayName,
    title: toOptionalString(values.title),
    bio: toOptionalString(values.bio),
    phone: toOptionalString(values.phone),
    website: toOptionalString(values.website),
    links: linksTextToJson(values.linksText),
  });

  const handleUserAvatarUpload = async (info: { file: RcFile }) => {
    try {
      setAvatarUploading(true);
      const result = await api.uploadFile(info.file, accessToken);
      nameForm.setFieldValue("avatarUrl", result.url);
      message.success("프로필 사진이 업로드되었습니다.");
    } catch {
      message.error("프로필 사진 업로드에 실패했습니다.");
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleInstructorAvatarUpload = async (info: { file: RcFile }) => {
    try {
      setAvatarUploading(true);
      const result = await api.uploadFile(info.file, accessToken);
      instructorDetailForm.setFieldValue("avatarUrl", result.url);
      message.success("강사 사진이 업로드되었습니다.");
    } catch {
      message.error("강사 사진 업로드에 실패했습니다.");
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleInstructorRequestAvatarUpload = async (info: { file: RcFile }) => {
    try {
      setAvatarUploading(true);
      const result = await api.uploadFile(info.file, accessToken);
      instructorForm.setFieldValue("avatarUrl", result.url);
      message.success("강사 사진이 업로드되었습니다.");
    } catch {
      message.error("강사 사진 업로드에 실패했습니다.");
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleUploadFile = async (file: RcFile): Promise<string> => {
    const result = await api.uploadFile(file, accessToken);
    return result.url;
  };

  const handleBasicInfoUpdate = async (values: {
    name: string;
    phone?: string;
    website?: string;
    avatarUrl?: string;
  }) => {
    setNameLoading(true);
    try {
      const result = (await api.userUpdate({
        token: accessToken,
        name: values.name,
        phone: values.phone ?? null,
        website: values.website ?? null,
        avatarUrl: values.avatarUrl ?? null,
      })) as { name: string; phone?: string | null; website?: string | null; avatarUrl?: string | null };
      updateUser({
        ...user,
        name: result.name,
        phone: result.phone ?? null,
        website: result.website ?? null,
        avatarUrl: result.avatarUrl ?? null,
      });
      if (user.role === "instructor") {
        try {
          const current = instructorEntity
            ? instructorEntity
            : ((await api.instructorGetByUser(accessToken)) as InstructorEntityData);
          if (current?.id) {
            const currentCollections = normalizeInstructorCollections(
              (current as unknown as Record<string, unknown>) || {},
            );
            await api.instructorUpsert({
              token: accessToken,
              id: current.id,
              name: result.name,
              title: toOptionalString(current.title),
              email: toOptionalString(current.email),
              phone: result.phone ?? undefined,
              affiliation: toOptionalString(current.affiliation),
              bio: toOptionalString(current.bio),
              specialties: currentCollections.specialties,
              degrees: currentCollections.degrees,
              careers: currentCollections.careers,
              publications: currentCollections.publications,
              certifications: currentCollections.certifications,
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
      const collections = normalizeInstructorCollections(
        values as Record<string, unknown>,
        {
          specialtiesField: "specialtiesText",
          keepEmptyArrays: false,
        },
      );

      await api.requestInstructor({
        token: accessToken!,
        ...payload,
        avatarUrl: toOptionalString(values.avatarUrl),
        degrees: collections.degrees,
        careers: collections.careers,
        publications: collections.publications,
        certifications: collections.certifications,
        specialties: collections.specialties,
        affiliation: toOptionalString(values.affiliation),
        email: toOptionalString(values.email),
      });
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
      const collections = normalizeInstructorCollections(
        values as Record<string, unknown>,
      );

      await api.instructorUpsert({
        token: accessToken,
        id: instructorEntity?.id,
        name: values.name || user.name,
        title: toOptionalString(values.title),
        email: toOptionalString(values.email),
        phone: toOptionalString(values.phone),
        avatarUrl: toOptionalString(values.avatarUrl),
        affiliation: toOptionalString(values.affiliation),
        tagline: toOptionalString(values.tagline),
        awards: collections.awards,
        bio: toOptionalString(values.bio),
        specialties: collections.specialties,
        degrees: collections.degrees,
        careers: collections.careers,
        publications: collections.publications,
        certifications: collections.certifications,
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
        avatarUrl: latest?.avatarUrl || undefined,
        affiliation: latest?.affiliation || undefined,
        tagline: latest?.tagline || undefined,
        awards: toCsvText(latest?.awards) || undefined,
        bio: latest?.bio || undefined,
        specialties: toCsvText(latest?.specialties) || undefined,
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
    viewer: { color: "default", text: "사용자" },
    guest: { color: "gray", text: "게스트" },
  };

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
      navigate("/documents");
    } catch (error) {
      message.error(parseError((error as Error).message));
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <Title level={3}>내 정보</Title>
      <Tabs
        activeKey={profileTab}
        onChange={(key) => setProfileTab(key as "overview" | "instructor" | "security")}
        style={{ marginBottom: 16 }}
        items={[
          { key: "overview", label: "기본정보" },
          { key: "instructor", label: "강사정보" },
          { key: "security", label: "보안/계정" },
        ]}
      />

      {/* User Info Card */}
      {profileTab === "overview" && (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(420px, 1fr) minmax(280px, 360px)",
          gap: 16,
          alignItems: "start",
          marginBottom: 24,
        }}
      >
      <Card>
        <Form
          form={nameForm}
          onFinish={handleBasicInfoUpdate}
          layout="vertical"
          initialValues={{
            name: user.name,
            phone: user.phone || undefined,
            website: user.website || undefined,
            avatarUrl: user.avatarUrl || undefined,
          }}
        >
          <div style={{ display: "flex", gap: 24, marginBottom: 8 }}>
            <AvatarUploadField
              form={nameForm}
              onUpload={(file) => handleUserAvatarUpload({ file })}
              uploading={avatarUploading}
            />
            <div style={{ flex: 1 }}>
              <Form.Item
                name="name"
                label="이름"
                rules={[{ required: true, message: "이름을 입력하세요" }]}
              >
                <Input prefix={<UserOutlined />} placeholder="이름" style={{ maxWidth: 320 }} />
              </Form.Item>
            </div>
          </div>
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
      <Card title="요약">
        <Space style={{ marginBottom: 12 }}>
          <Avatar size={56} src={user.avatarUrl || undefined} icon={<UserOutlined />} />
          <div>
            <div style={{ fontWeight: 600 }}>{user.name}</div>
            <Text type="secondary">{user.email}</Text>
          </div>
        </Space>
        <Descriptions column={1} labelStyle={{ width: 110 }}>
          <Descriptions.Item label="이름">{user.name}</Descriptions.Item>
          <Descriptions.Item label="이메일">{user.email}</Descriptions.Item>
          <Descriptions.Item label="역할">
            <Tag color={roleLabel[user.role].color}>{roleLabel[user.role].text}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="강사 상태">
            {user.role === "instructor"
              ? instructorProfile?.isApproved
                ? "승인 완료"
                : instructorProfile?.isPending
                ? "승인 대기"
                : "강사"
              : "일반 사용자"}
          </Descriptions.Item>
          <Descriptions.Item label="가입일">
            {new Date(user.createdAt).toLocaleDateString("ko-KR")}
          </Descriptions.Item>
        </Descriptions>
        <Divider style={{ margin: "12px 0" }} />
        <Space wrap>
          <Button onClick={() => setProfileTab("instructor")}>강사정보 이동</Button>
          <Button onClick={() => setProfileTab("security")}>보안 설정 이동</Button>
        </Space>
      </Card>
      </div>
      )}

      {/* Password Change - moved to 위험 설정 card below */}

      {/* Instructor Profile Section */}
      {profileTab === "instructor" && (user.role !== "instructor" ? (
        instructorProfile?.isPending ? (
          <Card title="강사 승인 대기" style={{ marginBottom: 24 }}>
            <Text type="secondary">
              강사 신청이 접수되었습니다. 관리자 승인 후 강사 기능을 사용할 수 있습니다.
            </Text>
            <div style={{ marginTop: 12 }}>
              <Tag color="orange">승인 대기중</Tag>
            </div>
          </Card>
        ) : (
        <Card title="강사 신청" style={{ marginBottom: 24 }}>
          <Text type="secondary">강사 등록 시 더 많은 기능을 이용할 수 있습니다.</Text>
          <Form
            form={instructorForm}
            onFinish={handleRequestInstructor}
            layout="vertical"
            style={{ marginTop: 16 }}
            initialValues={{
              degrees: [],
              careers: [],
              publications: [],
              certifications: [],
            }}
          >
            <div style={{ display: "flex", gap: 24 }}>
              <AvatarUploadField
                form={instructorForm}
                onUpload={(file) => handleInstructorRequestAvatarUpload({ file })}
                uploading={avatarUploading}
                serverUrl={SERVER_URL}
              />
              <div style={{ flex: 1 }}>
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
              </div>
            </div>

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

            <Divider />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
              <Form.Item name="affiliation" label="소속">
                <Input placeholder="소속 기관" />
              </Form.Item>
              <Form.Item name="email" label="이메일">
                <Input placeholder="연락용 이메일" />
              </Form.Item>
            </div>
            <Form.Item name="specialtiesText" label="전문분야 (쉼표로 구분)">
              <Input placeholder="예: 리더십, 커뮤니케이션, 조직문화" />
            </Form.Item>

            <InstructorCareerSection
              form={instructorForm}
              mode="simple"
              defaultOpen={true}
              titlePlacement="left"
            />

            <Form.Item style={{ marginTop: 16 }}>
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
        )
      ) : (
        <>
          <Card style={{ marginBottom: 24 }}>
            <Form
              form={instructorDetailForm}
              onFinish={handleUpdateInstructorDetail}
              layout="vertical"
              initialValues={{
                avatarUrl: undefined,
                degrees: [],
                careers: [],
                publications: [],
                certifications: [],
              }}
            >
              <div style={{ display: "flex", gap: 24 }}>
                <AvatarUploadField
                  form={instructorDetailForm}
                  onUpload={(file) => handleInstructorAvatarUpload({ file })}
                  uploading={avatarUploading}
                  serverUrl={SERVER_URL}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                    <Form.Item name="id" label="강사 ID">
                      <Input disabled />
                    </Form.Item>
                    <Form.Item name="userId" label="사용자 ID">
                      <Input disabled />
                    </Form.Item>
                  </div>
                  <Form.Item
                    name="name"
                    label="이름"
                    rules={[{ required: true, message: "이름을 입력하세요" }]}
                  >
                    <Input />
                  </Form.Item>
                  <Form.Item name="title" label="직함">
                    <Input placeholder="예: 수석 컨설턴트" />
                  </Form.Item>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                <Form.Item
                  name="email"
                  label="이메일"
                  rules={[{ type: "email", message: "올바른 이메일 형식을 입력하세요" }]}
                >
                  <Input placeholder="예: instructor@company.com" />
                </Form.Item>
                <Form.Item name="phone" label="전화번호">
                  <Input />
                </Form.Item>
              </div>

              <Form.Item name="affiliation" label="소속">
                <Input />
              </Form.Item>
              <Form.Item name="tagline" label="한줄 소개">
                <Input placeholder="예: 조직성과를 만드는 실무형 교육 전문가" />
              </Form.Item>
              <Form.Item name="specialties" label="전문분야 (쉼표로 구분)">
                <Input placeholder="예: 리더십, 커뮤니케이션, 조직문화" />
              </Form.Item>
              <Form.Item name="awards" label="수상 (쉼표로 구분)">
                <Input placeholder="예: 올해의 강사상, 교육혁신상" />
              </Form.Item>
              <Form.Item name="bio" label="자기소개">
                <Input.TextArea rows={3} placeholder="강사 자기소개를 입력하세요 (선택)" />
              </Form.Item>

              <InstructorCareerSection
                form={instructorDetailForm}
                mode="upload"
                onUploadFile={handleUploadFile}
                defaultOpen={true}
                titlePlacement="start"
                compactAddButton={true}
              />

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
      ))}

      {/* Security & Danger Settings */}
      {profileTab === "security" && (
      <Card
        title={
          <span style={{ color: token.colorTextSecondary, fontSize: 13 }}>
            보안 설정
          </span>
        }
        style={{ marginBottom: 24 }}
        styles={{ body: { padding: 0 } }}
      >
        <SecuritySettingSection title="비밀번호 변경" toneColor={token.colorTextSecondary}>
          <div style={{ marginTop: 12 }}>
            <Text type="secondary">비밀번호 변경은 확인 모달에서 진행합니다.</Text>
            <Divider style={{ margin: '12px 0' }} />
            <Button onClick={() => setPasswordModalOpen(true)}>
              비밀번호 변경
            </Button>
          </div>
        </SecuritySettingSection>
        <Divider style={{ margin: 0 }} />
        <SecuritySettingSection title="소셜 계정 연동" toneColor={token.colorTextSecondary}>
          <div style={{ marginTop: 12 }}>
            <PlannedFeaturePanel
              title="Google / NAVER 계정 연결"
              description="현재는 소셜 계정 연결/해제를 지원하지 않습니다."
              actions={["Google 연결", "NAVER 연결"]}
            />
          </div>
        </SecuritySettingSection>
        <Divider style={{ margin: 0 }} />
        <SecuritySettingSection title="계정 삭제" toneColor={token.colorTextSecondary}>
          <div style={{ marginTop: 12 }}>
            <Text type="danger">
              계정을 삭제하면 더 이상 로그인할 수 없습니다. 이 작업은 취소할 수
              없습니다.
            </Text>
            <Divider style={{ margin: '12px 0' }} />
            <Button danger onClick={() => setDeleteModalOpen(true)}>
              계정 삭제 진행
            </Button>
          </div>
        </SecuritySettingSection>
      </Card>
      )}

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
        onCancel={() => {
          setDeleteModalOpen(false);
          setDeleteConfirmText('');
          deleteForm.resetFields();
        }}
        footer={null}
      >
        <Text>계정을 삭제하려면 아래 확인 절차를 진행하세요.</Text>
        <div style={{ marginTop: 16 }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            확인을 위해 <Text strong code>"계정삭제"</Text>를 입력하세요.
          </Text>
          <Input
            style={{ marginTop: 8 }}
            placeholder="계정삭제"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            status={deleteConfirmText && deleteConfirmText !== '계정삭제' ? 'error' : undefined}
          />
        </div>
        <Form
          form={deleteForm}
          onFinish={handleDelete}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="password"
            label="비밀번호"
            rules={[{ required: true, message: "비밀번호를 입력하세요" }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="비밀번호" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: "right" }}>
            <Button
              onClick={() => {
                setDeleteModalOpen(false);
                setDeleteConfirmText('');
                deleteForm.resetFields();
              }}
              style={{ marginRight: 8 }}
            >
              취소
            </Button>
            <Button
              type="primary"
              danger
              htmlType="submit"
              loading={deleteLoading}
              disabled={deleteConfirmText !== '계정삭제'}
            >
              삭제
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
