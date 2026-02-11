import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  instructorProfile: {
    upsert: vi.fn(),
  },
  instructor: {
    upsert: vi.fn(),
  },
};

const jwtMock = {
  verifyToken: vi.fn(),
};

vi.mock("../src/services/prisma.js", () => ({
  prisma: prismaMock,
}));

vi.mock("../src/services/jwt.js", () => ({
  verifyToken: jwtMock.verifyToken,
}));

describe("contact sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("user.updateInstructorProfile syncs User.phone and User.website", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1",
      isActive: true,
      deletedAt: null,
      name: "User 1",
    });
    prismaMock.user.update.mockResolvedValue({});
    prismaMock.instructorProfile.upsert.mockResolvedValue({
      id: "p1",
      userId: "u1",
      displayName: "User 1",
    });
    jwtMock.verifyToken.mockReturnValue({ userId: "u1", role: "instructor" });

    const { updateInstructorProfileHandler } = await import(
      "../src/tools/user.js"
    );

    const result = await updateInstructorProfileHandler({
      token: "token",
      displayName: "홍길동",
      phone: "010-1111-2222",
      website: "https://example.com",
    });

    expect(result.isError).toBeUndefined();
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: {
        phone: "010-1111-2222",
        website: "https://example.com",
      },
    });

    const upsertArg = prismaMock.instructorProfile.upsert.mock.calls[0][0];
    expect(upsertArg.update.phone).toBeUndefined();
    expect(upsertArg.update.website).toBeUndefined();
    expect(upsertArg.create.phone).toBeUndefined();
    expect(upsertArg.create.website).toBeUndefined();
  });

  it("instructor.upsert syncs User.phone and does not write Instructor.phone", async () => {
    prismaMock.instructor.upsert.mockResolvedValue({
      id: "i1",
      name: "강사",
    });
    prismaMock.user.update.mockResolvedValue({});
    jwtMock.verifyToken.mockReturnValue({ userId: "u1", role: "instructor" });

    const { instructorUpsertHandler } = await import("../src/tools/instructor.js");

    const result = await instructorUpsertHandler({
      token: "token",
      id: "i1",
      name: "강사",
      phone: "010-9999-8888",
    });

    expect(result.isError).toBeUndefined();
    const upsertArg = prismaMock.instructor.upsert.mock.calls[0][0];
    expect(upsertArg.create.phone).toBeUndefined();
    expect(upsertArg.update.phone).toBeUndefined();

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { phone: "010-9999-8888" },
    });
  });
});
