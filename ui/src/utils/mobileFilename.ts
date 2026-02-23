const pad2 = (value: number) => String(value).padStart(2, "0");

const normalizeTitle = (title: string): string => {
  return title
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
};

export const buildMobilePdfFileName = (title: string, date = new Date()): string => {
  const safeTitle = normalizeTitle(title) || "untitled";
  const stamp = `${pad2(date.getMonth() + 1)}${pad2(date.getDate())}${pad2(date.getHours())}${pad2(
    date.getMinutes(),
  )}`;
  return `m_${safeTitle}_생성_${stamp}.pdf`;
};
