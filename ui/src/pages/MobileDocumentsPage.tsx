import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Collapse, Modal, Space, Tag, Typography, message } from "antd";
import { DownloadOutlined, EyeOutlined, SendOutlined, ShareAltOutlined, FolderOpenOutlined } from "@ant-design/icons";
import { api } from "../api/mcpClient";
import { useAuth } from "../contexts/AuthContext";
import { buildMobilePdfFileName } from "../utils/mobileFilename";
import MobilePageHint from "../components/MobilePageHint";

const { Text } = Typography;

type DocumentItem = {
  id: string;
  label?: string | null;
  pdfUrl?: string;
  shareToken?: string | null;
  targetType: string;
  targetId: string;
  createdAt: string;
  RenderJob?: { status?: string | null };
  Template?: { name?: string | null };
};

const targetTypeLabelMap: Record<string, string> = {
  course: "코스",
  instructor_profile: "강사",
  brochure_package: "브로셔",
  schedule: "일정",
};

export default function MobileDocumentsPage() {
  const { accessToken } = useAuth();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ title: string; fileUrl?: string } | null>(null);

  const loadDocuments = async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const result = (await api.documentList({
        token: accessToken,
        page: 1,
        pageSize: 100,
      })) as { items?: DocumentItem[] };
      setDocuments(result?.items || []);
    } catch (error) {
      message.error(`문서 목록 조회 실패: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDocuments();
  }, [accessToken]);

  const docs = useMemo(
    () =>
      documents
        .slice()
        .sort(
          (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
        ),
    [documents],
  );

  const downloadFile = async (url: string | undefined, title: string) => {
    if (!url) {
      message.warning("다운로드 가능한 파일이 없습니다.");
      return;
    }
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("파일을 불러오지 못했습니다.");
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = buildMobilePdfFileName(title);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch {
      message.error("다운로드에 실패했습니다.");
    }
  };

  const getShareUrl = async (doc: DocumentItem): Promise<string | null> => {
    if (!accessToken) return null;
    try {
      const token =
        doc.shareToken ||
        (
          (await api.documentShare({
            token: accessToken,
            id: doc.id,
          })) as { shareToken?: string }
        ).shareToken;
      if (!token) return null;
      return `${window.location.origin}/share/${token}`;
    } catch {
      return null;
    }
  };

  const fallbackCopyText = (text: string): boolean => {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.top = "-1000px";
      textarea.style.left = "-1000px";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(textarea);
      return copied;
    } catch {
      return false;
    }
  };

  const copyShareLinkByUrl = async (shareUrl: string) => {
    if (!shareUrl) return false;
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        return true;
      } catch {
        // fallback below
      }
    }
    return fallbackCopyText(shareUrl);
  };

  const copyShareLink = async (doc: DocumentItem) => {
    const shareUrl = await getShareUrl(doc);
    if (!shareUrl) {
      message.warning("공유 링크를 생성하지 못했습니다.");
      return;
    }
    const copied = await copyShareLinkByUrl(shareUrl);
    if (copied) {
      message.success("공유 링크를 복사했습니다.");
      void loadDocuments();
      return;
    }
    Modal.info({
      title: "링크 복사 실패",
      content: (
        <div>
          <div style={{ marginBottom: 8 }}>아래 링크를 수동으로 복사해서 사용하세요.</div>
          <code style={{ wordBreak: "break-all" }}>{shareUrl}</code>
        </div>
      ),
    });
  };

  const sendToOtherApp = async (doc: DocumentItem) => {
    const title = doc.label || doc.Template?.name || "문서";
    if (!doc.pdfUrl) {
      message.warning("전송 가능한 PDF 파일이 없습니다.");
      return;
    }

    try {
      const response = await fetch(doc.pdfUrl);
      if (!response.ok) {
        throw new Error("파일 다운로드 실패");
      }
      const blob = await response.blob();
      const fileName = buildMobilePdfFileName(title);
      const file = new File([blob], fileName, { type: "application/pdf" });

      if (
        navigator.share &&
        window.isSecureContext &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          title,
          text: "PDF 파일을 확인하세요.",
          files: [file],
        });
        return;
      }

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
      message.info("앱 파일 전송 미지원 환경입니다. PDF를 다운로드했습니다.");
    } catch (error) {
      const immediateShareUrl = doc.shareToken
        ? `${window.location.origin}/share/${doc.shareToken}`
        : null;
      const shareUrl = immediateShareUrl || (await getShareUrl(doc));
      if (!shareUrl) {
        message.error("앱 전송에 실패했습니다.");
        return;
      }
      if (navigator.share && window.isSecureContext) {
        try {
          await navigator.share({
            title,
            text: "문서를 확인하세요.",
            url: shareUrl,
          });
          void loadDocuments();
          return;
        } catch {
          // fallback below
        }
      }
      const copied = await copyShareLinkByUrl(shareUrl);
      if (copied) {
        message.info("파일 전송에 실패해 링크 공유로 대체했습니다.");
        return;
      }
      Modal.info({
        title: "앱 전송 실패",
        content: (
          <div>
            <div style={{ marginBottom: 8 }}>
              기기 정책으로 공유 시트를 열 수 없습니다. 아래 링크를 복사해 사용하세요.
            </div>
            <code style={{ wordBreak: "break-all" }}>{shareUrl}</code>
          </div>
        ),
      });
    }
  };

  return (
    <Space direction="vertical" size={10} style={{ width: "100%" }}>
      <MobilePageHint
        icon={<FolderOpenOutlined />}
        title="문서 요약 확인 후 바로 공유/전송"
        description="카드를 펼치면 액션을 사용할 수 있습니다."
      />
      {docs.map((doc) => {
        const title = doc.label || doc.Template?.name || "문서";
        const ready = doc.RenderJob?.status === "done" && !!doc.pdfUrl;
        return (
          <Card key={doc.id} size="small" styles={{ body: { padding: 10 } }} className="m-card">
            <Collapse
              ghost
              items={[
                {
                  key: doc.id,
                  label: (
                    <Space style={{ width: "100%", justifyContent: "space-between" }}>
                      <Space direction="vertical" size={1}>
                        <Text strong>{title}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {new Date(doc.createdAt).toLocaleString("ko-KR")}
                        </Text>
                      </Space>
                      <Tag color={ready ? "blue" : "gold"}>{ready ? "완료" : "처리중"}</Tag>
                    </Space>
                  ),
                  children: (
                    <Space direction="vertical" size={10} style={{ width: "100%", marginTop: 4 }}>
                      <Space style={{ width: "100%", justifyContent: "space-between" }} align="center">
                        <Space size={6} align="center">
                          <Text type="secondary">유형</Text>
                          <Tag style={{ marginInlineEnd: 0 }}>
                            {targetTypeLabelMap[doc.targetType] || doc.targetType}
                          </Tag>
                        </Space>
                        <Space size={6} align="center">
                          <Text type="secondary">문서 ID</Text>
                          <Text code>{doc.id}</Text>
                        </Space>
                      </Space>
                      <div
                        style={{
                          width: "100%",
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 8,
                        }}
                      >
                        <Button
                          icon={<EyeOutlined />}
                          onClick={() => setPreviewDoc({ title, fileUrl: doc.pdfUrl })}
                          disabled={!ready}
                          style={{ width: "100%" }}
                        >
                          미리보기
                        </Button>
                        <Button
                          icon={<DownloadOutlined />}
                          type="primary"
                          onClick={() => void downloadFile(doc.pdfUrl, title)}
                          disabled={!ready}
                          style={{ width: "100%" }}
                        >
                          다운로드
                        </Button>
                        <Button
                          icon={<ShareAltOutlined />}
                          onClick={() => void copyShareLink(doc)}
                          disabled={!ready}
                          style={{ width: "100%" }}
                        >
                          공유
                        </Button>
                        <Button
                          icon={<SendOutlined />}
                          type="primary"
                          onClick={() => void sendToOtherApp(doc)}
                          disabled={!ready}
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
        );
      })}
      {!loading && docs.length === 0 ? (
        <Card size="small" className="m-card">
          <Text type="secondary">생성된 문서가 없습니다.</Text>
        </Card>
      ) : null}
      <Modal
        title={previewDoc ? `${previewDoc.title} 미리보기` : "미리보기"}
        open={!!previewDoc}
        onCancel={() => setPreviewDoc(null)}
        footer={[
          <Button key="close" onClick={() => setPreviewDoc(null)}>
            닫기
          </Button>,
        ]}
        width={720}
        style={{ top: 8 }}
      >
        {previewDoc?.fileUrl ? (
          <iframe
            src={previewDoc.fileUrl}
            title={previewDoc.title}
            style={{ width: "100%", height: "65vh", border: "1px solid #e5e7eb", borderRadius: 8 }}
          />
        ) : (
          <Alert type="warning" showIcon message="미리보기 가능한 파일이 없습니다." />
        )}
      </Modal>
    </Space>
  );
}
