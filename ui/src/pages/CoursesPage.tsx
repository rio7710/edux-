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
import { useEffect, useMemo, useState } from "react";
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
}

interface Instructor {
  id: string;
  name: string;
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
      const result = (await api.courseList()) as {
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

  useEffect(() => {
    mcpClient.onConnect(() => {
      loadCourses();
      loadInstructors();
    });
  }, []);

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
    mutationFn: (id: string) => api.courseGet(id),
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
      Modal.confirm({
        title: "임시 저장된 내용이 있습니다",
        content: "불러와서 이어서 작성할까요?",
        okText: "불러오기",
        cancelText: "삭제",
        onOk: () => {
          form.setFieldsValue(draft);
          setEditingCourse(draft.id ? ({ id: draft.id } as Course) : null);
          setIsModalOpen(true);
        },
        onCancel: () => {
          clearDraft();
          setEditingCourse(null);
          form.resetFields();
          setIsModalOpen(true);
        },
      });
      return;
    }
    setEditingCourse(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleEdit = (course: Course) => {
    if (!accessToken) {
      message.warning("로그인 후 이용해주세요.");
      return;
    }
    api
      .courseGet(course.id)
      .then((result) => {
        const fullCourse = result as Course;
        setEditingCourse(fullCourse);
        form.setFieldsValue({
          id: fullCourse.id,
          ...fullCourse,
          instructorIds: fullCourse.instructorIds || [],
        });
        setIsModalOpen(true);
      })
      .catch((error: Error) => {
        message.error(`조회 실패: ${error.message}`);
      });
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      createMutation.mutate({
        ...values,
        id: editingCourse?.id || values.id,
        durationHours:
          values.durationHours !== null && values.durationHours !== undefined
            ? Number(values.durationHours)
            : undefined,
        isOnline: values.isOnline === true,
        instructorIds: values.instructorIds || [],
      });
    } catch (error) {
      // Validation failed
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
            onClick={() => handleEditLecture(record)}
          />
          <Popconfirm
            title="이 강의를 삭제하시겠습니까?"
            onConfirm={() => lectureDeleteMutation.mutate(record.id)}
            okText="삭제"
            cancelText="취소"
          >
            <Button icon={<DeleteOutlined />} size="small" danger />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
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
        onOk={handleSubmit}
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
        </Form>
      </Modal>

      {/* View Modal with Lectures */}
      <Modal
        title="코스 상세"
        open={!!viewCourse}
        onCancel={() => setViewCourse(null)}
        footer={[
          <Button key="close" onClick={() => setViewCourse(null)}>
            닫기
          </Button>,
          <Button
            key="edit"
            type="primary"
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
