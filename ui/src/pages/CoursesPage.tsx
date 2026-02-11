import {
    DeleteOutlined,
    EditOutlined,
    EyeOutlined,
    PlusOutlined,
    ReloadOutlined,
} from "@ant-design/icons";
import { useMutation } from "@tanstack/react-query";
import {
    Button,
    Checkbox,
    Divider,
    Form,
    Input,
    InputNumber,
    message,
    Modal,
    Popconfirm,
    Space,
    Select,
    Tag,
    Switch,
    Table,
    Alert,
} from "antd";
import type { ColumnType } from "antd/es/table";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, mcpClient } from "../api/mcpClient";
import { useAuth } from "../contexts/AuthContext";
import { useTableConfig } from "../hooks/useTableConfig";
import { buildColumns, NO_COLUMN_KEY } from "../utils/tableConfig";
import { DEFAULT_COLUMNS } from "../utils/tableDefaults";
import { useLocation, useNavigate } from "react-router-dom";

interface Lecture {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  hours?: number;
  order?: number;
  createdBy?: string;
}

interface Course {
  id: string;
  title: string;
  description?: string;
  durationHours?: number;
  isOnline?: boolean;
  equipment?: string[];
  goal?: string;
  notes?: string;
  createdBy?: string;
  Lectures?: Lecture[];
  Instructors?: Instructor[];
  instructorIds?: string[];
  canEdit?: boolean;
}

interface Instructor {
  id: string;
  name: string;
}

interface CourseShareInboxItem {
  id: string;
  courseId: string;
  status: "pending" | "accepted" | "rejected";
  Course?: {
    id: string;
    title: string;
    description?: string;
  };
  SharedBy?: {
    id: string;
    name: string;
    email: string;
  };
}

interface ShareTargetUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface CourseTemplateOption {
  id: string;
  name: string;
  html: string;
  css: string;
}

export default function CoursesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [viewCourse, setViewCourse] = useState<Course | null>(null);
  const [form] = Form.useForm();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const { accessToken, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const { configs: columnConfigs } = useTableConfig(
    "courses",
    DEFAULT_COLUMNS.courses,
  );

  // Lecture state
  const [lectureModalOpen, setLectureModalOpen] = useState(false);
  const [editingLecture, setEditingLecture] = useState<Lecture | null>(null);
  const [lectureForm] = Form.useForm();
  const [instructorPickerOpen, setInstructorPickerOpen] = useState(false);
  const [instructorSearch, setInstructorSearch] = useState("");
  const [selectedInstructorRowKeys, setSelectedInstructorRowKeys] = useState<
    string[]
  >([]);
  const [shareInbox, setShareInbox] = useState<CourseShareInboxItem[]>([]);
  const [shareRespondLoading, setShareRespondLoading] = useState<string | null>(
    null,
  );
  const [shareTargets, setShareTargets] = useState<ShareTargetUser[]>([]);
  const [selectedShareUserIds, setSelectedShareUserIds] = useState<string[]>([]);
  const [originalShareUserIds, setOriginalShareUserIds] = useState<string[]>([]);
  const [courseExportTemplates, setCourseExportTemplates] = useState<CourseTemplateOption[]>([]);
  const [selectedCourseTemplateId, setSelectedCourseTemplateId] = useState<string>();
  const [courseExportLabel, setCourseExportLabel] = useState("");
  const [coursePreviewLoading, setCoursePreviewLoading] = useState(false);
  const [courseExportLoading, setCourseExportLoading] = useState(false);
  const draftPromptOpenRef = useRef(false);

  const draftKey = useMemo(() => "draft:course", []);

  const saveDraft = (values?: Record<string, unknown>) => {
    const raw = values || form.getFieldsValue();
    const payload = {
      ...raw,
      id: editingCourse?.id || (raw.id as string) || undefined,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(draftKey, JSON.stringify(payload));
  };

  const loadDraft = () => {
    const stored = localStorage.getItem(draftKey);
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  };

  const clearDraft = () => {
    localStorage.removeItem(draftKey);
  };

  const isAuthError = (messageText: string) =>
    /인증|토큰|로그인|권한|세션|MCP 연결 시간이 초과되었습니다|요청 시간이 초과되었습니다/.test(
      messageText,
    );

  const handleSessionExpired = (reason?: string) => {
    saveDraft();
    Modal.confirm({
      title: "세션이 만료되었습니다",
      content: reason
        ? `작성 중인 내용을 임시 저장했습니다. (${reason})`
        : "작성 중인 내용을 임시 저장했습니다. 다시 로그인해주세요.",
      okText: "로그인으로 이동",
      cancelButtonProps: { style: { display: "none" } },
      onOk: () => {
        logout();
        navigate("/login");
      },
    });
  };

  const loadCourses = async () => {
    try {
      setLoading(true);
      const result = (await api.courseList(50, 0, accessToken || undefined)) as {
        courses: Course[];
        total: number;
      };
      setCourses(result.courses);
    } catch (error) {
      console.error("Failed to load courses:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadInstructors = async () => {
    try {
      const result = (await api.instructorList()) as {
        instructors: Instructor[];
        total: number;
      };
      setInstructors(result.instructors);
    } catch (error) {
      console.error("Failed to load instructors:", error);
    }
  };

  const loadShareInbox = async () => {
    if (!accessToken) return;
    try {
      const result = (await api.courseShareListReceived({
        token: accessToken,
        status: "pending",
      })) as { shares: CourseShareInboxItem[] };
      setShareInbox(result.shares || []);
    } catch (error) {
      console.error("Failed to load course share inbox:", error);
    }
  };

  const loadShareTargets = async () => {
    if (!accessToken) return;
    try {
      const result = (await api.courseShareTargets({
        token: accessToken,
        limit: 100,
      })) as { targets: ShareTargetUser[] };
      setShareTargets(result.targets || []);
    } catch (error) {
      console.error("Failed to load share targets:", error);
    }
  };

  const loadCourseExportTemplates = async () => {
    if (!accessToken) return;
    try {
      const result = (await api.templateList(1, 100, "course_intro")) as {
        items: CourseTemplateOption[];
      };
      setCourseExportTemplates(result.items || []);
      if (!selectedCourseTemplateId && (result.items || []).length > 0) {
        setSelectedCourseTemplateId(result.items[0].id);
      }
    } catch (error) {
      console.error("Failed to load course export templates:", error);
    }
  };

  useEffect(() => {
    mcpClient.onConnect(() => {
      loadCourses();
      loadInstructors();
      loadShareInbox();
      loadShareTargets();
    });
  }, []);

  useEffect(() => {
    if (!viewCourse || !accessToken) return;
    loadCourseExportTemplates();
  }, [viewCourse?.id, accessToken]);

  const handleRespondShare = async (courseId: string, accept: boolean) => {
    if (!accessToken) return;
    setShareRespondLoading(`${courseId}:${accept ? "accept" : "reject"}`);
    try {
      await api.courseShareRespond({ token: accessToken, courseId, accept });
      message.success(
        accept ? "코스 공유를 수락했습니다." : "코스 공유를 거절했습니다.",
      );
      await Promise.all([loadShareInbox(), loadCourses()]);
    } catch (error) {
      message.error(`공유 응답 실패: ${(error as Error).message}`);
    } finally {
      setShareRespondLoading(null);
    }
  };

  const buildCoursePreviewData = (course: Course) => ({
    course,
    instructors: course.Instructors || [],
    lectures: course.Lectures || [],
    modules: course.Lectures || [],
    schedules: (course as any).Schedules || [],
    courseLectures: course.Lectures || [],
    courseSchedules: (course as any).Schedules || [],
  });

  const handlePreviewCourseExport = async () => {
    if (!viewCourse) return;
    if (!selectedCourseTemplateId) {
      message.warning("템플릿을 선택하세요.");
      return;
    }
    const tpl = courseExportTemplates.find((t) => t.id === selectedCourseTemplateId);
    if (!tpl) {
      message.warning("선택한 템플릿을 찾을 수 없습니다.");
      return;
    }
    setCoursePreviewLoading(true);
    try {
      const result = await api.templatePreviewHtml(
        tpl.html,
        tpl.css,
        buildCoursePreviewData(viewCourse),
      );
      const html =
        typeof result === "string"
          ? result
          : ((result as Record<string, unknown>).html as string) ||
            ((result as Record<string, unknown>).text as string) ||
            "";
      const win = window.open("", "_blank", "width=900,height=1200");
      if (win) {
        win.document.open();
        win.document.write(html);
        win.document.close();
      }
    } catch (error) {
      message.error(`미리보기 실패: ${(error as Error).message}`);
    } finally {
      setCoursePreviewLoading(false);
    }
  };

  const handleExportCoursePdf = async () => {
    if (!viewCourse || !accessToken) return;
    if (!selectedCourseTemplateId) {
      message.warning("템플릿을 선택하세요.");
      return;
    }
    setCourseExportLoading(true);
    try {
      await api.renderCoursePdf({
        token: accessToken,
        templateId: selectedCourseTemplateId,
        courseId: viewCourse.id,
        label: courseExportLabel || undefined,
      });
      message.success("코스 내보내기 작업이 등록되었습니다. 내 문서함에서 확인하세요.");
      setCourseExportLabel("");
    } catch (error) {
      message.error(`내보내기 실패: ${(error as Error).message}`);
    } finally {
      setCourseExportLoading(false);
    }
  };

  useEffect(() => {
    const handler = () => {
      saveDraft();
    };
    window.addEventListener("sessionExpired", handler);
    return () => {
      window.removeEventListener("sessionExpired", handler);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const draftParam = params.get("draft");
    if (!draftParam) return;
    const draft = loadDraft();
    if (!draft) return;
    form.setFieldsValue(draft);
    setEditingCourse(draft.id ? ({ id: draft.id } as Course) : null);
    setIsModalOpen(true);
  }, [location.search]);

  const createMutation = useMutation({
    mutationFn: (data: Omit<Course, "id"> & { id?: string }) =>
      api.courseUpsert({ ...data, token: accessToken || undefined }),
    onSuccess: () => {
      message.success("코스가 정상적으로 저장되었습니다.");
      setIsModalOpen(false);
      form.resetFields();
      setEditingCourse(null);
      clearDraft();
      loadCourses();
      loadShareInbox();
    },
    onError: (error: Error) => {
      if (isAuthError(error.message)) {
        handleSessionExpired(error.message);
        return;
      }
      message.error(`저장 실패: ${error.message}`);
    },
  });

  const fetchCourseMutation = useMutation({
    mutationFn: (id: string) => api.courseGet(id, accessToken || undefined),
    onSuccess: (result: unknown) => {
      const course = result as Course;
      setViewCourse(course);
      setCourses((prev) => {
        const exists = prev.find((c) => c.id === course.id);
        if (exists) {
          return prev.map((c) => (c.id === course.id ? course : c));
        }
        return [...prev, course];
      });
    },
    onError: (error: Error) => {
      if (isAuthError(error.message)) {
        handleSessionExpired(error.message);
        return;
      }
      message.error(`조회 실패: ${error.message}`);
    },
  });

  // Lecture mutations
  const lectureMutation = useMutation({
    mutationFn: (data: {
      id?: string;
      courseId: string;
      title: string;
      description?: string;
      hours?: number;
      order?: number;
    }) => api.lectureUpsert({ ...data, token: accessToken || undefined }),
    onSuccess: () => {
      message.success("강의가 저장되었습니다.");
      setLectureModalOpen(false);
      lectureForm.resetFields();
      setEditingLecture(null);
      if (viewCourse) fetchCourseMutation.mutate(viewCourse.id);
    },
    onError: (error: Error) => {
      message.error(`강의 저장 실패: ${error.message}`);
    },
  });

  const lectureDeleteMutation = useMutation({
    mutationFn: (id: string) => api.lectureDelete(id, accessToken || undefined),
    onSuccess: () => {
      message.success("강의가 삭제되었습니다.");
      if (viewCourse) fetchCourseMutation.mutate(viewCourse.id);
    },
    onError: (error: Error) => {
      message.error(`강의 삭제 실패: ${error.message}`);
    },
  });

  const handleCreate = () => {
    if (!accessToken) {
      message.warning("로그인 후 이용해주세요.");
      return;
    }
    const draft = loadDraft();
    if (draft) {
      if (draftPromptOpenRef.current) return;
      draftPromptOpenRef.current = true;
      Modal.confirm({
        title: "임시 저장된 정보가 있습니다",
        content: "이어서 작성하시겠습니까?",
        okText: "이어서 작성",
        cancelText: "아니오",
        maskClosable: false,
        closable: false,
        onOk: () => {
          form.setFieldsValue(draft);
          setEditingCourse(draft.id ? ({ id: draft.id } as Course) : null);
          setIsModalOpen(true);
          draftPromptOpenRef.current = false;
        },
        onCancel: () => {
          Modal.confirm({
            title: "이전 작업 초기화",
            content: "이전 임시 저장 작업을 삭제하고 새로 시작합니다.",
            okText: "확인",
            cancelButtonProps: { style: { display: "none" } },
            maskClosable: false,
            closable: false,
            onOk: () => {
              clearDraft();
              setEditingCourse(null);
              form.resetFields();
              setIsModalOpen(true);
              draftPromptOpenRef.current = false;
            },
          });
        },
      });
      return;
    }
    setEditingCourse(null);
    form.resetFields();
    setSelectedShareUserIds([]);
    setOriginalShareUserIds([]);
    setIsModalOpen(true);
  };

  const handleEdit = (course: Course) => {
    if (course.canEdit === false) {
      message.warning("본인 코스만 수정할 수 있습니다.");
      return;
    }
    if (!accessToken) {
      message.warning("로그인 후 이용해주세요.");
      return;
    }
    api
      .courseGet(course.id, accessToken || undefined)
      .then((result) => {
        const fullCourse = result as Course;
        setEditingCourse(fullCourse);
        form.setFieldsValue({
          ...fullCourse,
          instructorIds: fullCourse.instructorIds || [],
        });
        if (accessToken) {
          api
            .courseShareListForCourse({ token: accessToken, courseId: fullCourse.id })
            .then((shareResult) => {
              const shares = (shareResult as {
                shares: Array<{ sharedWithUserId: string; status: string }>;
              }).shares || [];
              const active = shares
                .filter((s) => s.status === "pending" || s.status === "accepted")
                .map((s) => s.sharedWithUserId);
              setSelectedShareUserIds(active);
              setOriginalShareUserIds(active);
            })
            .catch(() => {
              setSelectedShareUserIds([]);
              setOriginalShareUserIds([]);
            });
        } else {
          setSelectedShareUserIds([]);
          setOriginalShareUserIds([]);
        }
        setIsModalOpen(true);
      })
      .catch((error: Error) => {
        message.error(`조회 실패: ${error.message}`);
      });
  };

  const handleAddInstructor = (instructorId: string) => {
    const current = (form.getFieldValue("instructorIds") as string[]) || [];
    if (!current.includes(instructorId)) {
      form.setFieldsValue({ instructorIds: [...current, instructorId] });
    }
  };

  const handleRemoveInstructor = (instructorId: string) => {
    const current = (form.getFieldValue("instructorIds") as string[]) || [];
    form.setFieldsValue({
      instructorIds: current.filter((id) => id !== instructorId),
    });
  };

  const selectedInstructorIds =
    (form.getFieldValue("instructorIds") as string[]) || [];

  const selectedInstructors = instructors.filter((i) =>
    selectedInstructorIds.includes(i.id),
  );

  const filteredInstructors = instructors.filter((i) => {
    const q = instructorSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q)
    );
  });

  // Lecture handlers
  const handleAddLecture = () => {
    if (viewCourse?.canEdit === false) {
      message.warning("본인 코스만 수정할 수 있습니다.");
      return;
    }
    if (!accessToken) {
      message.warning("로그인 후 이용해주세요.");
      return;
    }
    setEditingLecture(null);
    lectureForm.resetFields();
    lectureForm.setFieldsValue({
      order: (viewCourse?.Lectures?.length || 0) + 1,
    });
    setLectureModalOpen(true);
  };

  const handleEditLecture = (lecture: Lecture) => {
    if (viewCourse?.canEdit === false) {
      message.warning("본인 코스만 수정할 수 있습니다.");
      return;
    }
    if (!accessToken) {
      message.warning("로그인 후 이용해주세요.");
      return;
    }
    setEditingLecture(lecture);
    lectureForm.setFieldsValue(lecture);
    setLectureModalOpen(true);
  };

  const handleLectureSubmit = async () => {
    try {
      const values = await lectureForm.validateFields();
      lectureMutation.mutate({
        ...values,
        id: editingLecture?.id,
        courseId: viewCourse!.id,
        hours: values.hours ? Number(values.hours) : undefined,
        order: values.order ? Number(values.order) : undefined,
      });
    } catch (error) {
      // Validation failed
    }
  };

  const columnMap: Record<string, ColumnType<Course>> = {
    [NO_COLUMN_KEY]: {
      title: "No",
      key: NO_COLUMN_KEY,
      width: 60,
      render: (_: unknown, __: Course, index: number) => index + 1,
    },
    id: { title: "ID", dataIndex: "id", key: "id", width: 200, ellipsis: true },
    title: { title: "코스명", dataIndex: "title", key: "title" },
    description: { title: "설명", dataIndex: "description", key: "description", ellipsis: true },
    durationHours: {
      title: "시간",
      dataIndex: "durationHours",
      key: "durationHours",
      width: 80,
      render: (hours: number) => (hours ? `${hours}시간` : "-"),
    },
    isOnline: {
      title: "온라인",
      dataIndex: "isOnline",
      key: "isOnline",
      width: 80,
      render: (isOnline: boolean) => (isOnline ? "예" : "아니오"),
    },
    goal: { title: "목표", dataIndex: "goal", key: "goal", ellipsis: true },
    notes: { title: "비고", dataIndex: "notes", key: "notes", ellipsis: true },
    createdBy: {
      title: "등록자",
      dataIndex: "createdBy",
      key: "createdBy",
      width: 100,
      render: (createdBy: string) => createdBy || "-",
    },
    createdAt: {
      title: "등록일",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 160,
      render: (date: string) => (date ? new Date(date).toLocaleString("ko-KR") : "-"),
    },
    updatedAt: {
      title: "수정일",
      dataIndex: "updatedAt",
      key: "updatedAt",
      width: 160,
      render: (date: string) => (date ? new Date(date).toLocaleString("ko-KR") : "-"),
    },
    actions: {
      title: "액션",
      key: "action",
      width: 150,
      render: (_: unknown, record: Course) => (
        <Space>
          <Button
            icon={<EyeOutlined />}
            size="small"
            onClick={() => fetchCourseMutation.mutate(record.id)}
          />
          <Button
            icon={<EditOutlined />}
            size="small"
            disabled={record.canEdit === false}
            onClick={() => handleEdit(record)}
          />
        </Space>
      ),
    },
  };
  const columns = buildColumns<Course>(columnConfigs, columnMap);

  const lectureColumns = [
    {
      title: "순서",
      dataIndex: "order",
      key: "order",
      width: 60,
    },
    {
      title: "강의명",
      dataIndex: "title",
      key: "title",
    },
    {
      title: "설명",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
    },
    {
      title: "시간",
      dataIndex: "hours",
      key: "hours",
      width: 80,
      render: (hours: number) => (hours ? `${hours}h` : "-"),
    },
    {
      title: "등록자",
      dataIndex: "createdBy",
      key: "createdBy",
      width: 100,
      render: (createdBy: string) => createdBy || "-",
    },
    {
      title: "액션",
      key: "action",
      width: 100,
      render: (_: unknown, record: Lecture) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            size="small"
            disabled={viewCourse?.canEdit === false}
            onClick={() => handleEditLecture(record)}
          />
          <Popconfirm
            title="이 강의를 삭제하시겠습니까?"
            onConfirm={() => lectureDeleteMutation.mutate(record.id)}
            okText="삭제"
            cancelText="취소"
            disabled={viewCourse?.canEdit === false}
          >
            <Button
              icon={<DeleteOutlined />}
              size="small"
              danger
              disabled={viewCourse?.canEdit === false}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {shareInbox.length > 0 && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={`수락 대기 중인 코스 공유 요청 ${shareInbox.length}건`}
          description={
            <Space direction="vertical" size={8} style={{ width: "100%" }}>
              {shareInbox.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div>
                    <strong>{item.Course?.title || item.courseId}</strong>
                    <div style={{ color: "#666", fontSize: 12 }}>
                      요청자: {item.SharedBy?.name || "-"} (
                      {item.SharedBy?.email || "-"})
                    </div>
                  </div>
                  <Space>
                    <Button
                      size="small"
                      type="primary"
                      loading={shareRespondLoading === `${item.courseId}:accept`}
                      onClick={() => handleRespondShare(item.courseId, true)}
                    >
                      수락
                    </Button>
                    <Button
                      size="small"
                      danger
                      loading={shareRespondLoading === `${item.courseId}:reject`}
                      onClick={() => handleRespondShare(item.courseId, false)}
                    >
                      거절
                    </Button>
                  </Space>
                </div>
              ))}
            </Space>
          }
        />
      )}
      <div
        style={{
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <h2 style={{ margin: 0 }}>코스 관리</h2>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={loadCourses}
            loading={loading}
          >
            새로고침
          </Button>
          <Input.Search
            placeholder="코스 ID로 조회"
            onSearch={(id) => id && fetchCourseMutation.mutate(id)}
            style={{ width: 250 }}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            새 코스
          </Button>
        </Space>
      </div>

      <Alert
        type="info"
        showIcon
        message="코스 목록과 기본 정보를 관리합니다."
        description="리스트 컬럼은 사이트 관리의 목차 설정에 따라 표시/순서가 변경됩니다."
        style={{ marginBottom: 16 }}
      />

      <Table
        columns={columns}
        dataSource={courses}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      {/* Create/Edit Modal */}
      <Modal
        title={editingCourse ? "코스 수정" : "새 코스 생성"}
        open={isModalOpen}
        onOk={async () => {
          try {
            const values = await form.validateFields();
            const result = (await api.courseUpsert({
              ...values,
              id: editingCourse?.id || values.id,
              durationHours:
                values.durationHours !== null && values.durationHours !== undefined
                  ? Number(values.durationHours)
                  : undefined,
              isOnline: values.isOnline === true,
              instructorIds: values.instructorIds || [],
              token: accessToken || undefined,
            })) as { id: string };

            if (accessToken && result?.id) {
              const selectedSet = new Set(selectedShareUserIds);
              const originalSet = new Set(originalShareUserIds);
              const toInvite = [...selectedSet].filter((id) => !originalSet.has(id));
              const toRevoke = [...originalSet].filter((id) => !selectedSet.has(id));
              await Promise.all([
                ...toInvite.map((targetUserId) =>
                  api.courseShareInvite({ token: accessToken, courseId: result.id, targetUserId }),
                ),
                ...toRevoke.map((targetUserId) =>
                  api.courseShareRevoke({ token: accessToken, courseId: result.id, targetUserId }),
                ),
              ]);
            }

            message.success("코스가 정상적으로 저장되었습니다.");
            setIsModalOpen(false);
            form.resetFields();
            setEditingCourse(null);
            setSelectedShareUserIds([]);
            setOriginalShareUserIds([]);
            clearDraft();
            await Promise.all([loadCourses(), loadShareInbox()]);
          } catch (error) {
            if (error instanceof Error && isAuthError(error.message)) {
              handleSessionExpired(error.message);
              return;
            }
            if (error instanceof Error) {
              message.error(`저장 실패: ${error.message}`);
            }
          }
        }}
        onCancel={() => setIsModalOpen(false)}
        confirmLoading={createMutation.isPending}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onValuesChange={(_, allValues) => {
            if (!isModalOpen) return;
            saveDraft(allValues);
          }}
        >
          <Form.Item name="id" hidden>
            <Input />
          </Form.Item>
          <Form.Item
            name="title"
            label="코스명"
            rules={[{ required: true, message: "코스명을 입력하세요" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="description" label="설명">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="durationHours" label="교육 시간">
            <InputNumber min={1} addonAfter="시간" />
          </Form.Item>
          <Form.Item
            name="isOnline"
            label="온라인 여부"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Form.Item name="goal" label="교육 목표">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="notes" label="비고">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label="강사">
            <Space style={{ width: "100%", justifyContent: "space-between" }}>
              <div style={{ flex: 1 }}>
                {selectedInstructors.length > 0 ? (
                  selectedInstructors.map((inst) => (
                    <Tag
                      key={inst.id}
                      closable
                      onClose={() => handleRemoveInstructor(inst.id)}
                    >
                      {inst.name}
                    </Tag>
                  ))
                ) : (
                  <span>-</span>
                )}
              </div>
              <Button onClick={() => setInstructorPickerOpen(true)}>
                강사 추가
              </Button>
            </Space>
          </Form.Item>
          <Form.Item name="instructorIds" hidden>
            <Select
              mode="multiple"
              options={instructors.map((i) => ({
                value: i.id,
                label: i.name,
              }))}
            />
          </Form.Item>
          <Divider />
          <Form.Item label="코스 공유 (체크한 사용자에게 공유 요청)">
            <Checkbox.Group
              value={selectedShareUserIds}
              onChange={(vals) => setSelectedShareUserIds(vals as string[])}
              style={{ width: "100%" }}
            >
              <Space direction="vertical" style={{ width: "100%" }}>
                {shareTargets.length === 0 ? (
                  <span style={{ color: "#999" }}>공유 가능한 사용자가 없습니다.</span>
                ) : (
                  shareTargets.map((t) => (
                    <Checkbox key={t.id} value={t.id}>
                      {t.name} ({t.email}) - {t.role}
                    </Checkbox>
                  ))
                )}
              </Space>
            </Checkbox.Group>
          </Form.Item>
        </Form>
      </Modal>

      {/* View Modal with Lectures */}
      <Modal
        title="코스 상세"
        open={!!viewCourse}
        onCancel={() => {
          setViewCourse(null);
          setCourseExportLabel("");
        }}
        footer={[
          <Button key="close" onClick={() => setViewCourse(null)}>
            닫기
          </Button>,
          <Button
            key="edit"
            type="primary"
            disabled={viewCourse?.canEdit === false}
            onClick={() => {
              if (viewCourse) {
                handleEdit(viewCourse);
                setViewCourse(null);
              }
            }}
          >
            수정
          </Button>,
        ]}
        width={800}
      >
        {viewCourse && (
          <div>
            <p>
              <strong>ID:</strong> {viewCourse.id}
            </p>
            <p>
              <strong>코스명:</strong> {viewCourse.title}
            </p>
            <p>
              <strong>설명:</strong> {viewCourse.description || "-"}
            </p>
            <p>
              <strong>교육 시간:</strong>{" "}
              {viewCourse.durationHours
                ? `${viewCourse.durationHours}시간`
                : "-"}
            </p>
            <p>
              <strong>온라인:</strong> {viewCourse.isOnline ? "예" : "아니오"}
            </p>
            <p>
              <strong>교육 목표:</strong> {viewCourse.goal || "-"}
            </p>
            <p>
              <strong>비고:</strong> {viewCourse.notes || "-"}
            </p>
            <p>
              <strong>등록자:</strong> {viewCourse.createdBy || "-"}
            </p>
            <p>
              <strong>강사:</strong>{" "}
              {viewCourse.Instructors && viewCourse.Instructors.length > 0
                ? viewCourse.Instructors.map((i) => i.name).join(", ")
                : "-"}
            </p>

            <Divider />

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <h3 style={{ margin: 0 }}>강의 목록</h3>
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                disabled={viewCourse?.canEdit === false}
                onClick={handleAddLecture}
              >
                강의 추가
              </Button>
            </div>

          <Table
              columns={lectureColumns}
              dataSource={viewCourse.Lectures || []}
              rowKey="id"
              size="small"
              pagination={false}
              locale={{ emptyText: "등록된 강의가 없습니다" }}
            />
            {viewCourse?.canEdit === false && (
              <Alert
                type="warning"
                showIcon
                style={{ marginTop: 12 }}
                message="본인 코스가 아니므로 수정할 수 없습니다."
              />
            )}

            <Divider />
            <h3 style={{ marginTop: 0 }}>PDF 내보내기</h3>
            <Space direction="vertical" style={{ width: "100%" }} size={12}>
              <div>
                <div style={{ marginBottom: 6, fontWeight: 500 }}>템플릿 선택</div>
                <Select
                  value={selectedCourseTemplateId}
                  onChange={setSelectedCourseTemplateId}
                  placeholder="코스 소개 템플릿을 선택하세요"
                  style={{ width: "100%" }}
                  options={courseExportTemplates.map((t) => ({
                    value: t.id,
                    label: t.name,
                  }))}
                />
              </div>
              <div>
                <div style={{ marginBottom: 6, fontWeight: 500 }}>문서 라벨 (선택)</div>
                <Input
                  value={courseExportLabel}
                  onChange={(e) => setCourseExportLabel(e.target.value)}
                  placeholder="예: 2026 상반기 리더십 코스 소개서"
                />
              </div>
              <Space>
                <Button loading={coursePreviewLoading} onClick={handlePreviewCourseExport}>
                  미리보기
                </Button>
                <Button type="primary" loading={courseExportLoading} onClick={handleExportCoursePdf}>
                  내보내기
                </Button>
              </Space>
            </Space>
          </div>
        )}
      </Modal>

      {/* Instructor Picker Modal */}
      <Modal
        title="강사 선택"
        open={instructorPickerOpen}
        onCancel={() => setInstructorPickerOpen(false)}
        footer={[
          <Button
            key="add"
            type="primary"
            onClick={() => {
              selectedInstructorRowKeys.forEach((id) => handleAddInstructor(id));
              setSelectedInstructorRowKeys([]);
              setInstructorPickerOpen(false);
            }}
            disabled={selectedInstructorRowKeys.length === 0}
          >
            선택 추가
          </Button>,
          <Button key="close" onClick={() => setInstructorPickerOpen(false)}>
            닫기
          </Button>,
        ]}
        width={700}
      >
        <Space style={{ marginBottom: 12, width: "100%" }}>
          <Input.Search
            placeholder="이름 또는 ID 검색"
            onSearch={(value) => setInstructorSearch(value)}
            allowClear
            style={{ width: 260 }}
          />
        </Space>
        <Table
          dataSource={filteredInstructors}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 8 }}
          rowSelection={{
            selectedRowKeys: selectedInstructorRowKeys,
            onChange: (keys) =>
              setSelectedInstructorRowKeys(keys as string[]),
          }}
          columns={[
            { title: "이름", dataIndex: "name", key: "name" },
            {
              title: "ID",
              dataIndex: "id",
              key: "id",
              width: 220,
              ellipsis: true,
            },
            {
              title: "액션",
              key: "action",
              width: 100,
              render: (_: unknown, record: Instructor) => (
                <Button
                  size="small"
                  onClick={() => handleAddInstructor(record.id)}
                >
                  추가
                </Button>
              ),
            },
          ]}
          locale={{ emptyText: "등록된 강사가 없습니다" }}
        />
      </Modal>

      {/* Lecture Create/Edit Modal */}
      <Modal
        title={editingLecture ? "강의 수정" : "새 강의 추가"}
        open={lectureModalOpen}
        onOk={handleLectureSubmit}
        onCancel={() => {
          setLectureModalOpen(false);
          setEditingLecture(null);
        }}
        confirmLoading={lectureMutation.isPending}
        width={500}
      >
        <Form form={lectureForm} layout="vertical">
          <Form.Item
            name="title"
            label="강의명"
            rules={[{ required: true, message: "강의명을 입력하세요" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="description" label="설명">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="hours" label="시간">
            <InputNumber min={0} step={0.5} addonAfter="시간" />
          </Form.Item>
          <Form.Item name="order" label="순서">
            <InputNumber min={0} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
