import { getRoleDefaultAllowSnapshot } from "../src/services/authorization.js";

type Role = "admin" | "operator" | "editor" | "instructor" | "viewer" | "guest";

const REQUIRED_BY_ROLE: Record<Role, string[]> = {
  admin: ["*"],
  operator: [
    "site.settings.read",
    "site.settings.update",
    "course.list",
    "instructor.list",
    "lecture.list",
    "message.list",
    "schedule.list",
    "render.coursePdf",
    "document.list",
    "tableConfig.upsert",
  ],
  editor: [
    "course.list",
    "instructor.list",
    "lecture.list",
    "message.list",
    "schedule.list",
    "render.coursePdf",
    "document.list",
  ],
  instructor: [
    "course.listMine",
    "lecture.grant.listMine",
    "message.send",
    "render.instructorProfilePdf",
    "document.share",
  ],
  viewer: [
    "course.list",
    "instructor.list",
    "lecture.list",
    "message.list",
    "document.list",
  ],
  guest: ["message.list", "document.list"],
};

function main() {
  const snapshot = getRoleDefaultAllowSnapshot();
  const failures: string[] = [];

  (Object.keys(REQUIRED_BY_ROLE) as Role[]).forEach((role) => {
    const current = new Set(snapshot[role] || []);
    REQUIRED_BY_ROLE[role].forEach((permissionKey) => {
      if (!current.has(permissionKey)) {
        failures.push(`${role} missing: ${permissionKey}`);
      }
    });
  });

  if (failures.length > 0) {
    console.error("[permission-matrix] FAILED");
    failures.forEach((line) => console.error(`- ${line}`));
    process.exit(1);
  }

  console.log("[permission-matrix] OK");
}

main();

