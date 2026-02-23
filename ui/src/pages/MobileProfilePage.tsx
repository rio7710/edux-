import { useEffect, useState } from "react";
import {
  Avatar,
  Button,
  Card,
  Collapse,
  Divider,
  Form,
  Input,
  Modal,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import { MinusCircleOutlined, PlusOutlined, UserOutlined, FilePdfOutlined, SendOutlined, IdcardOutlined } from "@ant-design/icons";
import { useOutletContext } from "react-router-dom";
import { api } from "../api/mcpClient";
import { useAuth } from "../contexts/AuthContext";
import { buildMobilePdfFileName } from "../utils/mobileFilename";
import {
  normalizeInstructorCollections,
  toOptionalString,
} from "../utils/instructorPayload";
import { getPreferredTemplateId } from "../utils/templatePreference";
import {
  mobileMockInstructorProfile,
  mobileMockProfile,
} from "../utils/mobileMockData";
import MobilePageHint from "../components/MobilePageHint";

const { Text } = Typography;

const isInstructorRole = (role?: string) =>
  role === "instructor" || role === "admin" || role === "operator";

export default function MobileProfilePage() {
  const { user, accessToken, updateUser } = useAuth();
  const { debugRole } = useOutletContext<{ debugRole?: string }>();
  const [profileForm] = Form.useForm();
  const [instructorForm] = Form.useForm();
  const [savingChanges, setSavingChanges] = useState(false);
  const [issuingPdf, setIssuingPdf] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [instructorEntityId, setInstructorEntityId] = useState<string | undefined>();
  const [instructorTemplateId, setInstructorTemplateId] = useState<string>();
  const [basicDirty, setBasicDirty] = useState(false);
  const [instructorDirty, setInstructorDirty] = useState(false);

  const role = debugRole || user?.role || mobileMockProfile.roleLabel;
  const actualRole = user?.role || "viewer";
  const showInstructorSection = isInstructorRole(actualRole);

  const initialBasic = {
    name: user?.name || mobileMockProfile.name,
    email: user?.email || mobileMockProfile.email,
    phone: user?.phone || mobileMockProfile.phone || "",
    website: user?.website || mobileMockProfile.website || "",
  };

  const initialInstructor = {
    displayName: mobileMockInstructorProfile.displayName,
    title: mobileMockInstructorProfile.title,
    affiliation: mobileMockInstructorProfile.affiliation || "",
    specialties: mobileMockInstructorProfile.specialties.join(", "),
    bio: mobileMockInstructorProfile.bio,
    degrees: mobileMockInstructorProfile.degrees || [],
    careers: mobileMockInstructorProfile.careers || [],
    publications: mobileMockInstructorProfile.publications || [],
    certifications: mobileMockInstructorProfile.certifications || [],
  };

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    const load = async () => {
      setLoadingData(true);
      try {
        profileForm.setFieldsValue({
          name: user?.name || initialBasic.name,
          email: user?.email || initialBasic.email,
          phone: user?.phone || initialBasic.phone,
          website: user?.website || initialBasic.website,
        });

        const templateResult = (await api.templateList(
          1,
          30,
          "instructor_profile",
          accessToken,
        )) as { items?: Array<{ id: string; name: string }> };
        if (!cancelled && !instructorTemplateId && templateResult?.items?.length) {
          setInstructorTemplateId(templateResult.items[0].id);
        }

        if (!showInstructorSection) return;

        const [profileResult, entityResult] = await Promise.allSettled([
          api.getInstructorProfile(accessToken) as Promise<{
            id?: string;
            displayName?: string;
            title?: string;
            bio?: string;
            phone?: string;
            website?: string;
            affiliation?: string;
            email?: string;
            specialties?: string[];
            degrees?: unknown[];
            careers?: unknown[];
            publications?: unknown[];
            certifications?: unknown[];
          } | null>,
          api.instructorGetByUser(accessToken) as Promise<{
            id?: string;
            name?: string;
            title?: string;
            bio?: string;
            phone?: string;
            affiliation?: string;
            email?: string;
            specialties?: string[];
            degrees?: unknown[];
            careers?: unknown[];
            publications?: unknown[];
            certifications?: unknown[];
          } | null>,
        ]);
        if (cancelled) return;

        const profile =
          profileResult.status === "fulfilled" ? profileResult.value : null;
        const entity =
          entityResult.status === "fulfilled" ? entityResult.value : null;
        setProfileId(profile?.id || null);
        setInstructorEntityId(entity?.id);

        instructorForm.setFieldsValue({
          displayName: entity?.name || profile?.displayName || user?.name || initialInstructor.displayName,
          title: entity?.title || profile?.title || initialInstructor.title,
          affiliation: entity?.affiliation || profile?.affiliation || initialInstructor.affiliation,
          specialties:
            (entity?.specialties || profile?.specialties || []).join(", "),
          bio: entity?.bio || profile?.bio || initialInstructor.bio,
          degrees: entity?.degrees || profile?.degrees || [],
          careers: entity?.careers || profile?.careers || [],
          publications: entity?.publications || profile?.publications || [],
          certifications: entity?.certifications || profile?.certifications || [],
        });
      } catch {
        if (!cancelled) {
          message.error("모바일 프로필 데이터를 불러오지 못했습니다.");
        }
      } finally {
        if (!cancelled) {
          setLoadingData(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, showInstructorSection, user?.id]);

  const saveChanges = async (): Promise<boolean> => {
    if (!accessToken || !user) {
      message.warning("로그인이 필요합니다.");
      return false;
    }
    setSavingChanges(true);
    try {
      const basicValues = await profileForm.validateFields();
      const basicUpdate = (await api.userUpdate({
        token: accessToken,
        name: toOptionalString(basicValues.name) || user.name,
        phone: toOptionalString(basicValues.phone) ?? null,
        website: toOptionalString(basicValues.website) ?? null,
      })) as {
        name: string;
        phone?: string | null;
        website?: string | null;
        avatarUrl?: string | null;
      };
      updateUser({
        ...user,
        name: basicUpdate.name || user.name,
        phone: basicUpdate.phone ?? null,
        website: basicUpdate.website ?? null,
        avatarUrl: basicUpdate.avatarUrl ?? user.avatarUrl ?? null,
      });

      if (showInstructorSection) {
        const instructorValues = await instructorForm.validateFields();
        const collections = normalizeInstructorCollections(
          instructorValues as Record<string, unknown>,
        );

        await api.instructorUpsert({
          token: accessToken,
          id: instructorEntityId,
          name:
            toOptionalString(instructorValues.displayName) ||
            toOptionalString(basicValues.name) ||
            user.name,
          title: toOptionalString(instructorValues.title),
          email: toOptionalString(basicValues.email) || user.email,
          phone: toOptionalString(basicValues.phone),
          affiliation: toOptionalString(instructorValues.affiliation),
          bio: toOptionalString(instructorValues.bio),
          specialties: collections.specialties,
          degrees: collections.degrees,
          careers: collections.careers,
          publications: collections.publications,
          certifications: collections.certifications,
        });

        await api.updateInstructorProfile({
          token: accessToken,
          displayName:
            toOptionalString(instructorValues.displayName) ||
            toOptionalString(basicValues.name) ||
            user.name,
          title: toOptionalString(instructorValues.title),
          bio: toOptionalString(instructorValues.bio),
          phone: toOptionalString(basicValues.phone),
          website: toOptionalString(basicValues.website),
          affiliation: toOptionalString(instructorValues.affiliation),
          email: toOptionalString(basicValues.email),
          specialties: collections.specialties,
          degrees: collections.degrees,
          careers: collections.careers,
          publications: collections.publications,
          certifications: collections.certifications,
        });

        const latestProfile = (await api.getInstructorProfile(accessToken)) as { id?: string } | null;
        setProfileId(latestProfile?.id || null);
      }

      setBasicDirty(false);
      setInstructorDirty(false);
      message.success("변경사항 저장 완료");
      return true;
    } catch {
      message.error("입력값을 확인해주세요.");
      return false;
    } finally {
      setSavingChanges(false);
    }
  };

  const runWithSaveCheck = (nextAction: () => void | Promise<void>) => {
    if (!basicDirty && !instructorDirty) {
      void nextAction();
      return;
    }
    Modal.confirm({
      title: "변경사항이 있습니다",
      content: "저장 하시겠습니까?",
      okText: "저장",
      cancelText: "취소",
      onOk: async () => {
        const saved = await saveChanges();
        if (saved) await nextAction();
      },
    });
  };

  return (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <MobilePageHint
        icon={<IdcardOutlined />}
        title="내 정보는 저장 후 PDF 생성 권장"
        description="변경사항이 있으면 저장 확인 후 진행됩니다."
      />
      <Card size="small" styles={{ body: { padding: 14 } }} className="m-card">
        <Space direction="vertical" size={14} style={{ width: "100%" }}>
          <Space>
            <Avatar size={56} icon={<UserOutlined />} src={user?.avatarUrl || undefined} />
            <Space direction="vertical" size={2}>
              <Text strong style={{ fontSize: 16 }}>
                {initialBasic.name}
              </Text>
              <Tag color="blue" style={{ width: "fit-content", margin: 0 }}>
                {role}
              </Tag>
            </Space>
          </Space>
          <Divider style={{ margin: "8px 0" }} />
          <Form
            form={profileForm}
            layout="vertical"
            initialValues={initialBasic}
            onValuesChange={() => setBasicDirty(true)}
          >
            <Form.Item name="name" label="이름" rules={[{ required: true, message: "이름을 입력하세요." }]}>
              <Input />
            </Form.Item>
            <Form.Item
              name="email"
              label="이메일"
              rules={[{ required: true, message: "이메일을 입력하세요." }]}
            >
              <Input />
            </Form.Item>
            <Form.Item name="phone" label="전화번호">
              <Input />
            </Form.Item>
            <Form.Item name="website" label="웹사이트">
              <Input />
            </Form.Item>
          </Form>
        </Space>
      </Card>

      {showInstructorSection && (
        <Card size="small" styles={{ body: { padding: 14 } }} className="m-card">
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            <Text strong style={{ fontSize: 15 }}>
              강사 정보
            </Text>
            <Form
              form={instructorForm}
              layout="vertical"
              initialValues={initialInstructor}
              onValuesChange={() => setInstructorDirty(true)}
            >
              <Form.Item
                name="displayName"
                label="표시 이름"
                rules={[{ required: true, message: "표시 이름을 입력하세요." }]}
              >
                <Input />
              </Form.Item>
              <Form.Item name="title" label="직함">
                <Input />
              </Form.Item>
              <Form.Item name="affiliation" label="소속">
                <Input />
              </Form.Item>
              <Form.Item name="specialties" label="전문분야 (쉼표 구분)">
                <Input />
              </Form.Item>
              <Form.Item name="bio" label="자기소개">
                <Input.TextArea rows={4} />
              </Form.Item>
              <Divider style={{ margin: "8px 0" }} />
              <Text strong style={{ fontSize: 14 }}>
                학위
              </Text>
              <Form.List name="degrees">
                {(fields, { add, remove }) => (
                  <Space direction="vertical" style={{ width: "100%" }} size={8}>
                    {fields.map((field, index) => {
                      const degree = instructorForm.getFieldValue(["degrees", field.name]) as
                        | { name?: string; school?: string; major?: string; year?: string }
                        | undefined;
                      const summary = [
                        degree?.name || "학위 미입력",
                        degree?.school || "학교 미입력",
                        degree?.year || "",
                      ]
                        .filter(Boolean)
                        .join(" / ");

                      return (
                        <Collapse
                          key={field.key}
                          className="m-card"
                          items={[
                            {
                              key: `degree-${field.key}`,
                              label: `${index + 1}. ${summary}`,
                              children: (
                                <Space direction="vertical" style={{ width: "100%" }} size={8}>
                                  <Form.Item
                                    name={[field.name, "name"]}
                                    label="학위"
                                    rules={[{ required: true, message: "학위를 입력하세요." }]}
                                  >
                                    <Input />
                                  </Form.Item>
                                  <Form.Item
                                    name={[field.name, "school"]}
                                    label="학교"
                                    rules={[{ required: true, message: "학교를 입력하세요." }]}
                                  >
                                    <Input />
                                  </Form.Item>
                                  <Form.Item name={[field.name, "major"]} label="전공">
                                    <Input />
                                  </Form.Item>
                                  <Form.Item name={[field.name, "year"]} label="연도">
                                    <Input placeholder="예: 2020" />
                                  </Form.Item>
                                  <Button
                                    danger
                                    icon={<MinusCircleOutlined />}
                                    onClick={() => remove(field.name)}
                                    block
                                  >
                                    학위 삭제
                                  </Button>
                                </Space>
                              ),
                            },
                          ]}
                        />
                      );
                    })}
                    <Button icon={<PlusOutlined />} onClick={() => add()} block>
                      학위 추가
                    </Button>
                  </Space>
                )}
              </Form.List>
              <Divider style={{ margin: "8px 0" }} />
              <Text strong style={{ fontSize: 14 }}>
                주요 경력
              </Text>
              <Form.List name="careers">
                {(fields, { add, remove }) => (
                  <Space direction="vertical" style={{ width: "100%" }} size={8}>
                    {fields.map((field, index) => {
                      const career = instructorForm.getFieldValue(["careers", field.name]) as
                        | { company?: string; role?: string; period?: string }
                        | undefined;
                      const summary = [
                        career?.company || "회사 미입력",
                        career?.role || "역할 미입력",
                        career?.period || "",
                      ]
                        .filter(Boolean)
                        .join(" / ");

                      return (
                        <Collapse
                          key={field.key}
                          className="m-card"
                          items={[
                            {
                              key: `career-${field.key}`,
                              label: `${index + 1}. ${summary}`,
                              children: (
                                <Space direction="vertical" style={{ width: "100%" }} size={8}>
                                  <Form.Item
                                    name={[field.name, "company"]}
                                    label="회사/기관"
                                    rules={[{ required: true, message: "회사/기관을 입력하세요." }]}
                                  >
                                    <Input />
                                  </Form.Item>
                                  <Form.Item
                                    name={[field.name, "role"]}
                                    label="역할"
                                    rules={[{ required: true, message: "역할을 입력하세요." }]}
                                  >
                                    <Input />
                                  </Form.Item>
                                  <Form.Item name={[field.name, "period"]} label="기간">
                                    <Input placeholder="예: 2021-2023" />
                                  </Form.Item>
                                  <Form.Item name={[field.name, "description"]} label="설명">
                                    <Input.TextArea rows={2} />
                                  </Form.Item>
                                  <Button
                                    danger
                                    icon={<MinusCircleOutlined />}
                                    onClick={() => remove(field.name)}
                                    block
                                  >
                                    경력 삭제
                                  </Button>
                                </Space>
                              ),
                            },
                          ]}
                        />
                      );
                    })}
                    <Button icon={<PlusOutlined />} onClick={() => add()} block>
                      경력 추가
                    </Button>
                  </Space>
                )}
              </Form.List>
              <Divider style={{ margin: "8px 0" }} />
              <Text strong style={{ fontSize: 14 }}>
                출판/논문
              </Text>
              <Form.List name="publications">
                {(fields, { add, remove }) => (
                  <Space direction="vertical" style={{ width: "100%" }} size={8}>
                    {fields.map((field, index) => {
                      const publication = instructorForm.getFieldValue(["publications", field.name]) as
                        | { title?: string; type?: string; year?: string }
                        | undefined;
                      const summary = [
                        publication?.type || "구분 미입력",
                        publication?.title || "제목 미입력",
                        publication?.year || "",
                      ]
                        .filter(Boolean)
                        .join(" / ");
                      return (
                        <Collapse
                          key={field.key}
                          className="m-card"
                          items={[
                            {
                              key: `publication-${field.key}`,
                              label: `${index + 1}. ${summary}`,
                              children: (
                                <Space direction="vertical" style={{ width: "100%" }} size={8}>
                                  <Form.Item
                                    name={[field.name, "title"]}
                                    label="제목"
                                    rules={[{ required: true, message: "제목을 입력하세요." }]}
                                  >
                                    <Input />
                                  </Form.Item>
                                  <Form.Item name={[field.name, "type"]} label="구분">
                                    <Input placeholder="예: paper" />
                                  </Form.Item>
                                  <Form.Item name={[field.name, "year"]} label="연도">
                                    <Input />
                                  </Form.Item>
                                  <Form.Item name={[field.name, "publisher"]} label="기관">
                                    <Input />
                                  </Form.Item>
                                  <Button
                                    danger
                                    icon={<MinusCircleOutlined />}
                                    onClick={() => remove(field.name)}
                                    block
                                  >
                                    출판/논문 삭제
                                  </Button>
                                </Space>
                              ),
                            },
                          ]}
                        />
                      );
                    })}
                    <Button icon={<PlusOutlined />} onClick={() => add()} block>
                      출판/논문 추가
                    </Button>
                  </Space>
                )}
              </Form.List>
              <Divider style={{ margin: "8px 0" }} />
              <Text strong style={{ fontSize: 14 }}>
                자격증
              </Text>
              <Form.List name="certifications">
                {(fields, { add, remove }) => (
                  <Space direction="vertical" style={{ width: "100%" }} size={8}>
                    {fields.map((field, index) => {
                      const certification = instructorForm.getFieldValue(["certifications", field.name]) as
                        | { name?: string; issuer?: string; date?: string }
                        | undefined;
                      const summary = [
                        certification?.name || "자격증 미입력",
                        certification?.issuer || "기관 미입력",
                        certification?.date || "",
                      ]
                        .filter(Boolean)
                        .join(" / ");
                      return (
                        <Collapse
                          key={field.key}
                          className="m-card"
                          items={[
                            {
                              key: `certification-${field.key}`,
                              label: `${index + 1}. ${summary}`,
                              children: (
                                <Space direction="vertical" style={{ width: "100%" }} size={8}>
                                  <Form.Item
                                    name={[field.name, "name"]}
                                    label="자격증명"
                                    rules={[{ required: true, message: "자격증명을 입력하세요." }]}
                                  >
                                    <Input />
                                  </Form.Item>
                                  <Form.Item name={[field.name, "issuer"]} label="발급기관">
                                    <Input />
                                  </Form.Item>
                                  <Form.Item name={[field.name, "date"]} label="취득일">
                                    <Input placeholder="예: 2023-07" />
                                  </Form.Item>
                                  <Button
                                    danger
                                    icon={<MinusCircleOutlined />}
                                    onClick={() => remove(field.name)}
                                    block
                                  >
                                    자격증 삭제
                                  </Button>
                                </Space>
                              ),
                            },
                          ]}
                        />
                      );
                    })}
                    <Button icon={<PlusOutlined />} onClick={() => add()} block>
                      자격증 추가
                    </Button>
                  </Space>
                )}
              </Form.List>
              <div
                style={{
                  width: "100%",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                  marginTop: 8,
                }}
              >
              <Button
                  icon={<FilePdfOutlined />}
                  onClick={() => {
                    runWithSaveCheck(async () => {
                      if (!accessToken) return;
                      const preferredTemplateId = getPreferredTemplateId(
                        user?.id,
                        "instructor_profile",
                      );
                      const resolvedTemplateId = preferredTemplateId || instructorTemplateId;
                      if (!resolvedTemplateId) {
                        message.warning("강사 PDF 템플릿이 없습니다. 웹에서 템플릿을 생성하세요.");
                        return;
                      }
                      setIssuingPdf(true);
                      try {
                        let resolvedProfileId = profileId;
                        if (!resolvedProfileId) {
                          const latest = (await api.getInstructorProfile(accessToken)) as {
                            id?: string;
                          } | null;
                          resolvedProfileId = latest?.id || null;
                          setProfileId(resolvedProfileId);
                        }
                        if (!resolvedProfileId) {
                          message.warning("강사 프로필이 없어 PDF를 생성할 수 없습니다.");
                          return;
                        }
                        await api.renderInstructorProfilePdf({
                          token: accessToken,
                          templateId: resolvedTemplateId,
                          profileId: resolvedProfileId,
                        });
                        const fileName = buildMobilePdfFileName(
                          `${instructorForm.getFieldValue("displayName") || initialBasic.name}_소개서`,
                        );
                        message.success(`${fileName} 생성 요청 완료`);
                      } finally {
                        setIssuingPdf(false);
                      }
                    });
                  }}
                  loading={issuingPdf || savingChanges || loadingData}
                  type="primary"
                  style={{ width: "100%" }}
                >
                  문서함에 PDF 저장
                </Button>
                <Button
                  icon={<SendOutlined />}
                  onClick={() =>
                    runWithSaveCheck(() => {
                      message.info("앱 전송은 문서 생성 후 내 문서함에서 진행하세요.");
                    })
                  }
                  loading={savingChanges || loadingData}
                  style={{ width: "100%" }}
                >
                  앱 전송
                </Button>
              </div>
            </Form>
          </Space>
        </Card>
      )}
    </Space>
  );
}
