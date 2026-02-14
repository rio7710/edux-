import { signAccessToken } from "../src/services/jwt.js";
import { prisma } from "../src/services/prisma.js";
import {
  messageListHandler,
  messageMarkReadHandler,
  messageSeedDummyHandler,
  messageUnreadCountHandler,
} from "../src/tools/message.js";

function parseContentText(result: any) {
  const text = result?.content?.[0]?.text;
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function main() {
  const user = await prisma.user.findFirst({
    where: { isActive: true, deletedAt: null },
    select: { id: true, email: true, role: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  if (!user) {
    throw new Error("활성 사용자 없음");
  }

  const token = signAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  const seed = await messageSeedDummyHandler({ token, count: 6 });
  if (seed.isError) {
    throw new Error(seed.content?.[0]?.text ?? "더미 생성 실패");
  }

  const list = await messageListHandler({ token, limit: 20, status: "all" });
  if (list.isError) {
    throw new Error(list.content?.[0]?.text ?? "목록 조회 실패");
  }
  const listData = parseContentText(list) as { messages: Array<{ id: string; isRead: boolean }> };
  const firstUnread = listData.messages.find((item) => !item.isRead);

  const unreadBefore = await messageUnreadCountHandler({ token });
  if (unreadBefore.isError) {
    throw new Error(unreadBefore.content?.[0]?.text ?? "미읽음 조회 실패");
  }
  const unreadBeforeData = parseContentText(unreadBefore) as { count: number };

  if (firstUnread) {
    const mark = await messageMarkReadHandler({
      token,
      messageId: firstUnread.id,
      read: true,
    });
    if (mark.isError) {
      throw new Error(mark.content?.[0]?.text ?? "읽음 처리 실패");
    }
  }

  const unreadAfter = await messageUnreadCountHandler({ token });
  if (unreadAfter.isError) {
    throw new Error(unreadAfter.content?.[0]?.text ?? "미읽음 재조회 실패");
  }
  const unreadAfterData = parseContentText(unreadAfter) as { count: number };

  console.log(
    JSON.stringify(
      {
        userId: user.id,
        userName: user.name,
        createdDummy: parseContentText(seed),
        messageTotal: listData.messages.length,
        unreadBefore: unreadBeforeData.count,
        unreadAfter: unreadAfterData.count,
        markedMessageId: firstUnread?.id ?? null,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("Message inbox test failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
