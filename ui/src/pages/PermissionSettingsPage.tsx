import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Radio,
  Result,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../api/mcpClient";

type SubjectType = "role" | "group" | "user";
type PermissionEffect = "allow" | "deny";
type CellState = "inherit" | PermissionEffect;
type RoleType = "admin" | "operator" | "editor" | "instructor" | "viewer" | "guest";

type GroupOption = { id: string; name: string };
type UserOption = { id: string; name: string; email: string };

interface PermissionGrantRow {
  id: string;
  permissionKey: string;
  effect: PermissionEffect;
}

interface TargetRow {
  id: string;
  label: string;
}

const roleOptions: Array<{ label: string; koLabel: string; value: RoleType }> = [
  { label: "admin", koLabel: "관리자", value: "admin" },
  { label: "operator", koLabel: "운영자", value: "operator" },
  { label: "editor", koLabel: "편집자", value: "editor" },
  { label: "instructor", koLabel: "강의자", value: "instructor" },
  { label: "viewer", koLabel: "사용자", value: "viewer" },
  { label: "guest", koLabel: "게스트", value: "guest" },
];

const presetPermissionKeys = [
  "course.create",
  "instructor.create",
  "template.create",
  "instructor.read",
  "instructor.update",
  "render.generate",
  "template.read",
  "template.use",
  "template.update",
  "template.delete",
  "course.read",
  "course.update",
  "course.approve",
  "course.delete",
  "group.manage",
  "group.member.manage",
  "group.permission.manage",
  "site.settings.read",
  "site.settings.update",
];

const permissionCatalog: Record<string, string[]> = {
  instructor: ["instructor.read", "instructor.create", "instructor.update"],
  render: ["render.generate"],
  template: ["template.read", "template.use", "template.create", "template.update", "template.delete"],
  course: ["course.read", "course.create", "course.update", "course.approve", "course.delete"],
  group: ["group.manage", "group.member.manage", "group.permission.manage"],
  site: ["site.settings.read", "site.settings.update"],
  all: presetPermissionKeys,
};

const { Text } = Typography;

function getCellState(grants: PermissionGrantRow[], permissionKey: string): CellState {
  const matched = grants.filter((grant) => grant.permissionKey === permissionKey);
  if (matched.some((grant) => grant.effect === "deny")) return "deny";
  if (matched.some((grant) => grant.effect === "allow")) return "allow";
  return "inherit";
}

export default function PermissionSettingsPage() {
  const { user, accessToken } = useAuth();
  const isAuthorized = user?.role === "admin" || user?.role === "operator";

  const [subjectType, setSubjectType] = useState<SubjectType>("role");
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [permissionKeys] = useState<string[]>(presetPermissionKeys);
  const [menuKey, setMenuKey] = useState<string>("all");
  const [permissionKey, setPermissionKey] = useState<string>("template.update");
  const [grantsByTarget, setGrantsByTarget] = useState<Record<string, PermissionGrantRow[]>>({});
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [menuDeniedBehavior, setMenuDeniedBehavior] = useState<"hide" | "disable">("disable");
  const [menuDeniedBehaviorDirty, setMenuDeniedBehaviorDirty] = useState(false);
  const [checkResult, setCheckResult] = useState<{
    allowed: boolean;
    reason: string;
    source: string;
  } | null>(null);

  const targetRows = useMemo<TargetRow[]>(() => {
    if (subjectType === "role") {
      return roleOptions.map((role) => ({
        id: role.value,
        label: `${role.label} : ${role.koLabel}`,
      }));
    }
    if (subjectType === "group") {
      return groups
        .filter((group) => selectedGroupIds.includes(group.id))
        .map((group) => ({ id: group.id, label: `${group.name} (${group.id})` }));
    }
    return users
      .filter((target) => selectedUserIds.includes(target.id))
      .map((target) => ({ id: target.id, label: `${target.name} (${target.email})` }));
  }, [groups, selectedGroupIds, selectedUserIds, subjectType, users]);

  const visiblePermissionKeys = useMemo(() => {
    if (menuKey === "all") return permissionKeys;
    const base = permissionCatalog[menuKey] || [];
    const merged = permissionKeys.filter((key) => base.includes(key));
    return merged.length > 0 ? merged : permissionKeys;
  }, [menuKey, permissionKeys]);

  const loadGroups = async () => {
    if (!accessToken) return;
    try {
      const result = (await api.groupList(accessToken)) as { items: GroupOption[] };
      const next = result.items || [];
      setGroups(next);
      if (selectedGroupIds.length === 0 && next.length > 0) {
        setSelectedGroupIds(next.slice(0, 5).map((group) => group.id));
      }
    } catch {
      setGroups([]);
    }
  };

  const loadUsers = async () => {
    if (!accessToken) return;
    try {
      const result = (await api.userList(accessToken, 200, 0)) as { users: UserOption[] };
      const next = result.users || [];
      setUsers(next);
      if (selectedUserIds.length === 0 && next.length > 0) {
        setSelectedUserIds(next.slice(0, 5).map((target) => target.id));
      }
    } catch {
      setUsers([]);
    }
  };

  const loadGrants = async () => {
    if (!accessToken) return;
    if (targetRows.length === 0) {
      setGrantsByTarget({});
      return;
    }
    setLoading(true);
    try {
      const pairs = await Promise.all(
        targetRows.map(async (target) => {
          const result = (await api.permissionGrantList({
            token: accessToken,
            subjectType,
            subjectId: target.id,
          })) as { items: PermissionGrantRow[] };
          return [target.id, result.items || []] as const;
        }),
      );
      setGrantsByTarget(Object.fromEntries(pairs));
    } catch (error) {
      const msg = error instanceof Error ? error.message : "권한 조회 실패";
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  useEffect(() => {
    let cancelled = false;
    const loadMenuBehavior = async () => {
      if (!accessToken) return;
      try {
        const result = (await api.siteSettingGet(
          accessToken,
          "menu_denied_behavior",
        )) as { value: "hide" | "disable" | null };
        if (!cancelled) {
          const next = result?.value === "hide" ? "hide" : "disable";
          setMenuDeniedBehavior(next);
          setMenuDeniedBehaviorDirty(false);
        }
      } catch {
        if (!cancelled) {
          setMenuDeniedBehavior("disable");
          setMenuDeniedBehaviorDirty(false);
        }
      }
    };
    loadMenuBehavior();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  useEffect(() => {
    loadGrants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectType, selectedGroupIds.join(","), selectedUserIds.join(","), accessToken]);

  const handleChangeState = async (targetId: string, nextState: CellState) => {
    if (!accessToken || !permissionKey.trim()) return;
    if (subjectType === "role" && targetId === "admin" && nextState === "deny") {
      message.warning("admin 역할은 거부(deny)로 설정할 수 없습니다.");
      return;
    }
    setSavingId(targetId);
    try {
      const current = grantsByTarget[targetId] || [];
      const existing = current.filter((grant) => grant.permissionKey === permissionKey);

      if (nextState === "inherit") {
        await Promise.all(
          existing.map((grant) =>
            api.permissionGrantDelete({ token: accessToken, id: grant.id }),
          ),
        );
      } else if (existing.length === 0) {
        await api.permissionGrantUpsert({
          token: accessToken,
          subjectType,
          subjectId: targetId,
          permissionKey,
          effect: nextState,
        });
      } else {
        await api.permissionGrantUpsert({
          token: accessToken,
          id: existing[0].id,
          subjectType,
          subjectId: targetId,
          permissionKey,
          effect: nextState,
        });
        if (existing.length > 1) {
          await Promise.all(
            existing.slice(1).map((grant) =>
              api.permissionGrantDelete({ token: accessToken, id: grant.id }),
            ),
          );
        }
      }

      await loadGrants();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "저장 실패";
      message.error(msg);
    } finally {
      setSavingId(null);
    }
  };

  useEffect(() => {
    if (!visiblePermissionKeys.includes(permissionKey)) {
      setPermissionKey(visiblePermissionKeys[0] || "");
    }
  }, [permissionKey, visiblePermissionKeys]);

  const checkCurrentUser = async () => {
    if (!accessToken || !permissionKey.trim()) return;
    try {
      const result = (await api.authzCheck({
        token: accessToken,
        permissionKey,
      })) as { allowed: boolean; reason: string; source: string };
      setCheckResult(result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "판정 실패";
      message.error(msg);
    }
  };

  const saveMenuBehavior = async () => {
    if (!accessToken) return;
    try {
      await api.siteSettingUpsert({
        token: accessToken,
        key: "menu_denied_behavior",
        value: menuDeniedBehavior,
      });
      localStorage.setItem("menu_denied_behavior", menuDeniedBehavior);
      setMenuDeniedBehaviorDirty(false);
      window.dispatchEvent(
        new CustomEvent("menuDeniedBehaviorUpdated", { detail: menuDeniedBehavior }),
      );
      message.success("메뉴 권한 처리 방식이 저장되었습니다.");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "저장 실패";
      message.error(msg);
    }
  };

  const columns: ColumnsType<TargetRow> = [
    {
      title: "대상",
      dataIndex: "label",
      key: "label",
    },
    {
      title: "현재 상태",
      key: "state",
      width: 140,
      render: (_: unknown, row) => {
        const state = getCellState(grantsByTarget[row.id] || [], permissionKey);
        if (state === "allow") return <Tag color="green">허용</Tag>;
        if (state === "deny") return <Tag color="red">거부</Tag>;
        return <Tag>기본값</Tag>;
      },
    },
    {
      title: "설정",
      key: "action",
      width: 300,
      render: (_: unknown, row) => {
        const state = getCellState(grantsByTarget[row.id] || [], permissionKey);
        const isAdminRoleRow = subjectType === "role" && row.id === "admin";
        return (
          <Radio.Group
            optionType="button"
            buttonStyle="solid"
            value={state}
            disabled={savingId === row.id}
            onChange={(event) => handleChangeState(row.id, event.target.value as CellState)}
            options={[
              { label: "기본값", value: "inherit" },
              { label: "허용", value: "allow" },
              {
                label: "거부",
                value: "deny",
                disabled: isAdminRoleRow,
              },
            ]}
          />
        );
      },
    },
  ];

  if (!isAuthorized) {
    return (
      <Result
        status="403"
        title="권한 없음"
        subTitle="관리자 또는 운영자만 접근할 수 있습니다."
      />
    );
  }

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <div>
        <h2 style={{ margin: 0 }}>권한 설정(단순 모드)</h2>
        <Text type="secondary">
          권한 키 1개를 선택하고 대상별로 기본값/허용/거부를 클릭하세요.
        </Text>
      </div>

      <Card title="1) 메뉴 선택" size="small">
        <Space wrap align="center">
          <Select<string>
            value={menuKey}
            onChange={setMenuKey}
            style={{ width: 220 }}
            options={[
              { label: "전체 메뉴", value: "all" },
              { label: "강사 관리", value: "instructor" },
              { label: "PDF 생성", value: "render" },
              { label: "템플릿 관리", value: "template" },
              { label: "코스 관리", value: "course" },
              { label: "그룹 관리", value: "group" },
              { label: "사이트 관리", value: "site" },
            ]}
          />
          <span style={{ marginLeft: 12, color: "#666" }}>권한 없을 때 메뉴:</span>
          <Select<"hide" | "disable">
            value={menuDeniedBehavior}
            onChange={(value) => {
              setMenuDeniedBehavior(value);
              setMenuDeniedBehaviorDirty(true);
            }}
            style={{ width: 140 }}
            options={[
              { label: "숨김", value: "hide" },
              { label: "비활성화", value: "disable" },
            ]}
          />
          <Button type="primary" onClick={saveMenuBehavior} disabled={!menuDeniedBehaviorDirty}>
            저장
          </Button>
        </Space>
      </Card>

      <Card title="2) 권한 키 선택" size="small">
        <Space wrap>
          <Select<string>
            showSearch
            value={permissionKey}
            onChange={setPermissionKey}
            options={visiblePermissionKeys.map((key) => ({ label: key, value: key }))}
            style={{ width: 320 }}
          />
          <Button onClick={checkCurrentUser}>내 계정 판정</Button>
          {checkResult && (
            <>
              <Tag color={checkResult.allowed ? "green" : "red"}>
                {checkResult.allowed ? "허용" : "거부"}
              </Tag>
              <Text type="secondary">
                reason={checkResult.reason}, source={checkResult.source}
              </Text>
            </>
          )}
        </Space>
      </Card>

      <Card title="3) 대상 선택" size="small">
        <Space direction="vertical" style={{ width: "100%" }}>
          <Select<SubjectType>
            value={subjectType}
            onChange={setSubjectType}
            style={{ width: 180 }}
            options={[
              { label: "역할(role)", value: "role" },
              { label: "그룹(group)", value: "group" },
              { label: "사용자(user)", value: "user" },
            ]}
          />

          {subjectType === "group" && (
            <Select<string[]>
              mode="multiple"
              value={selectedGroupIds}
              onChange={setSelectedGroupIds}
              placeholder="편집할 그룹 선택"
              options={groups.map((group) => ({
                label: `${group.name} (${group.id})`,
                value: group.id,
              }))}
              style={{ width: "100%" }}
            />
          )}

          {subjectType === "user" && (
            <Select<string[]>
              mode="multiple"
              value={selectedUserIds}
              onChange={setSelectedUserIds}
              placeholder="편집할 사용자 선택"
              options={users.map((target) => ({
                label: `${target.name} (${target.email})`,
                value: target.id,
              }))}
              style={{ width: "100%" }}
            />
          )}
        </Space>
      </Card>

      <Card title="4) 대상별 권한 설정" size="small">
        <Table<TargetRow>
          rowKey="id"
          loading={loading}
          dataSource={targetRows}
          columns={columns}
          pagination={false}
        />
      </Card>
    </Space>
  );
}
