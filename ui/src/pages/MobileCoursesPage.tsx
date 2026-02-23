import { useEffect, useMemo, useState } from "react";
import { Button, Card, Collapse, Space, Tag, Typography, message } from "antd";
import { FilePdfOutlined, SendOutlined, CompassOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { api } from "../api/mcpClient";
import { useAuth } from "../contexts/AuthContext";
import { getPreferredTemplateId } from "../utils/templatePreference";
import MobilePageHint from "../components/MobilePageHint";

const { Text } = Typography;

type Lecture = {
  id: string;
  title: string;
  order?: number;
  hours?: number;
};

type Course = {
  id: string;
  title: string;
  description?: string;
  durationHours?: number;
  goal?: string;
  content?: string;
  updatedAt?: string;
  Lectures?: Lecture[];
};

type TemplateOption = { id: string; name: string };

export default function MobileCoursesPage() {
  const { accessToken, user } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [courseTemplateId, setCourseTemplateId] = useState<string>();

  useEffect(() => {
    if (!accessToken) {
      setCourses([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [courseResult, templateResult] = await Promise.all([
          api.courseListMine(accessToken, 50, 0) as Promise<{ courses?: Course[] }>,
          api.templateList(1, 20, "course_intro", accessToken) as Promise<{ items?: TemplateOption[] }>,
        ]);
        if (cancelled) return;
        setCourses(courseResult?.courses || []);
        const templates = templateResult?.items || [];
        if (!courseTemplateId && templates.length > 0) {
          setCourseTemplateId(templates[0].id);
        }
      } catch (error) {
        if (!cancelled) {
          message.error(`과정 목록 조회 실패: ${(error as Error).message}`);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken, courseTemplateId]);

  const sortedCourses = useMemo(
    () =>
      (courses || [])
        .slice()
        .sort(
          (a, b) =>
            new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime(),
        ),
    [courses],
  );

  const handleCreatePdf = async (courseId: string) => {
    if (!accessToken) return;
    const preferredTemplateId = getPreferredTemplateId(user?.id, "course");
    const resolvedTemplateId = preferredTemplateId || courseTemplateId;
    if (!resolvedTemplateId) {
      message.warning("코스 PDF 템플릿이 없습니다. 웹에서 템플릿을 생성하세요.");
      return;
    }
    setExportingId(courseId);
    try {
      await api.renderCoursePdf({
        token: accessToken,
        templateId: resolvedTemplateId,
        courseId,
      });
      message.success("PDF 생성 작업이 등록되었습니다. 내 문서함에서 확인하세요.");
      navigate("/m/documents");
    } catch (error) {
      message.error(`PDF 생성 실패: ${(error as Error).message}`);
    } finally {
      setExportingId(null);
    }
  };

  return (
    <Space direction="vertical" size={10} style={{ width: "100%" }}>
      <MobilePageHint
        icon={<CompassOutlined />}
        title="과정은 모바일에서 조회·PDF·전송 중심"
        description="수정은 웹에서만 지원합니다."
      />
      {sortedCourses.map((course) => (
        <Card key={course.id} size="small" styles={{ body: { padding: 10 } }} className="m-card">
          <Collapse
            ghost
            items={[
              {
                key: course.id,
                label: (
                  <Space
                    style={{
                      width: "100%",
                      justifyContent: "space-between",
                    }}
                  >
                    <Space direction="vertical" size={1}>
                      <Text strong>{course.title}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {course.updatedAt
                          ? new Date(course.updatedAt).toLocaleString("ko-KR")
                          : "-"}{" "}
                        {course.durationHours ? `· ${course.durationHours}h` : ""}
                      </Text>
                    </Space>
                    <Tag color="blue">내 과정</Tag>
                  </Space>
                ),
                children: (
                  <Space direction="vertical" size={10} style={{ width: "100%", marginTop: 4 }}>
                    <div>
                      <Text type="secondary">설명</Text>
                      <div>
                        <Text>{course.description || "-"}</Text>
                      </div>
                    </div>
                    <div>
                      <Text type="secondary">총시간</Text>
                      <div>
                        <Text>{course.durationHours ? `${course.durationHours}시간` : "-"}</Text>
                      </div>
                    </div>
                    <div>
                      <Text type="secondary">학습 목표</Text>
                      <div>
                        <Text>{course.goal || "-"}</Text>
                      </div>
                    </div>
                    <div>
                      <Text type="secondary">학습 내용</Text>
                      <div>
                        <Text>{course.content || "-"}</Text>
                      </div>
                    </div>
                    <div>
                      <Text type="secondary">과정 ID</Text>
                      <div>
                        <Text code>{course.id}</Text>
                      </div>
                    </div>
                    <div>
                      <Text type="secondary">렉처 정보</Text>
                      <Space direction="vertical" size={6} style={{ width: "100%", marginTop: 4 }}>
                        {Array.isArray(course.Lectures) && course.Lectures.length > 0 ? (
                          course.Lectures.map((lecture) => (
                            <div
                              key={lecture.id}
                              style={{
                                border: "1px solid #f0f0f0",
                                borderRadius: 8,
                                padding: "8px 10px",
                                background: "#fff",
                              }}
                            >
                              <Space style={{ width: "100%", justifyContent: "space-between" }}>
                                <Text strong>
                                  {lecture.order ? `${lecture.order}. ` : ""}
                                  {lecture.title}
                                </Text>
                                <Tag>{lecture.hours ? `${lecture.hours}h` : "-"}</Tag>
                              </Space>
                            </div>
                          ))
                        ) : (
                          <Text type="secondary">등록된 렉처가 없습니다.</Text>
                        )}
                      </Space>
                    </div>
                    <div
                      style={{
                        width: "100%",
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 8,
                      }}
                    >
                      <Button
                        type="primary"
                        icon={<FilePdfOutlined />}
                        onClick={() => void handleCreatePdf(course.id)}
                        loading={exportingId === course.id}
                        style={{ width: "100%" }}
                      >
                        문서함에 PDF 저장
                      </Button>
                      <Button
                        icon={<SendOutlined />}
                        onClick={() =>
                          message.info("앱 전송은 문서 생성 후 내 문서함에서 이용할 수 있습니다.")
                        }
                        style={{ width: "100%" }}
                      >
                        앱 전송
                      </Button>
                    </div>
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      ))}
      {!loading && sortedCourses.length === 0 ? (
        <Card size="small" className="m-card">
          <Text type="secondary">조회 가능한 내 과정이 없습니다.</Text>
        </Card>
      ) : null}
    </Space>
  );
}
