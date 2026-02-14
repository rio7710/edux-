import type { Prisma, PrismaClient, UserMessageCategory } from "@prisma/client";

type MessageDb = PrismaClient | Prisma.TransactionClient;

export type UserMessageInput = {
  recipientUserId: string;
  senderUserId?: string | null;
  category?: UserMessageCategory;
  title: string;
  body?: string | null;
  actionType?: string | null;
  actionPayload?: Prisma.InputJsonValue | null;
};

export async function createUserMessage(
  db: MessageDb,
  input: UserMessageInput,
) {
  return db.userMessage.create({
    data: {
      recipientUserId: input.recipientUserId,
      senderUserId: input.senderUserId ?? null,
      category: input.category ?? "system",
      title: input.title,
      body: input.body ?? null,
      actionType: input.actionType ?? null,
      actionPayload: input.actionPayload ?? undefined,
    },
  });
}

export async function createUserMessages(
  db: MessageDb,
  inputs: UserMessageInput[],
) {
  if (inputs.length === 0) return 0;
  await Promise.all(inputs.map((input) => createUserMessage(db, input)));
  return inputs.length;
}
