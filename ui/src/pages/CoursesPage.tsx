import {
    DeleteOutlined,
    EditOutlined,
    EyeOutlined,
    PlusOutlined,
    ReloadOutlined,
    ShareAltOutlined,
    SettingOutlined,
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
    Tooltip,
    Result,
} from "antd";
import type { ColumnType } from "antd/es/table";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, mcpClient } from "../api/mcpClient";
import { useAuth } from "../contexts/AuthContext";
import { useSitePermissions } from "../hooks/useSitePermissions";
import { useTableConfig } from "../hooks/useTableConfig";
import { buildColumns, NO_COLUMN_KEY } from "../utils/tableConfig";
import { DEFAULT_COLUMNS } from "../utils/tableDefaults";
import { useLocation, useNavigate } from "react-router-dom";
import { withErrorReportId } from "../utils/errorReport";
import { isAuthErrorMessage } from "../utils/error";

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
  content?: string;
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
  const { accessToken, logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [canDeleteCourse, setCanDeleteCourse] = useState(false);
  const { configs: columnConfigs } = useTableConfig(
    "courses",
    DEFAULT_COLUMNS.courses,
  );

  // Lecture state
  const [lectureModalOpen, setLectureModalOpen] = useState(false);
  const [editingLecture, setEditingLecture] = useState<Lecture | null>(null);
  const [lectureForm] = Form.useForm();
  const [mapLectureId, setMapLectureId] = useState("");
  const [mapLectureOrder, setMapLectureOrder] = useState<number | undefined>();
  const [mapLectureLoading, setMapLectureLoading] = useState(false);
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
  const [lectureShareModalOpen, setLectureShareModalOpen] = useState(false);
  const [shareLecture, setShareLecture] = useState<Lecture | null>(null);
  const [selectedLectureShareUserIds, setSelectedLectureShareUserIds] = useState<string[]>([]);
  const [originalLectureShareUserIds, setOriginalLectureShareUserIds] = useState<string[]>([]);
  const [manualLectureShareUserIds, setManualLectureShareUserIds] = useState<string[]>([]);
  const [lectureShareSaveLoading, setLectureShareSaveLoading] = useState(false);
  const [courseLectureShareModalOpen, setCourseLectureShareModalOpen] = useState(false);
  const [selectedCourseLectureShareUserIds, setSelectedCourseLectureShareUserIds] = useState<string[]>([]);
  const [originalCourseLectureShareUserIds, setOriginalCourseLectureShareUserIds] = useState<string[]>([]);
  const [manualCourseLectureShareUserIds, setManualCourseLectureShareUserIds] = useState<string[]>([]);
  const [courseLectureShareSaveLoading, setCourseLectureShareSaveLoading] = useState(false);
  const [courseExportTemplates, setCourseExportTemplates] = useState<CourseTemplateOption[]>([]);
  const [selectedCourseTemplateId, setSelectedCourseTemplateId] = useState<string>();
  const [courseExportLabel, setCourseExportLabel] = useState("");
  const [coursePreviewLoading, setCoursePreviewLoading] = useState(false);
  const [courseExportLoading, setCourseExportLoading] = useState(false);
  const draftPromptOpenRef = useRef(false);
  const { canAccessMenu, canUseFeature } = useSitePermissions(user?.role);
  const isAdminOrOperator = user?.role === "admin" || user?.role === "operator";
  const canAccessCoursesMenu = canAccessMenu("courses");
  const canListCourseBySite = canUseFeature("courses", "course.list");
  const canListMineCourseBySite = canUseFeature("courses", "course.listMine");
  const canUpsertCourseBySite = canUseFeature("courses", "course.upsert");
  const canDeleteCourseBySite = canUseFeature("courses", "course.delete");
  const isMineOnlyView = !canListCourseBySite && canListMineCourseBySite;

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

  const isAuthError = (messageText: string) => isAuthErrorMessage(messageText);

  const withReport = (prefix: string, error: unknown) => {
    const detail = error instanceof Error ? error.message : "알 수 없는 오류";
    return withErrorReportId(`${prefix}: ${detail}`, error);
  };

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
    if (!accessToken) {
      setCourses([]);
      setLoading(false);
      return;
    }
    if (!canListCourseBySite && !canListMineCourseBySite) {
      setCourses([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const result = (await (isMineOnlyView
        ? api.courseListMine(accessToken, 50, 0)
        : api.courseList(50, 0, accessToken))) as {
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

  const loadCourseDeletePermission = async () => {
    if (!accessToken) {
      setCanDeleteCourse(false);
      return;
    }
    try {
      const result = (await api.authzCheck({
        token: accessToken,
        permissionKey: "course.delete",
      })) as { allowed?: boolean };
      setCanDeleteCourse(!!result?.allowed);
    } catch {
      setCanDeleteCourse(false);
    }
  };

  const loadInstructors = async () => {
    if (!accessToken) {
      setInstructors([]);
      return;
    }
    try {
      const result = (await api.instructorList(accessToken)) as {
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
      const result = (await api.templateList(1, 100, "course_intro", accessToken)) as {
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
      loadCourseDeletePermission();
    });
  }, []);

  useEffect(() => {
    loadCourses();
    loadInstructors();
    loadShareInbox();
    loadShareTargets();
    loadCourseDeletePermission();
  }, [accessToken, canListCourseBySite, canListMineCourseBySite]);

  useEffect(() => {
    loadCourseDeletePermission();
  }, [accessToken]);

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
      message.error(withReport("공유 응답 실패", error));
    } finally {
      setShareRespondLoading(null);
    }
  };

  const buildCoursePreviewData = (course: Course) => ({
    course,
    content: course.content || "",
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

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("create") !== "1") return;
    handleCreate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      message.error(withReport("저장 실패", error));
    },
  });

  const fetchCourseMutation = useMutation({
    mutationFn: (id: string) => {
      if (!accessToken) {
        throw new Error("인증이 필요합니다.");
      }
      return api.courseGet(id, accessToken);
    },
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
      message.error(withReport("강의 저장 실패", error));
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

  const courseDeleteMutation = useMutation({
    mutationFn: (id: string) => api.courseDelete({ id, token: accessToken || "" }),
    onSuccess: (_result, id) => {
      message.success("코스가 삭제되었습니다.");
      if (viewCourse?.id === id) {
        setViewCourse(null);
      }
      loadCourses();
      loadShareInbox();
    },
    onError: (error: Error) => {
      if (isAuthError(error.message)) {
        handleSessionExpired(error.message);
        return;
      }
      message.error(`코스 삭제 실패: ${error.message}`);
    },
  });

  const handleCreate = () => {
    if (!canUpsertCourseBySite) {
      message.warning("사이트 권한 설정에 따라 코스 등록/수정 기능이 비활성화되었습니다.");
      return;
    }
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
    if (!canUpsertCourseBySite) {
      message.warning("사이트 권한 설정에 따라 코스 등록/수정 기능이 비활성화되었습니다.");
      return;
    }
    if (course.canEdit === false) {
      message.warning("본인 코스만 수정할 수 있습니다.");
      return;
    }
    if (!accessToken) {
      message.warning("로그인 후 이용해주세요.");
      return;
    }
    api
      .courseGet(course.id, accessToken)
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

  const handleOpenLectureShareModal = async (lecture: Lecture) => {
    if (!accessToken) {
      message.warning("로그인 후 이용해주세요.");
      return;
    }
    setShareLecture(lecture);
    if (shareTargets.length === 0) {
      await loadShareTargets();
    }
    try {
      const result = (await api.lectureGrantList({
        lectureId: lecture.id,
        token: accessToken,
      })) as {
        grants: Array<{
          userId: string;
          canMap: boolean;
          canEdit: boolean;
          canReshare: boolean;
          revokedAt?: string | null;
        }>;
      };
      const grants = result.grants || [];
      const active = grants
        .filter((g) => !g.revokedAt && g.canMap)
        .map((g) => g.userId);
      setSelectedLectureShareUserIds(active);
      setOriginalLectureShareUserIds(active);
      setManualLectureShareUserIds(active);
    } catch (error) {
      message.error(`강의 공유 목록 조회 실패: ${(error as Error).message}`);
      setSelectedLectureShareUserIds([]);
      setOriginalLectureShareUserIds([]);
    }
    setLectureShareModalOpen(true);
  };

  const handleSaveLectureShares = async () => {
    if (!accessToken || !shareLecture) return;
    setLectureShareSaveLoading(true);
    try {
      const selectedSet = new Set(selectedLectureShareUserIds);
      const originalSet = new Set(originalLectureShareUserIds);
      const toInvite = [...selectedSet].filter((id) => !originalSet.has(id));
      const toRevoke = [...originalSet].filter((id) => !selectedSet.has(id));

      await Promise.all([
        ...toInvite.map((targetUserId) =>
          api.lectureGrantUpsert({
            token: accessToken,
            lectureId: shareLecture.id,
            userId: targetUserId,
            canMap: true,
            canEdit: false,
            canReshare: false,
          }),
        ),
        ...toRevoke.map((userId) =>
          api.lectureGrantDelete({
            token: accessToken,
            lectureId: shareLecture.id,
            userId,
          }),
        ),
      ]);

      message.success("강의 공유 설정이 저장되었습니다.");
      setLectureShareModalOpen(false);
      setShareLecture(null);
      await Promise.all([loadCourses(), loadShareInbox()]);
    } catch (error) {
      message.error(withReport("강의 공유 저장 실패", error));
    } finally {
      setLectureShareSaveLoading(false);
    }
  };

  const handleOpenCourseLectureShareModal = async () => {
    if (!viewCourse) return;
    if (viewCourse.canEdit === false) {
      message.warning("강의 공유 권한이 없습니다.");
      return;
    }
    if (!accessToken) {
      message.warning("로그인 후 이용해주세요.");
      return;
    }
    if ((viewCourse.Lectures || []).length === 0) {
      message.warning("공유할 강의가 없습니다.");
      return;
    }
    if (shareTargets.length === 0) {
      await loadShareTargets();
    }
    try {
      const lectureIds = (viewCourse.Lectures || []).map((l) => l.id);
      const grantResults = await Promise.all(
        lectureIds.map((lectureId) =>
          api.lectureGrantList({ lectureId, token: accessToken }) as Promise<{
            grants: Array<{ userId: string; canMap: boolean; revokedAt?: string | null }>;
          }>,
        ),
      );

      const counts = new Map<string, number>();
      for (const result of grantResults) {
        for (const grant of result.grants || []) {
          if (!grant.revokedAt && grant.canMap) {
            counts.set(grant.userId, (counts.get(grant.userId) || 0) + 1);
          }
        }
      }
      const fullySharedUserIds = [...counts.entries()]
        .filter(([, count]) => count === lectureIds.length)
        .map(([userId]) => userId);

      setSelectedCourseLectureShareUserIds(fullySharedUserIds);
      setOriginalCourseLectureShareUserIds(fullySharedUserIds);
      setManualCourseLectureShareUserIds(fullySharedUserIds);
    } catch (error) {
      message.error(`전체 공유 정보 조회 실패: ${(error as Error).message}`);
      setSelectedCourseLectureShareUserIds([]);
      setOriginalCourseLectureShareUserIds([]);
    }
    setCourseLectureShareModalOpen(true);
  };

  const handleSaveCourseLectureShares = async () => {
    if (!viewCourse || !accessToken) return;
    const lectures = viewCourse.Lectures || [];
    if (lectures.length === 0) return;

    setCourseLectureShareSaveLoading(true);
    try {
      const selectedSet = new Set(selectedCourseLectureShareUserIds);
      const originalSet = new Set(originalCourseLectureShareUserIds);
      const toInvite = [...selectedSet].filter((id) => !originalSet.has(id));
      const toRevoke = [...originalSet].filter((id) => !selectedSet.has(id));

      await Promise.all([
        ...toInvite.flatMap((userId) =>
          lectures.map((lecture) =>
            api.lectureGrantUpsert({
              token: accessToken,
              lectureId: lecture.id,
              userId,
              canMap: true,
              canEdit: false,
              canReshare: false,
            }),
          ),
        ),
        ...toRevoke.flatMap((userId) =>
          lectures.map((lecture) =>
            api.lectureGrantDelete({
              token: accessToken,
              lectureId: lecture.id,
              userId,
            }),
          ),
        ),
      ]);

      message.success("전체 강의 공유 설정이 저장되었습니다.");
      setCourseLectureShareModalOpen(false);
      await Promise.all([loadCourses(), loadShareInbox()]);
    } catch (error) {
      message.error(withReport("전체 강의 공유 저장 실패", error));
    } finally {
      setCourseLectureShareSaveLoading(false);
    }
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

  const selectedInstructorIds = isModalOpen
    ? ((form.getFieldValue("instructorIds") as string[]) || [])
    : [];

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

  const handleMapLecture = async () => {
    if (!viewCourse || !accessToken) return;
    const lectureId = mapLectureId.trim();
    if (!lectureId) {
      message.warning("매핑할 강의 ID를 입력하세요.");
      return;
    }
    setMapLectureLoading(true);
    try {
      await api.lectureMap({
        lectureId,
        courseId: viewCourse.id,
        order: mapLectureOrder,
        token: accessToken,
      });
      message.success("강의가 코스에 연결되었습니다.");
      setMapLectureId("");
      setMapLectureOrder(undefined);
      fetchCourseMutation.mutate(viewCourse.id);
    } catch (error) {
      message.error(`강의 매핑 실패: ${(error as Error).message}`);
    } finally {
      setMapLectureLoading(false);
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
    goal: { title: "교육 목표", dataIndex: "goal", key: "goal", ellipsis: true },
    content: { title: "교육 내용", dataIndex: "content", key: "content", ellipsis: true },
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
      width: 180,
      render: (_: unknown, record: Course) => {
        const canEditByOwnership = record.canEdit !== false;
        const canEditAction = canEditByOwnership && canUpsertCourseBySite;
        const canDeleteAction =
          !!accessToken &&
          canDeleteCourseBySite &&
          (canDeleteCourse || record.canEdit === true);
        const showEditDisabledHint = isAdminOrOperator && !canEditAction;
        const showDeleteDisabledHint = isAdminOrOperator && !canDeleteAction;

        return (
          <Space>
            <Tooltip title="보기">
              <Button
                icon={<EyeOutlined />}
                size="small"
                onClick={() => fetchCourseMutation.mutate(record.id)}
              />
            </Tooltip>

            {canEditAction ? (
              <Tooltip title="수정">
                <Button
                  icon={<EditOutlined />}
                  size="small"
                  onClick={() => handleEdit(record)}
                />
              </Tooltip>
            ) : showEditDisabledHint ? (
              <Tooltip
                title={
                  !canEditByOwnership
                    ? "본인 코스만 수정할 수 있습니다."
                    : "사이트 권한 설정에 따라 코스 등록/수정 기능이 비활성화되었습니다."
                }
              >
                <span>
                  <Button icon={<EditOutlined />} size="small" disabled />
                </span>
              </Tooltip>
            ) : null}

            {canDeleteAction ? (
              <Popconfirm
                title="이 코스를 삭제하시겠습니까?"
                description="삭제하면 코스와 연결된 강의/일정/공유 정보가 함께 삭제됩니다."
                okText="삭제"
                okButtonProps={{ danger: true }}
                cancelText="취소"
                onConfirm={() => {
                  if (!accessToken) {
                    message.warning("로그인 후 이용해주세요.");
                    return;
                  }
                  courseDeleteMutation.mutate(record.id);
                }}
              >
                <Tooltip title="삭제">
                  <Button
                    icon={<DeleteOutlined />}
                    size="small"
                    danger
                    loading={courseDeleteMutation.isPending}
                  />
                </Tooltip>
              </Popconfirm>
            ) : showDeleteDisabledHint ? (
              <Tooltip
                title={
                  !accessToken
                    ? "로그인 후 이용해주세요."
                    : !canDeleteCourseBySite
                      ? "사이트 권한 설정에 따라 코스 삭제 기능이 비활성화되었습니다."
                      : "삭제 권한이 없습니다. (관리자/운영자 또는 본인 코스)"
                }
              >
                <span>
                  <Button icon={<DeleteOutlined />} size="small" danger disabled />
                </span>
              </Tooltip>
            ) : null}
          </Space>
        );
      },
    },
  };
  const columns = buildColumns<Course>(columnConfigs, columnMap);

  if (!canAccessCoursesMenu) {
    return (
      <Result
        status="403"
        title="메뉴 비활성화"
        subTitle="사이트 관리의 권한관리에서 코스 관리 메뉴가 비활성화되었습니다."
      />
    );
  }

  if (!canListCourseBySite && !canListMineCourseBySite) {
    return (
      <Result
        status="403"
        title="조회 권한 없음"
        subTitle="사이트 관리의 권한관리에서 코스 조회 권한(course.list 또는 course.listMine)을 허용해주세요."
      />
    );
  }

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
      width: 140,
      render: (_: unknown, record: Lecture) => (
        <Space>
          <Button
            icon={<ShareAltOutlined />}
            size="small"
            disabled={!accessToken}
            onClick={() => handleOpenLectureShareModal(record)}
          />
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
          title={`수락 대기 중인 코스 공유 요청 ${shareInbox.length}건`}
          description={
            <Space orientation="vertical" size={8} style={{ width: "100%" }}>
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
          alignItems: "center",
        }}
      >
        <Space size={8} align="center">
          <h2 style={{ margin: 0 }}>코스 관리</h2>
          {user?.role === "admin" && (
            <Tooltip title="목차 설정으로 이동">
              <Button
                type="text"
                size="small"
                icon={<SettingOutlined />}
                onClick={() =>
                  navigate("/admin/site-settings?tab=outline&tableKey=courses")
                }
                style={{ padding: 4 }}
              />
            </Tooltip>
          )}
        </Space>
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
          {canUpsertCourseBySite ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              새 코스
            </Button>
          ) : isAdminOrOperator ? (
            <Tooltip title="사이트 권한 설정에 따라 코스 등록/수정 기능이 비활성화되었습니다.">
              <span>
                <Button type="primary" icon={<PlusOutlined />} disabled>
                  새 코스
                </Button>
              </span>
            </Tooltip>
          ) : null}
        </Space>
      </div>

      <Alert
        type="info"
        showIcon
        title={
          isMineOnlyView
            ? "내가 생성한 코스 목록만 조회 중입니다."
            : "코스 목록과 기본 정보를 관리합니다."
        }
        description={
          isMineOnlyView
            ? "사이트 권한 설정에 따라 course.list가 비활성화되어 course.listMine으로 조회합니다."
            : "리스트 컬럼은 사이트 관리의 목차 설정에 따라 표시/순서가 변경됩니다."
        }
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
            if (!canUpsertCourseBySite) {
              message.warning("사이트 권한 설정에 따라 코스 등록/수정 기능이 비활성화되었습니다.");
              return;
            }
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
              message.error(withReport("저장 실패", error));
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
          <Form.Item name="content" label="교육 내용">
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
              <Space orientation="vertical" style={{ width: "100%" }}>
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
          setMapLectureId("");
          setMapLectureOrder(undefined);
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
              <strong>교육 내용:</strong> {viewCourse.content || "-"}
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
              <h3 style={{ margin: 0 }}>코스 목차</h3>
              <Space>
                <Button
                  disabled={viewCourse?.canEdit === false}
                  onClick={handleOpenCourseLectureShareModal}
                >
                  선택 코스 공유 ON/OFF
                </Button>
                <Button
                  type="primary"
                  size="small"
                  icon={<PlusOutlined />}
                  disabled={viewCourse?.canEdit === false}
                  onClick={handleAddLecture}
                >
                  강의 추가
                </Button>
              </Space>
            </div>

            <Space style={{ marginBottom: 12 }} wrap>
              <Input
                placeholder="기존 강의 ID 입력"
                value={mapLectureId}
                onChange={(e) => setMapLectureId(e.target.value)}
                style={{ width: 260 }}
              />
              <InputNumber
                min={0}
                placeholder="순서(선택)"
                value={mapLectureOrder}
                onChange={(value) =>
                  setMapLectureOrder(
                    typeof value === "number" ? value : undefined,
                  )
                }
              />
              <Button
                onClick={handleMapLecture}
                loading={mapLectureLoading}
                disabled={!accessToken}
              >
                기존 강의 연결
              </Button>
            </Space>

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
                title="본인 코스가 아니므로 수정할 수 없습니다."
              />
            )}

            <Divider />
            <h3 style={{ marginTop: 0 }}>PDF 내보내기</h3>
            <Space orientation="vertical" style={{ width: "100%" }} size={12}>
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

      <Modal
        title={shareLecture ? `강의 공유 관리 - ${shareLecture.title}` : "강의 공유 관리"}
        open={lectureShareModalOpen}
        onCancel={() => {
          setLectureShareModalOpen(false);
          setShareLecture(null);
        }}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setLectureShareModalOpen(false);
              setShareLecture(null);
            }}
          >
            취소
          </Button>,
          <Button
            key="save"
            type="primary"
            loading={lectureShareSaveLoading}
            onClick={handleSaveLectureShares}
          >
            저장
          </Button>,
        ]}
      >
        <Form layout="vertical">
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            title="현재 선택한 강의 1건에만 적용됩니다."
          />
          <Form.Item label="전체공유 (대상 사용자 전체 선택/해제)">
            <Space>
              <Switch
                checked={
                  shareTargets.length > 0 &&
                  selectedLectureShareUserIds.length === shareTargets.length
                }
                onChange={(checked) => {
                  if (checked) {
                    setManualLectureShareUserIds(selectedLectureShareUserIds);
                    setSelectedLectureShareUserIds(shareTargets.map((t) => t.id));
                  } else {
                    setSelectedLectureShareUserIds(manualLectureShareUserIds);
                  }
                }}
                disabled={shareTargets.length === 0}
              />
              <span>{shareTargets.length === 0 ? "공유 대상 없음" : "ON/OFF"}</span>
            </Space>
          </Form.Item>
          <Form.Item label="공유 대상 사용자 (기본: 매핑 가능 / 수정 불가)">
            {shareTargets.length > 0 &&
            selectedLectureShareUserIds.length === shareTargets.length ? (
              <Alert
                type="info"
                showIcon
                title="전체공유 ON 상태입니다. 모든 대상자에게 공유됩니다."
              />
            ) : (
              <Checkbox.Group
                value={selectedLectureShareUserIds}
                onChange={(vals) => {
                  const next = vals as string[];
                  setSelectedLectureShareUserIds(next);
                  if (next.length < shareTargets.length) {
                    setManualLectureShareUserIds(next);
                  }
                }}
                style={{ width: "100%" }}
              >
                <Space orientation="vertical" style={{ width: "100%" }}>
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
            )}
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={viewCourse ? `선택 코스 전체 공유 - ${viewCourse.title}` : "선택 코스 전체 공유"}
        open={courseLectureShareModalOpen}
        onOk={handleSaveCourseLectureShares}
        onCancel={() => {
          setCourseLectureShareModalOpen(false);
        }}
        confirmLoading={courseLectureShareSaveLoading}
        okText="저장"
      >
        <Form layout="vertical">
          <Form.Item label="전체공유 (대상 사용자 전체 선택/해제)">
            <Space>
              <Switch
                checked={
                  shareTargets.length > 0 &&
                  selectedCourseLectureShareUserIds.length === shareTargets.length
                }
                onChange={(checked) => {
                  if (checked) {
                    setManualCourseLectureShareUserIds(selectedCourseLectureShareUserIds);
                    setSelectedCourseLectureShareUserIds(shareTargets.map((t) => t.id));
                  } else {
                    setSelectedCourseLectureShareUserIds(manualCourseLectureShareUserIds);
                  }
                }}
                disabled={shareTargets.length === 0}
              />
              <span>{shareTargets.length === 0 ? "공유 대상 없음" : "ON/OFF"}</span>
            </Space>
          </Form.Item>
          <Form.Item label="공유 대상 사용자 (선택 코스의 모든 강의에 일괄 적용)">
            {shareTargets.length > 0 &&
            selectedCourseLectureShareUserIds.length === shareTargets.length ? (
              <Alert
                type="info"
                showIcon
                title="전체공유 ON 상태입니다. 모든 대상자에게 공유됩니다."
              />
            ) : (
              <Checkbox.Group
                value={selectedCourseLectureShareUserIds}
                onChange={(vals) => {
                  const next = vals as string[];
                  setSelectedCourseLectureShareUserIds(next);
                  if (next.length < shareTargets.length) {
                    setManualCourseLectureShareUserIds(next);
                  }
                }}
                style={{ width: "100%" }}
              >
                <Space orientation="vertical" style={{ width: "100%" }}>
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
            )}
          </Form.Item>
        </Form>
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
