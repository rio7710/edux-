import { evaluatePermissionDecision } from "../src/services/authorization.js";

type Scenario = {
  name: string;
  run: () => boolean;
};

const scenarios: Scenario[] = [
  {
    name: "user deny > role allow",
    run: () => {
      const result = evaluatePermissionDecision({
        role: "editor",
        permissionKey: "course.list",
        userGrants: [{ permissionKey: "course.list", effect: "deny" }],
        roleGrants: [{ permissionKey: "course.list", effect: "allow" }],
      });
      return result.allowed === false && result.reason === "user-deny";
    },
  },
  {
    name: "group deny > user allow",
    run: () => {
      const result = evaluatePermissionDecision({
        role: "editor",
        permissionKey: "lecture.get",
        userGrants: [{ permissionKey: "lecture.get", effect: "allow" }],
        groupGrants: [{ permissionKey: "lecture.get", effect: "deny" }],
      });
      return result.allowed === false && result.reason === "group-deny";
    },
  },
  {
    name: "user allow > role deny",
    run: () => {
      const result = evaluatePermissionDecision({
        role: "editor",
        permissionKey: "template.delete",
        userGrants: [{ permissionKey: "template.delete", effect: "allow" }],
        roleGrants: [{ permissionKey: "template.delete", effect: "deny" }],
      });
      return result.allowed === false && result.reason === "role-deny";
    },
  },
  {
    name: "default allow applies when no explicit grant",
    run: () => {
      const result = evaluatePermissionDecision({
        role: "viewer",
        permissionKey: "course.list",
      });
      return result.allowed === true && result.reason === "role-default-allow";
    },
  },
  {
    name: "default deny applies for unknown permission",
    run: () => {
      const result = evaluatePermissionDecision({
        role: "viewer",
        permissionKey: "unknown.permission.key",
      });
      return result.allowed === false && result.reason === "default-deny";
    },
  },
];

function main() {
  const failed = scenarios.filter((scenario) => !scenario.run());
  if (failed.length > 0) {
    console.error("[permission-scenarios] FAILED");
    failed.forEach((scenario) => console.error(`- ${scenario.name}`));
    process.exit(1);
  }
  console.log("[permission-scenarios] OK");
}

main();

