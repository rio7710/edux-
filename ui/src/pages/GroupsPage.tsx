import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Drawer,
  Form,
  Input,
  Modal,
  Popconfirm,
  Result,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  message,
} from "antd";
import { DeleteOutlined, PlusOutlined, TeamOutlined } from "@ant-design/icons";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../api/mcpClient";

type MemberRole = "owner" | "manager" | "member";
type PermissionEffect = "allow" | "deny";

interface GroupMemberRow {
  id: string;
  userId: string;
  memberRole: MemberRole;
  User: {
    id: string;
    name: string;
    email: string;
    role: string;
    isActive?: boolean;
  };
}

interface GroupRow {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  Members: GroupMemberRow[];
  memberCount: number;
}

interface PermissionGrantRow {
  id: string;
  permissionKey: string;
  effect: PermissionEffect;
  note?: string | null;
}

const memberRoleOptions = [
  { label: "Owner", value: "owner" },
  { label: "Manager", value: "manager" },
  { label: "Member", value: "member" },
];

const effectOptions = [
  { label: "Allow", value: "allow" },
  { label: "Deny", value: "deny" },
];

export default function GroupsPage() {
  const { user, accessToken } = useAuth();
  const isAuthorized = user?.role === "admin" || user?.role === "operator";

  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupRow | null>(null);
  const [drawerGroup, setDrawerGroup] = useState<GroupRow | null>(null);
  const [memberUserId, setMemberUserId] = useState("");
  const [memberRole, setMemberRole] = useState<MemberRole>("member");
  const [permissionForm] = Form.useForm<{
    permissionKey: string;
    effect: PermissionEffect;
    note?: string;
  }>();
  const [groupForm] = Form.useForm<{
    name: string;
    description?: string;
    isActive: boolean;
  }>();
  const [permissionItems, setPermissionItems] = useState<PermissionGrantRow[]>([]);
  const [permissionLoading, setPermissionLoading] = useState(false);

  const loadGroups = async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const result = (await api.groupList(accessToken)) as {
        items: GroupRow[];
      };
      setGroups(result.items || []);
      if (drawerGroup) {
        const next = (result.items || []).find((item) => item.id === drawerGroup.id);
        setDrawerGroup(next || null);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "그룹 조회 실패";
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const loadPermissions = async (groupId: string) => {
    if (!accessToken) return;
    setPermissionLoading(true);
    try {
      const result = (await api.permissionGrantList({
        token: accessToken,
        subjectType: "group",
        subjectId: groupId,
      })) as { items: PermissionGrantRow[] };
      setPermissionItems(result.items || []);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "권한 정책 조회 실패";
      message.error(msg);
    } finally {
      setPermissionLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  useEffect(() => {
    if (drawerGroup?.id) {
      loadPermissions(drawerGroup.id);
    } else {
      setPermissionItems([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerGroup?.id, accessToken]);

  const openCreate = () => {
    setEditingGroup(null);
    groupForm.setFieldsValue({
      name: "",
      description: "",
      isActive: true,
    });
    setIsModalOpen(true);
  };

  const openEdit = (group: GroupRow) => {
    setEditingGroup(group);
    groupForm.setFieldsValue({
      name: group.name,
      description: group.description || "",
      isActive: group.isActive,
    });
    setIsModalOpen(true);
  };

  const handleSaveGroup = async () => {
    if (!accessToken) return;
    try {
      const values = await groupForm.validateFields();
      await api.groupUpsert({
        token: accessToken,
        id: editingGroup?.id,
        name: values.name,
        description: values.description,
        isActive: values.isActive,
      });
      message.success(editingGroup ? "그룹이 수정되었습니다." : "그룹이 생성되었습니다.");
      setIsModalOpen(false);
      setEditingGroup(null);
      await loadGroups();
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message);
      }
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!accessToken) return;
    try {
      await api.groupDelete({ token: accessToken, id: groupId });
      message.success("그룹이 삭제되었습니다.");
      if (drawerGroup?.id === groupId) setDrawerGroup(null);
      await loadGroups();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "그룹 삭제 실패";
      message.error(msg);
    }
  };

  const handleAddMember = async () => {
    if (!accessToken || !drawerGroup) return;
    if (!memberUserId.trim()) {
      message.warning("추가할 사용자 ID를 입력하세요.");
      return;
    }
    try {
      await api.groupMemberAdd({
        token: accessToken,
        groupId: drawerGroup.id,
        userId: memberUserId.trim(),
        memberRole,
      });
      message.success("멤버가 추가되었습니다.");
      setMemberUserId("");
      setMemberRole("member");
      await loadGroups();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "멤버 추가 실패";
      message.error(msg);
    }
  };

  const handleUpdateMemberRole = async (member: GroupMemberRow, role: MemberRole) => {
    if (!accessToken || !drawerGroup) return;
    try {
      await api.groupMemberUpdateRole({
        token: accessToken,
        groupId: drawerGroup.id,
        userId: member.userId,
        memberRole: role,
      });
      message.success("멤버 역할이 변경되었습니다.");
      await loadGroups();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "역할 변경 실패";
      message.error(msg);
    }
  };

  const handleRemoveMember = async (member: GroupMemberRow) => {
    if (!accessToken || !drawerGroup) return;
    try {
      await api.groupMemberRemove({
        token: accessToken,
        groupId: drawerGroup.id,
        userId: member.userId,
      });
      message.success("멤버가 삭제되었습니다.");
      await loadGroups();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "멤버 삭제 실패";
      message.error(msg);
    }
  };

  const handleAddPermission = async () => {
    if (!accessToken || !drawerGroup) return;
    try {
      const values = await permissionForm.validateFields();
      await api.permissionGrantUpsert({
        token: accessToken,
        subjectType: "group",
        subjectId: drawerGroup.id,
        permissionKey: values.permissionKey.trim(),
        effect: values.effect,
        note: values.note,
      });
      message.success("권한 정책이 추가되었습니다.");
      permissionForm.resetFields();
      await loadPermissions(drawerGroup.id);
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message);
      }
    }
  };

  const handleDeletePermission = async (id: string) => {
    if (!accessToken || !drawerGroup) return;
    try {
      await api.permissionGrantDelete({ token: accessToken, id });
      message.success("권한 정책이 삭제되었습니다.");
      await loadPermissions(drawerGroup.id);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "권한 정책 삭제 실패";
      message.error(msg);
    }
  };

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
    <div>
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>그룹 관리</h2>
        <Space>
          <Button icon={<PlusOutlined />} type="primary" onClick={openCreate}>
            그룹 생성
          </Button>
          <Button onClick={loadGroups} loading={loading}>
            새로고침
          </Button>
        </Space>
      </div>

      <Table<GroupRow>
        rowKey="id"
        loading={loading}
        dataSource={groups}
        columns={[
          { title: "이름", dataIndex: "name", key: "name" },
          {
            title: "설명",
            dataIndex: "description",
            key: "description",
            render: (value: string | null) => value || "-",
          },
          {
            title: "상태",
            dataIndex: "isActive",
            key: "isActive",
            width: 120,
            render: (active: boolean) => (
              <Tag color={active ? "green" : "default"}>{active ? "활성" : "비활성"}</Tag>
            ),
          },
          {
            title: "멤버 수",
            dataIndex: "memberCount",
            key: "memberCount",
            width: 120,
          },
          {
            title: "액션",
            key: "actions",
            width: 280,
            render: (_: unknown, record) => (
              <Space>
                <Button
                  icon={<TeamOutlined />}
                  onClick={() => setDrawerGroup(record)}
                >
                  멤버/권한
                </Button>
                <Button onClick={() => openEdit(record)}>수정</Button>
                <Popconfirm
                  title="그룹 삭제"
                  description="그룹을 삭제하면 멤버와 권한 정책도 비활성화됩니다."
                  okText="삭제"
                  cancelText="취소"
                  onConfirm={() => handleDeleteGroup(record.id)}
                >
                  <Button danger icon={<DeleteOutlined />}>
                    삭제
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
        pagination={{ pageSize: 20 }}
      />

      <Modal
        title={editingGroup ? "그룹 수정" : "그룹 생성"}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={handleSaveGroup}
        okText="저장"
      >
        <Form form={groupForm} layout="vertical">
          <Form.Item
            name="name"
            label="그룹 이름"
            rules={[{ required: true, message: "그룹 이름을 입력하세요." }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="description" label="설명">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="isActive" label="활성" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        width={760}
        title={drawerGroup ? `${drawerGroup.name} 관리` : "그룹 관리"}
        open={!!drawerGroup}
        onClose={() => setDrawerGroup(null)}
      >
        {drawerGroup && (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Card title="멤버 관리" size="small">
              <Space style={{ marginBottom: 12 }}>
                <Input
                  placeholder="사용자 ID"
                  value={memberUserId}
                  onChange={(event) => setMemberUserId(event.target.value)}
                  style={{ width: 260 }}
                />
                <Select<MemberRole>
                  value={memberRole}
                  onChange={setMemberRole}
                  options={memberRoleOptions}
                  style={{ width: 140 }}
                />
                <Button type="primary" onClick={handleAddMember}>
                  멤버 추가
                </Button>
              </Space>

              <Table<GroupMemberRow>
                rowKey="id"
                dataSource={drawerGroup.Members || []}
                pagination={false}
                columns={[
                  {
                    title: "사용자",
                    key: "user",
                    render: (_: unknown, row) => `${row.User?.name || "-"} (${row.User?.email || "-"})`,
                  },
                  {
                    title: "시스템 역할",
                    key: "role",
                    width: 130,
                    render: (_: unknown, row) => <Tag>{row.User?.role || "-"}</Tag>,
                  },
                  {
                    title: "그룹 역할",
                    dataIndex: "memberRole",
                    key: "memberRole",
                    width: 180,
                    render: (value: MemberRole, row) => (
                      <Select<MemberRole>
                        value={value}
                        options={memberRoleOptions}
                        style={{ width: 140 }}
                        onChange={(next) => handleUpdateMemberRole(row, next)}
                      />
                    ),
                  },
                  {
                    title: "액션",
                    key: "actions",
                    width: 100,
                    render: (_: unknown, row) => (
                      <Popconfirm
                        title="멤버 삭제"
                        okText="삭제"
                        cancelText="취소"
                        onConfirm={() => handleRemoveMember(row)}
                      >
                        <Button danger size="small">
                          삭제
                        </Button>
                      </Popconfirm>
                    ),
                  },
                ]}
              />
            </Card>

            <Card title="그룹 권한 정책 (allow/deny)" size="small">
              <Form
                form={permissionForm}
                layout="inline"
                initialValues={{ effect: "allow" }}
                style={{ marginBottom: 12 }}
              >
                <Form.Item
                  name="permissionKey"
                  rules={[{ required: true, message: "권한 키를 입력하세요." }]}
                >
                  <Input placeholder="예: template.update" style={{ width: 220 }} />
                </Form.Item>
                <Form.Item name="effect" rules={[{ required: true }]}>
                  <Select<PermissionEffect> options={effectOptions} style={{ width: 110 }} />
                </Form.Item>
                <Form.Item name="note">
                  <Input placeholder="메모" style={{ width: 220 }} />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" onClick={handleAddPermission}>
                    정책 추가
                  </Button>
                </Form.Item>
              </Form>

              <Table<PermissionGrantRow>
                rowKey="id"
                loading={permissionLoading}
                dataSource={permissionItems}
                pagination={false}
                columns={[
                  { title: "권한 키", dataIndex: "permissionKey", key: "permissionKey" },
                  {
                    title: "효과",
                    dataIndex: "effect",
                    key: "effect",
                    width: 120,
                    render: (effect: PermissionEffect) => (
                      <Tag color={effect === "deny" ? "red" : "green"}>{effect}</Tag>
                    ),
                  },
                  {
                    title: "메모",
                    dataIndex: "note",
                    key: "note",
                    render: (value?: string | null) => value || "-",
                  },
                  {
                    title: "액션",
                    key: "action",
                    width: 100,
                    render: (_: unknown, row) => (
                      <Popconfirm
                        title="정책 삭제"
                        okText="삭제"
                        cancelText="취소"
                        onConfirm={() => handleDeletePermission(row.id)}
                      >
                        <Button danger size="small">
                          삭제
                        </Button>
                      </Popconfirm>
                    ),
                  },
                ]}
              />
            </Card>
          </Space>
        )}
      </Drawer>
    </div>
  );
}
