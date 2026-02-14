import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Divider, Result, Select, Space, Switch, Table, Tag, Input, Tabs, InputNumber, Upload, message, Collapse } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, SaveOutlined, ReloadOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/mcpClient';
import { NO_COLUMN_KEY, normalizeConfig } from '../utils/tableConfig';
import type { ColumnConfig } from '../utils/tableConfig';
import { DEFAULT_COLUMNS } from '../utils/tableDefaults';
import type { RcFile } from 'antd/es/upload';
import type { ColumnsType } from 'antd/es/table';
import { useLocation } from 'react-router-dom';
import BoardAdminPage from './BoardAdminPage';
import {
  readSitePermissionSnapshot,
  type SitePermissionRole,
  SITE_PERMISSION_STORAGE_KEYS,
  SITE_PERMISSIONS_UPDATED_EVENT,
} from '../utils/sitePermissions';

const TABLE_OPTIONS = [
  { value: 'courses', label: '코스' },
  { value: 'instructors', label: '강사' },
  { value: 'templates', label: '템플릿' },
  { value: 'users', label: '회원' },
  { value: 'schedules', label: '일정' },
  { value: 'lectures', label: '강의' },
];

const ROLE_DEFINITIONS = [
  { role: 'admin', description: '시스템 전체 제어', summary: '모든 데이터/설정/사용자 관리' },
  { role: 'operator', description: '운영 업무 담당', summary: '코스/일정 관리, 사용자 조회/통계' },
  { role: 'editor', description: '콘텐츠 편집', summary: '코스/강의/템플릿/스케줄 생성/수정' },
  { role: 'instructor', description: '강사 전용', summary: '자신 소유 코스/강의/일정 CRUD' },
  { role: 'viewer', description: '읽기 전용', summary: '`*.get`, `*.list` 호출 중심' },
  { role: 'guest', description: '최소 권한', summary: '인증 전용 뷰/체험용' },
];

type PermissionMatrixItem = {
  tool: string;
  desc: string;
  admin: string;
  operator: string;
  editor: string;
  instructor: string;
  viewer: string;
  guest: string;
  isNew?: boolean;
  planned?: boolean;
  exclusiveRole?: string;
};

type PermissionMatrixFeature = {
  title: string;
  items: PermissionMatrixItem[];
};

type PermissionMatrixSection = {
  menuKey: string;
  features: PermissionMatrixFeature[];
};

const PERMISSION_SECTIONS: PermissionMatrixSection[] = [
  {
    menuKey: 'dashboard',
    features: [
      {
        title: '대시보드',
        items: [
          {
            tool: 'dashboard.read',
            desc: '대시보드 접근',
            admin: 'O',
            operator: 'O',
            editor: 'O',
            instructor: 'O',
            viewer: 'O',
            guest: 'X',
            isNew: true,
          },
        ],
      },
    ],
  },
  {
    menuKey: 'courses',
    features: [
      {
        title: '코스',
        items: [
          { tool: 'course.upsert', desc: '코스 생성/수정', admin: 'O', operator: 'O', editor: 'O', instructor: 'O (본인)', viewer: 'X', guest: 'X' },
          { tool: 'course.get', desc: '코스 단건 조회', admin: 'O', operator: 'O', editor: 'O', instructor: 'O', viewer: 'O', guest: 'X' },
          { tool: 'course.list', desc: '코스 목록 조회', admin: 'O', operator: 'O', editor: 'O', instructor: 'O', viewer: 'O', guest: 'X' },
          { tool: 'course.listMine', desc: '내 코스 목록 조회', admin: 'O (본인)', operator: 'O (본인)', editor: 'O (본인)', instructor: 'O (본인)', viewer: 'O (본인)', guest: 'O (본인)', isNew: true },
          { tool: 'course.delete', desc: '코스 삭제(소프트)', admin: 'O', operator: 'O', editor: 'O', instructor: 'O (본인)', viewer: 'X', guest: 'X' },
        ],
      },
      {
        title: '강의',
        items: [
          { tool: 'lecture.upsert', desc: '강의 생성/수정', admin: 'O', operator: 'O', editor: 'O', instructor: 'O (본인)', viewer: 'X', guest: 'X' },
          { tool: 'lecture.get', desc: '강의 단건 조회', admin: 'O', operator: 'O', editor: 'O', instructor: 'O', viewer: 'O', guest: 'X' },
          { tool: 'lecture.list', desc: '강의 목록 조회', admin: 'O', operator: 'O', editor: 'O', instructor: 'O', viewer: 'O', guest: 'X' },
          { tool: 'lecture.listMine', desc: '내 강의 목록 조회', admin: 'O (본인)', operator: 'O (본인)', editor: 'O (본인)', instructor: 'O (본인)', viewer: 'O (본인)', guest: 'O (본인)', isNew: true, planned: true },
          { tool: 'lecture.delete', desc: '강의 삭제(소프트)', admin: 'O', operator: 'O', editor: 'O', instructor: 'O (본인)', viewer: 'X', guest: 'X' },
        ],
      },
      {
        title: '코스 공유',
        items: [
          { tool: 'course.shareInvite', desc: '코스 공유 초대 생성', admin: 'O', operator: 'O', editor: 'O', instructor: 'O (본인)', viewer: 'X', guest: 'X' },
          { tool: 'course.shareRespond', desc: '코스 공유 수락/거절', admin: 'O (본인)', operator: 'O (본인)', editor: 'O (본인)', instructor: 'O (본인)', viewer: 'O (본인)', guest: 'X' },
          { tool: 'course.shareListReceived', desc: '내 코스 공유 요청 목록', admin: 'O (본인)', operator: 'O (본인)', editor: 'O (본인)', instructor: 'O (본인)', viewer: 'O (본인)', guest: 'X' },
          { tool: 'course.shareListForCourse', desc: '코스별 공유 대상 목록', admin: 'O', operator: 'O', editor: 'O', instructor: 'O (본인)', viewer: 'X', guest: 'X' },
          { tool: 'course.shareRevoke', desc: '코스 공유 해제', admin: 'O', operator: 'O', editor: 'O', instructor: 'O (본인)', viewer: 'X', guest: 'X' },
          { tool: 'course.shareLeave', desc: '공유받은 코스 공유 해제', admin: 'O (본인)', operator: 'O (본인)', editor: 'O (본인)', instructor: 'O (본인)', viewer: 'O (본인)', guest: 'X' },
          { tool: 'course.shareTargets', desc: '공유 대상 사용자 목록', admin: 'O', operator: 'O', editor: 'O', instructor: 'O', viewer: 'X', guest: 'X' },
        ],
      },
    ],
  },
  {
    menuKey: 'instructors',
    features: [
      {
        title: '강사',
        items: [
          { tool: 'instructor.upsert', desc: '강사 생성/수정', admin: 'O', operator: 'O', editor: 'O', instructor: 'X', viewer: 'X', guest: 'X' },
          { tool: 'instructor.get', desc: '강사 단건 조회', admin: 'O', operator: 'O', editor: 'O', instructor: 'O', viewer: 'O', guest: 'X' },
          { tool: 'instructor.getByUser', desc: '내 강사 정보 조회', admin: 'O (본인)', operator: 'O (본인)', editor: 'O (본인)', instructor: 'O (본인)', viewer: 'O (본인)', guest: 'X' },
          { tool: 'instructor.list', desc: '강사 목록 조회', admin: 'O', operator: 'O', editor: 'O', instructor: 'O', viewer: 'O', guest: 'X' },
          { tool: 'instructor.delete', desc: '강사 삭제(소프트)', admin: 'O', operator: 'O', editor: 'O', instructor: 'X', viewer: 'X', guest: 'X', planned: true },
        ],
      },
      {
        title: '일정',
        items: [
          { tool: 'schedule.upsert', desc: '일정 생성/수정', admin: 'O', operator: 'O', editor: 'O', instructor: 'O (본인)', viewer: 'X', guest: 'X' },
          { tool: 'schedule.get', desc: '일정 단건 조회', admin: 'O', operator: 'O', editor: 'O', instructor: 'O', viewer: 'O', guest: 'X' },
          { tool: 'schedule.list', desc: '일정 목록 조회', admin: 'O', operator: 'O', editor: 'O', instructor: 'O', viewer: 'O', guest: 'X' },
          { tool: 'schedule.listMine', desc: '내 일정 목록 조회', admin: 'O (본인)', operator: 'O (본인)', editor: 'O (본인)', instructor: 'O (본인)', viewer: 'O (본인)', guest: 'O (본인)', isNew: true, planned: true },
          { tool: 'schedule.delete', desc: '일정 삭제(소프트)', admin: 'O', operator: 'O', editor: 'O', instructor: 'O (본인)', viewer: 'X', guest: 'X', planned: true },
        ],
      },
    ],
  },
  {
    menuKey: 'templates',
    features: [
      {
        title: '템플릿 허브',
        items: [
          { tool: 'template.create', desc: '템플릿 생성', admin: 'O', operator: 'O', editor: 'O', instructor: 'X', viewer: 'X', guest: 'X' },
          { tool: 'template.upsert', desc: '템플릿 생성/수정', admin: 'O', operator: 'O', editor: 'O', instructor: 'O (본인)', viewer: 'X', guest: 'X' },
          { tool: 'template.get', desc: '템플릿 단건 조회', admin: 'O', operator: 'O', editor: 'O', instructor: 'O', viewer: 'O', guest: 'X' },
          { tool: 'template.list', desc: '템플릿 목록 조회', admin: 'O', operator: 'O', editor: 'O', instructor: 'O', viewer: 'O', guest: 'X' },
          { tool: 'template.previewHtml', desc: '템플릿 미리보기', admin: 'O', operator: 'O', editor: 'O', instructor: 'O', viewer: 'O', guest: 'X' },
          { tool: 'template.delete', desc: '템플릿 삭제(소프트)', admin: 'O', operator: 'O', editor: 'O', instructor: 'O (본인)', viewer: 'X', guest: 'X' },
        ],
      },
    ],
  },
  {
    menuKey: 'my-templates',
    features: [
      {
        title: '내 템플릿',
        items: [
          { tool: 'template.listMine', desc: '내 템플릿 목록 조회', admin: 'O (본인)', operator: 'O (본인)', editor: 'O (본인)', instructor: 'O (본인)', viewer: 'O (본인)', guest: 'O (본인)', isNew: true, planned: true },
          { tool: 'template.deleteMine', desc: '내 템플릿 삭제', admin: 'O (본인)', operator: 'O (본인)', editor: 'O (본인)', instructor: 'O (본인)', viewer: 'O (본인)', guest: 'O (본인)', planned: true, isNew: true },
        ],
      },
    ],
  },
  {
    menuKey: 'documents',
    features: [
      {
        title: '내 문서',
        items: [
          { tool: 'document.list', desc: '내 문서 목록 조회', admin: 'O (본인)', operator: 'O (본인)', editor: 'O (본인)', instructor: 'O (본인)', viewer: 'O (본인)', guest: 'O (본인)' },
          { tool: 'document.delete', desc: '문서 삭제', admin: 'O (본인)', operator: 'O (본인)', editor: 'O (본인)', instructor: 'O (본인)', viewer: 'O (본인)', guest: 'O (본인)' },
          { tool: 'document.listMine', desc: '내 문서 목록 조회(분리 툴)', admin: 'O (본인)', operator: 'O (본인)', editor: 'O (본인)', instructor: 'O (본인)', viewer: 'O (본인)', guest: 'O (본인)', isNew: true, planned: true },
        ],
      },
    ],
  },
  {
    menuKey: 'render',
    features: [
      {
        title: '렌더',
        items: [
          { tool: 'render.coursePdf', desc: '코스 PDF 렌더', admin: 'O', operator: 'O', editor: 'O', instructor: 'O', viewer: 'X', guest: 'X' },
          { tool: 'render.schedulePdf', desc: '일정 PDF 렌더', admin: 'O', operator: 'O', editor: 'O', instructor: 'O', viewer: 'X', guest: 'X' },
          { tool: 'render.instructorProfilePdf', desc: '강사 프로필 PDF 렌더', admin: 'O', operator: 'O', editor: 'O', instructor: 'O', viewer: 'X', guest: 'X' },
          { tool: 'render.listMine', desc: '내 렌더 작업 목록', admin: 'O (본인)', operator: 'O (본인)', editor: 'O (본인)', instructor: 'O (본인)', viewer: 'O (본인)', guest: 'O (본인)', isNew: true, planned: true },
          { tool: 'render.deleteMine', desc: '내 렌더 작업 삭제', admin: 'O (본인)', operator: 'O (본인)', editor: 'O (본인)', instructor: 'O (본인)', viewer: 'O (본인)', guest: 'O (본인)', planned: true, isNew: true },
        ],
      },
    ],
  },
  {
    menuKey: 'profile',
    features: [
      {
        title: '프로필',
        items: [
          { tool: 'user.me', desc: '내 정보 조회', admin: 'O (본인)', operator: 'O (본인)', editor: 'O (본인)', instructor: 'O (본인)', viewer: 'O (본인)', guest: 'O (본인)' },
          { tool: 'user.update', desc: '사용자 정보 수정', admin: 'O (본인)', operator: 'O (본인)', editor: 'O (본인)', instructor: 'O (본인)', viewer: 'O (본인)', guest: 'O (본인)' },
          { tool: 'user.delete', desc: '회원 탈퇴', admin: 'O (본인)', operator: 'O (본인)', editor: 'O (본인)', instructor: 'O (본인)', viewer: 'O (본인)', guest: 'O (본인)' },
          { tool: 'user.requestInstructor', desc: '강사 요청', admin: 'O (본인)', operator: 'O (본인)', editor: 'O (본인)', instructor: 'O (본인)', viewer: 'O (본인)', guest: 'O (본인)' },
          { tool: 'user.updateInstructorProfile', desc: '강사 프로필 수정', admin: 'O (본인)', operator: 'O (본인)', editor: 'O (본인)', instructor: 'O (본인)', viewer: 'O (본인)', guest: 'O (본인)' },
          { tool: 'user.getInstructorProfile', desc: '내 강사 프로필 조회', admin: 'O (본인)', operator: 'O (본인)', editor: 'O (본인)', instructor: 'O (본인)', viewer: 'O (본인)', guest: 'O (본인)' },
          { tool: 'user.refreshToken', desc: '세션 연장(리프레시 토큰)', admin: 'O (본인)', operator: 'O (본인)', editor: 'O (본인)', instructor: 'O (본인)', viewer: 'O (본인)', guest: 'O (본인)' },
        ],
      },
      {
        title: '인증',
        items: [
          { tool: 'user.register', desc: '회원가입', admin: '-', operator: '-', editor: '-', instructor: '-', viewer: '-', guest: '-' },
          { tool: 'user.login', desc: '로그인', admin: '-', operator: '-', editor: '-', instructor: '-', viewer: '-', guest: '-' },
        ],
      },
    ],
  },
  {
    menuKey: 'users',
    features: [
      {
        title: '사용자 관리',
        items: [
          { tool: 'user.get', desc: '사용자 단건 조회', admin: 'O', operator: 'X', editor: 'X', instructor: 'X', viewer: 'X', guest: 'X', exclusiveRole: 'admin' },
          { tool: 'user.list', desc: '사용자 목록 조회', admin: 'O', operator: 'X', editor: 'X', instructor: 'X', viewer: 'X', guest: 'X', exclusiveRole: 'admin' },
          { tool: 'user.updateRole', desc: '사용자 역할 변경', admin: 'O', operator: 'X', editor: 'X', instructor: 'X', viewer: 'X', guest: 'X', exclusiveRole: 'admin' },
          { tool: 'user.updateByAdmin', desc: '관리자 전용 사용자 수정', admin: 'O', operator: 'X', editor: 'X', instructor: 'X', viewer: 'X', guest: 'X', exclusiveRole: 'admin' },
          { tool: 'user.issueTestToken', desc: '관리자용 테스트 토큰 발급', admin: 'O', operator: 'X', editor: 'X', instructor: 'X', viewer: 'X', guest: 'X', exclusiveRole: 'admin' },
          { tool: 'user.impersonate', desc: '관리자 가장 로그인', admin: 'O', operator: 'X', editor: 'X', instructor: 'X', viewer: 'X', guest: 'X', exclusiveRole: 'admin' },
        ],
      },
    ],
  },
  {
    menuKey: 'groups',
    features: [
      {
        title: '그룹',
        items: [
          { tool: 'group.list', desc: '그룹 목록 조회', admin: 'O', operator: 'O', editor: 'X', instructor: 'X', viewer: 'X', guest: 'X' },
          { tool: 'group.upsert', desc: '그룹 생성/수정', admin: 'O', operator: 'O', editor: 'X', instructor: 'X', viewer: 'X', guest: 'X' },
          { tool: 'group.delete', desc: '그룹 삭제(소프트)', admin: 'O', operator: 'O', editor: 'X', instructor: 'X', viewer: 'X', guest: 'X' },
          { tool: 'group.member.list', desc: '그룹 멤버 목록', admin: 'O', operator: 'O', editor: 'X', instructor: 'X', viewer: 'X', guest: 'X' },
          { tool: 'group.member.add', desc: '그룹 멤버 추가', admin: 'O', operator: 'O', editor: 'X', instructor: 'X', viewer: 'X', guest: 'X' },
          { tool: 'group.member.remove', desc: '그룹 멤버 삭제', admin: 'O', operator: 'O', editor: 'X', instructor: 'X', viewer: 'X', guest: 'X' },
          { tool: 'group.member.updateRole', desc: '그룹 멤버 역할 변경', admin: 'O', operator: 'O', editor: 'X', instructor: 'X', viewer: 'X', guest: 'X' },
        ],
      },
    ],
  },
  {
    menuKey: 'permissions',
    features: [
      {
        title: '권한 설정',
        items: [
          { tool: 'permission.grant.list', desc: '권한 정책 목록 조회', admin: 'O', operator: 'O', editor: 'X', instructor: 'X', viewer: 'X', guest: 'X' },
          { tool: 'permission.grant.upsert', desc: '권한 정책 생성/수정', admin: 'O', operator: 'O', editor: 'X', instructor: 'X', viewer: 'X', guest: 'X' },
          { tool: 'permission.grant.delete', desc: '권한 정책 삭제', admin: 'O', operator: 'O', editor: 'X', instructor: 'X', viewer: 'X', guest: 'X' },
          { tool: 'authz.check', desc: '권한 평가', admin: 'O', operator: 'O', editor: 'X', instructor: 'X', viewer: 'X', guest: 'X', exclusiveRole: 'admin' },
        ],
      },
    ],
  },
  {
    menuKey: 'misc',
    features: [
      {
        title: '공유',
        items: [
          { tool: 'document.share', desc: '문서 공유 토큰 생성/재발급', admin: 'O (본인)', operator: 'O (본인)', editor: 'O (본인)', instructor: 'O (본인)', viewer: 'O (본인)', guest: 'O (본인)' },
          { tool: 'document.revokeShare', desc: '문서 공유 토큰 해제', admin: 'O (본인)', operator: 'O (본인)', editor: 'O (본인)', instructor: 'O (본인)', viewer: 'O (본인)', guest: 'O (본인)' },
        ],
      },
      {
        title: '승인/수락',
        items: [
          { tool: 'user.approveInstructor', desc: '강사 승인', admin: 'O', operator: 'X', editor: 'X', instructor: 'X', viewer: 'X', guest: 'X', exclusiveRole: 'admin' },
        ],
      },
    ],
  },
  {
    menuKey: 'site-settings',
    features: [
      {
        title: '사이트 설정',
        items: [
          { tool: 'siteSetting.get', desc: '사이트 설정 조회', admin: 'O', operator: 'O', editor: 'X', instructor: 'X', viewer: 'X', guest: 'X' },
          { tool: 'siteSetting.upsert', desc: '사이트 설정 저장', admin: 'O', operator: 'O', editor: 'X', instructor: 'X', viewer: 'X', guest: 'X' },
          { tool: 'tableConfig.get', desc: '테이블 설정 조회', admin: 'O', operator: 'O', editor: 'X', instructor: 'X', viewer: 'X', guest: 'X' },
          { tool: 'tableConfig.upsert', desc: '테이블 설정 저장', admin: 'O', operator: 'O', editor: 'X', instructor: 'X', viewer: 'X', guest: 'X' },
        ],
      },
    ],
  },
  {
    menuKey: 'board',
    features: [
      {
        title: '게시판 관리',
        items: [
          { tool: 'board.list', desc: '게시글 목록 조회', admin: 'O', operator: 'O', editor: 'O', instructor: 'O', viewer: 'O', guest: 'O', planned: true, isNew: true },
          { tool: 'board.get', desc: '게시글 상세 조회', admin: 'O', operator: 'O', editor: 'O', instructor: 'O', viewer: 'O', guest: 'O', planned: true, isNew: true },
          { tool: 'board.upsert', desc: '게시글 작성/수정', admin: 'O', operator: 'O', editor: 'X', instructor: 'X', viewer: 'X', guest: 'X', planned: true, isNew: true },
          { tool: 'board.delete', desc: '게시글 삭제(소프트)', admin: 'O', operator: 'O', editor: 'X', instructor: 'X', viewer: 'X', guest: 'X', planned: true, isNew: true },
        ],
      },
    ],
  },
  {
    menuKey: 'test-echo',
    features: [
      {
        title: '테스트',
        items: [
          { tool: 'test.echo', desc: '테스트 에코', admin: 'O', operator: 'X', editor: 'X', instructor: 'X', viewer: 'X', guest: 'X', exclusiveRole: 'admin' },
        ],
      },
    ],
  },
];

const MENU_GATES = [
  { key: 'dashboard', label: 'Dash Board' },
  { key: 'courses', label: '코스 관리' },
  { key: 'instructors', label: '강사 관리' },
  { key: 'templates', label: '템플릿 관리' },
  { key: 'render', label: 'PDF 생성' },
  { key: 'users', label: '회원관리' },
  { key: 'groups', label: '그룹관리' },
  { key: 'permissions', label: '권한관리' },
  { key: 'site-settings', label: '사이트 관리' },
  { key: 'board', label: '게시판 관리' },
  { key: 'documents', label: '내 문서함' },
  { key: 'profile', label: '내 정보' },
];

type PermissionRow = {
  key: string;
  menuKey: string;
  tool: string;
  desc: string;
  admin: string;
  operator: string;
  editor: string;
  instructor: string;
  viewer: string;
  guest: string;
  isNew?: boolean;
  planned?: boolean;
  exclusiveRole?: string;
};

type MenuRoleRow = {
  key: string;
  label: string;
  admin: boolean;
  operator: boolean;
  editor: boolean;
  instructor: boolean;
  viewer: boolean;
  guest: boolean;
};

type MenuRoleKey = keyof Omit<MenuRoleRow, 'key' | 'label'>;

function normalizeAdminPermissionControls(args: {
  menuRolePermissions: Record<string, boolean>;
  permissionOverrides: Record<string, 'O' | 'X'>;
}) {
  const normalizedMenuRolePermissions = { ...args.menuRolePermissions };
  Object.keys(normalizedMenuRolePermissions).forEach((key) => {
    if (key.endsWith(':admin')) {
      normalizedMenuRolePermissions[key] = true;
    }
  });
  MENU_GATES.forEach((menu) => {
    normalizedMenuRolePermissions[`${menu.key}:admin`] = true;
  });

  const normalizedPermissionOverrides = { ...args.permissionOverrides };
  Object.keys(normalizedPermissionOverrides).forEach((key) => {
    if (key.endsWith(':admin')) {
      normalizedPermissionOverrides[key] = 'O';
    }
  });

  return {
    menuRolePermissions: normalizedMenuRolePermissions,
    permissionOverrides: normalizedPermissionOverrides,
  };
}

export default function SiteSettingsPage() {
  const { user, accessToken, issueTestToken } = useAuth();
  const location = useLocation();
  const isAuthorized = user?.role === 'admin' || user?.role === 'operator';
  const readMenuEnabled = () => readSitePermissionSnapshot().menuEnabled;
  const readPermissionOverrides = () => readSitePermissionSnapshot().permissionOverrides;
  const readMenuRolePermissions = () => readSitePermissionSnapshot().menuRolePermissions;

  const [tableKey, setTableKey] = useState<string>('courses');
  const [activeTab, setActiveTab] = useState<string>('outline');
  const [columns, setColumns] = useState<ColumnConfig[]>([]);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [menuEnabled, setMenuEnabled] = useState<Record<string, boolean>>(readMenuEnabled);
  const [permissionOverrides, setPermissionOverrides] = useState<Record<string, 'O' | 'X'>>(
    readPermissionOverrides,
  );
  const [menuRolePermissions, setMenuRolePermissions] = useState<Record<string, boolean>>(
    readMenuRolePermissions,
  );
  const [savedMenuEnabled, setSavedMenuEnabled] = useState<Record<string, boolean>>(readMenuEnabled);
  const [savedPermissionOverrides, setSavedPermissionOverrides] = useState<Record<string, 'O' | 'X'>>(
    readPermissionOverrides,
  );
  const [savedMenuRolePermissions, setSavedMenuRolePermissions] = useState<Record<string, boolean>>(
    readMenuRolePermissions,
  );
  const [extendMinutes, setExtendMinutes] = useState(10);
  const [extendDirty, setExtendDirty] = useState(false);
  const [faviconUrl, setFaviconUrl] = useState<string>('');
  const [faviconDirty, setFaviconDirty] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [logoDirty, setLogoDirty] = useState(false);
  const [siteTitle, setSiteTitle] = useState<string>('Edux - HR 강의 계획서 관리');
  const [titleDirty, setTitleDirty] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        if (accessToken) {
          const result = await api.tableConfigGet(accessToken, tableKey) as { items: ColumnConfig[] };
          const normalized = normalizeConfig(result.items || [], DEFAULT_COLUMNS[tableKey] || []);
          if (!cancelled) {
            setColumns(normalized);
            setDirty(false);
          }
        } else {
          const normalized = normalizeConfig([], DEFAULT_COLUMNS[tableKey] || []);
          if (!cancelled) {
            setColumns(normalized);
            setDirty(false);
          }
        }
      } catch {
        const normalized = normalizeConfig([], DEFAULT_COLUMNS[tableKey] || []);
        if (!cancelled) {
          setColumns(normalized);
          setDirty(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [tableKey]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const nextTab = params.get('tab');
    const nextTableKey = params.get('tableKey');
    if (nextTab) {
      setActiveTab(nextTab);
    }
    if (nextTableKey && TABLE_OPTIONS.some((opt) => opt.value === nextTableKey)) {
      setTableKey(nextTableKey);
    }
  }, [location.search]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!accessToken) return;
      try {
        const result = (await api.siteSettingGet(accessToken, 'session_extend_minutes')) as {
          value: number | null;
        };
        const minutes =
          typeof result?.value === 'number'
            ? result.value
            : Number((result as any)?.value?.minutes) || 10;
        if (!cancelled) {
          setExtendMinutes(minutes);
          setExtendDirty(false);
        }
      } catch {
        if (!cancelled) {
          setExtendMinutes(10);
          setExtendDirty(false);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!accessToken) return;
      try {
        const result = (await api.siteSettingGet(accessToken, 'favicon_url')) as {
          value: string | null;
        };
        if (!cancelled) {
          setFaviconUrl(result?.value || '');
          setFaviconDirty(false);
        }
      } catch {
        if (!cancelled) {
          setFaviconUrl('');
          setFaviconDirty(false);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!accessToken) return;
      try {
        const result = (await api.siteSettingGet(accessToken, 'logo_url')) as {
          value: string | null;
        };
        if (!cancelled) {
          setLogoUrl(result?.value || '');
          setLogoDirty(false);
        }
      } catch {
        if (!cancelled) {
          setLogoUrl('');
          setLogoDirty(false);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!accessToken) return;
      try {
        const result = (await api.siteSettingGet(accessToken, 'site_title')) as {
          value: string | null;
        };
        if (!cancelled) {
          setSiteTitle(result?.value || 'Edux - HR 강의 계획서 관리');
          setTitleDirty(false);
        }
      } catch {
        if (!cancelled) {
          setSiteTitle('Edux - HR 강의 계획서 관리');
          setTitleDirty(false);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const isRecordEqual = <T extends Record<string, any>>(left: T, right: T) => {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) return false;
    for (const key of leftKeys) {
      if (left[key] !== right[key]) return false;
    }
    return true;
  };

  const permissionsDirty =
    !isRecordEqual(menuEnabled, savedMenuEnabled) ||
    !isRecordEqual(permissionOverrides, savedPermissionOverrides) ||
    !isRecordEqual(menuRolePermissions, savedMenuRolePermissions);

  const savePermissions = useCallback(() => {
    const normalized = normalizeAdminPermissionControls({
      menuRolePermissions,
      permissionOverrides,
    });
    localStorage.setItem(
      SITE_PERMISSION_STORAGE_KEYS.menuEnabled,
      JSON.stringify(menuEnabled),
    );
    localStorage.setItem(
      SITE_PERMISSION_STORAGE_KEYS.permissionOverrides,
      JSON.stringify(normalized.permissionOverrides),
    );
    localStorage.setItem(
      SITE_PERMISSION_STORAGE_KEYS.menuRolePermissions,
      JSON.stringify(normalized.menuRolePermissions),
    );
    window.dispatchEvent(
      new CustomEvent(SITE_PERMISSIONS_UPDATED_EVENT, {
        detail: {
          menuEnabled,
          permissionOverrides: normalized.permissionOverrides,
          menuRolePermissions: normalized.menuRolePermissions,
        },
      }),
    );
    setSavedMenuEnabled(menuEnabled);
    setPermissionOverrides(normalized.permissionOverrides);
    setMenuRolePermissions(normalized.menuRolePermissions);
    setSavedPermissionOverrides(normalized.permissionOverrides);
    setSavedMenuRolePermissions(normalized.menuRolePermissions);
    message.success('권한 설정이 저장되었습니다.');
  }, [menuEnabled, menuRolePermissions, permissionOverrides]);

  useEffect(() => {
    (window as any).__siteSettingsHasUnsaved = permissionsDirty;
    (window as any).__siteSettingsSave = savePermissions;
    return () => {
      delete (window as any).__siteSettingsHasUnsaved;
      delete (window as any).__siteSettingsSave;
    };
  }, [permissionsDirty, savePermissions]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!permissionsDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [permissionsDirty]);

  const moveRow = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= columns.length) return;
    const next = [...columns];
    const temp = next[index];
    next[index] = next[target];
    next[target] = temp;
    setColumns(next);
    setDirty(true);
  };

  const tableColumns = useMemo(
    () => [
      {
        title: '순서',
        dataIndex: 'order',
        width: 80,
        render: (_: unknown, __: ColumnConfig, index: number) => <Tag>{index + 1}</Tag>,
      },
      { title: '컬럼', dataIndex: 'label' },
      {
        title: '라벨(커스텀)',
        dataIndex: 'customLabel',
        width: 220,
        render: (_: unknown, record: ColumnConfig) => (
          <Input
            placeholder={record.label}
            value={record.customLabel || ''}
            disabled={record.columnKey === NO_COLUMN_KEY}
            onChange={(e) => {
              const value = e.target.value;
              setColumns((prev) =>
                prev.map((c) => (c.columnKey === record.columnKey ? { ...c, customLabel: value } : c)),
              );
              setDirty(true);
            }}
          />
        ),
      },
      { title: '키', dataIndex: 'key', width: 200 },
      {
        title: '표시',
        dataIndex: 'visible',
        width: 120,
        render: (visible: boolean, record: ColumnConfig) => (
          <Switch
            checked={visible}
            disabled={record.columnKey === NO_COLUMN_KEY}
            onChange={(checked) => {
              setColumns((prev) =>
                prev.map((c) => (c.columnKey === record.columnKey ? { ...c, visible: checked } : c)),
              );
              setDirty(true);
            }}
          />
        ),
      },
      {
        title: '순서 변경',
        dataIndex: 'actions',
        width: 140,
        render: (_: unknown, __: ColumnConfig, index: number) => (
          <Space>
            <Button
              icon={<ArrowUpOutlined />}
              size="small"
              disabled={index === 0}
              onClick={() => moveRow(index, 'up')}
            />
            <Button
              icon={<ArrowDownOutlined />}
              size="small"
              disabled={index === 0}
              onClick={() => moveRow(index, 'down')}
            />
          </Space>
        ),
      },
    ],
    [columns],
  );

  const renderPermissionCell =
    (roleKey: SitePermissionRole) =>
    (value: string, record: PermissionRow) => {
    const isSelf = value.includes('본인');
    const normalized = value.startsWith('O') ? 'O' : value.startsWith('X') ? 'X' : '-';
    const menuKey = record.menuKey;
    const adminPinned = roleKey === 'admin';
    const menuGateOn = menuKey ? (menuEnabled[menuKey] ?? true) : true;
    const roleGateOn = menuKey
      ? (adminPinned ? true : (menuRolePermissions[`${menuKey}:${roleKey}`] ?? true))
      : true;
    const locked = adminPinned || !menuGateOn || !roleGateOn;
    const isExclusive = record.exclusiveRole === roleKey && normalized === 'O';
    if (normalized === '-') {
      return (
        <Space size={6}>
          <Tag color="default">-</Tag>
        </Space>
      );
    }
    const overrideKey = `${record.tool}:${roleKey}`;
    const current = adminPinned ? 'O' : (permissionOverrides[overrideKey] ?? normalized);
    return (
      <Space size={6}>
        <Switch
          checked={current === 'O'}
          size="small"
          disabled={locked}
          onChange={(checked) =>
            setPermissionOverrides((prev) => {
              if (adminPinned) return prev;
              return {
                ...prev,
                [overrideKey]: checked ? 'O' : 'X',
              };
            })
          }
        />
        {adminPinned ? <Tag color="blue">고정</Tag> : null}
        {isSelf ? <Tag color="green">본인</Tag> : null}
        {isExclusive ? <Tag color="orange">전용</Tag> : null}
      </Space>
    );
  };

  const permissionColumns = useMemo<ColumnsType<PermissionRow>>(
    () => [
      {
        title: '툴',
        dataIndex: 'tool',
        width: 220,
        render: (_: string, record: PermissionRow) => (
          <Space size={6}>
            <Tag>{record.tool}</Tag>
            {record.isNew ? <Tag color="cyan">NEW</Tag> : null}
            {record.planned ? <Tag color="red">미구현</Tag> : null}
          </Space>
        ),
      },
      {
        title: '기능 정의',
        dataIndex: 'desc',
        render: (value: string, record: PermissionRow) =>
          record.planned ? (
            <span style={{ color: '#cf1322', fontWeight: 700 }}>{value}</span>
          ) : (
            value
          ),
      },
      { title: 'admin', dataIndex: 'admin', width: 140, render: renderPermissionCell('admin') },
      { title: 'operator', dataIndex: 'operator', width: 140, render: renderPermissionCell('operator') },
      { title: 'editor', dataIndex: 'editor', width: 140, render: renderPermissionCell('editor') },
      { title: 'instructor', dataIndex: 'instructor', width: 160, render: renderPermissionCell('instructor') },
      { title: 'viewer', dataIndex: 'viewer', width: 140, render: renderPermissionCell('viewer') },
      { title: 'guest', dataIndex: 'guest', width: 140, render: renderPermissionCell('guest') },
    ],
    [menuEnabled, menuRolePermissions, permissionOverrides],
  );

  const menuRoleColumns = useMemo<ColumnsType<MenuRoleRow>>(() => {
    const roleColumns: ColumnsType<MenuRoleRow> = ROLE_DEFINITIONS.map((role) => ({
      title: role.role,
      dataIndex: role.role,
      width: 110,
      render: (enabled: boolean, record: MenuRoleRow) => {
        const adminPinned = role.role === 'admin';
        return (
          <Space size={6}>
            <Switch
              checked={adminPinned ? true : enabled}
              size="small"
              disabled={adminPinned || !(menuEnabled[record.key] ?? true)}
              onChange={(checked) => {
                if (adminPinned) return;
                setMenuRolePermissions((prev) => ({
                  ...prev,
                  [`${record.key}:${role.role}`]: checked,
                }));
              }}
            />
            {adminPinned ? <Tag color="blue">고정</Tag> : null}
          </Space>
        );
      },
    }));
    return [
      { title: '메뉴', dataIndex: 'label', width: 180 },
      ...roleColumns,
    ];
  }, [menuEnabled, menuRolePermissions]);

  const buildMenuRoleRow = (menuKey: string, label: string): MenuRoleRow => {
    const row: MenuRoleRow = {
      key: menuKey,
      label,
      admin: true,
      operator: true,
      editor: true,
      instructor: true,
      viewer: true,
      guest: true,
    };
    ROLE_DEFINITIONS.forEach((role) => {
      const key = `${menuKey}:${role.role}`;
      const roleKey = role.role as MenuRoleKey;
      row[roleKey] = roleKey === 'admin' ? true : (menuRolePermissions[key] ?? true);
    });
    return row;
  };

  const roleColumns = useMemo(
    () => [
      { title: '역할', dataIndex: 'role', width: 140, render: (value: string) => <Tag>{value}</Tag> },
      { title: '설명', dataIndex: 'description', width: 220 },
      { title: '주요 권한 요약', dataIndex: 'summary' },
    ],
    [],
  );

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
      <h2 style={{ marginBottom: 16 }}>사이트 관리</h2>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'basic',
            label: '기본관리',
            children: (
              <>
                <Alert
                  type="info"
                  showIcon
                  message="기본관리"
                  description="사이트 공통 설정을 이 탭에서 관리합니다."
                  style={{ marginBottom: 16 }}
                />
                <Card>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>세션 연장 시간(분)</div>
                    <Space>
                      <InputNumber
                        min={1}
                        max={120}
                        value={extendMinutes}
                        onChange={(val) => {
                          setExtendMinutes(Number(val || 10));
                          setExtendDirty(true);
                        }}
                      />
                      <Button
                        type="primary"
                        disabled={!extendDirty}
                        onClick={() => {
                          if (!accessToken) {
                            message.error('로그인이 필요합니다.');
                            return;
                          }
                          api.siteSettingUpsert({
                            token: accessToken,
                            key: 'session_extend_minutes',
                            value: extendMinutes,
                          })
                            .then(() => {
                              setExtendDirty(false);
                              message.success('세션 연장 시간이 저장되었습니다.');
                            })
                            .catch((err: Error) => {
                              message.error(`저장 실패: ${err.message}`);
                            });
                        }}
                      >
                        저장
                      </Button>
                      <Button
                        disabled={user?.role !== 'admin'}
                        onClick={async () => {
                          try {
                            const minutes = await issueTestToken(1);
                            message.success(`테스트 토큰 발급: ${minutes}분`);
                          } catch (err: any) {
                            message.error(`테스트 실패: ${err.message}`);
                          }
                        }}
                      >
                        관리자 세션 테스트(1분)
                      </Button>
                    </Space>
                  </div>
                  <Divider />
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>파비콘 변경</div>
                    <Space>
                      <Upload
                        showUploadList={false}
                        accept="image/*,.ico,.svg"
                        beforeUpload={async (file: RcFile) => {
                          try {
                            const result = await api.uploadFile(file);
                            setFaviconUrl(result.url);
                            setFaviconDirty(true);
                            message.success('파비콘 업로드 완료');
                          } catch (err: any) {
                            message.error(`업로드 실패: ${err.message}`);
                          }
                          return false;
                        }}
                      >
                        <Button>파일 선택</Button>
                      </Upload>
                      <Input value={faviconUrl || ''} readOnly style={{ width: 320 }} />
                      <Button
                        type="primary"
                        disabled={!faviconDirty}
                        onClick={() => {
                          if (!accessToken) {
                            message.error('로그인이 필요합니다.');
                            return;
                          }
                          api.siteSettingUpsert({
                            token: accessToken,
                            key: 'favicon_url',
                            value: faviconUrl || '',
                          })
                            .then(() => {
                              setFaviconDirty(false);
                              window.dispatchEvent(
                                new CustomEvent('siteFaviconUpdated', {
                                  detail: faviconUrl || '',
                                }),
                              );
                              message.success('파비콘 설정이 저장되었습니다.');
                            })
                            .catch((err: Error) => {
                              message.error(`저장 실패: ${err.message}`);
                            });
                        }}
                      >
                        저장
                      </Button>
                      <Button
                        onClick={() => {
                          setFaviconUrl('');
                          setFaviconDirty(true);
                        }}
                      >
                        기본값 복원
                      </Button>
                    </Space>
                    <div style={{ marginTop: 8, color: '#999' }}>
                      저장 후 새로고침 시 기본 파비콘이 변경됩니다.
                    </div>
                  </div>
                  <Divider />
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>로고 변경</div>
                    <Space>
                      <Upload
                        showUploadList={false}
                        accept="image/*,.svg"
                        beforeUpload={async (file: RcFile) => {
                          try {
                            const result = await api.uploadFile(file);
                            setLogoUrl(result.url);
                            setLogoDirty(true);
                            message.success('로고 업로드 완료');
                          } catch (err: any) {
                            message.error(`업로드 실패: ${err.message}`);
                          }
                          return false;
                        }}
                      >
                        <Button>파일 선택</Button>
                      </Upload>
                      <Input value={logoUrl || ''} readOnly style={{ width: 320 }} />
                      <Button
                        type="primary"
                        disabled={!logoDirty}
                        onClick={() => {
                          if (!accessToken) {
                            message.error('로그인이 필요합니다.');
                            return;
                          }
                          api.siteSettingUpsert({
                            token: accessToken,
                            key: 'logo_url',
                            value: logoUrl || '',
                          })
                            .then(() => {
                              setLogoDirty(false);
                              window.dispatchEvent(
                                new CustomEvent('siteLogoUpdated', {
                                  detail: logoUrl || '',
                                }),
                              );
                              message.success('로고 설정이 저장되었습니다.');
                            })
                            .catch((err: Error) => {
                              message.error(`저장 실패: ${err.message}`);
                            });
                        }}
                      >
                        저장
                      </Button>
                      <Button
                        onClick={() => {
                          setLogoUrl('');
                          setLogoDirty(true);
                        }}
                      >
                        기본값 복원
                      </Button>
                    </Space>
                  </div>
                  <Divider />
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>사이트 타이틀</div>
                    <Space>
                      <Input
                        value={siteTitle}
                        onChange={(e) => {
                          setSiteTitle(e.target.value);
                          setTitleDirty(true);
                        }}
                        style={{ width: 360 }}
                      />
                      <Button
                        type="primary"
                        disabled={!titleDirty}
                        onClick={() => {
                          if (!accessToken) {
                            message.error('로그인이 필요합니다.');
                            return;
                          }
                          api.siteSettingUpsert({
                            token: accessToken,
                            key: 'site_title',
                            value: siteTitle || 'Edux - HR 강의 계획서 관리',
                          })
                            .then(() => {
                              setTitleDirty(false);
                              window.dispatchEvent(
                                new CustomEvent('siteTitleUpdated', {
                                  detail:
                                    siteTitle || 'Edux - HR 강의 계획서 관리',
                                }),
                              );
                              message.success('사이트 타이틀이 저장되었습니다.');
                            })
                            .catch((err: Error) => {
                              message.error(`저장 실패: ${err.message}`);
                            });
                        }}
                      >
                        저장
                      </Button>
                      <Button
                        onClick={() => {
                          setSiteTitle('Edux - HR 강의 계획서 관리');
                          setTitleDirty(true);
                        }}
                      >
                        기본값 복원
                      </Button>
                    </Space>
                  </div>
                </Space>
                </Card>
              </>
            ),
          },
          {
            key: 'outline',
            label: '목차관리',
            children: (
              <>
                <Alert
                  type="info"
                  showIcon
                  message="목차관리"
                  description="테이블 컬럼 표시/순서를 공통 설정으로 관리합니다."
                  style={{ marginBottom: 16 }}
                />
                <Card>
                  <Space style={{ marginBottom: 16 }}>
                  <Select
                    value={tableKey}
                    onChange={(val) => setTableKey(val)}
                    options={TABLE_OPTIONS}
                    style={{ width: 200 }}
                    />
                    <Button
                      icon={<SaveOutlined />}
                      type="primary"
                      disabled={!dirty}
                      loading={loading}
                      onClick={() => {
                        const withoutNo = columns.filter((c) => c.columnKey !== NO_COLUMN_KEY);
                      if (!accessToken) {
                        message.error('로그인이 필요합니다.');
                        return;
                      }
                        api.tableConfigUpsert({
                          token: accessToken,
                          tableKey,
                          columns: withoutNo.map((c, index) => ({
                            columnKey: c.columnKey,
                            label: c.label,
                            customLabel: c.customLabel || undefined,
                            visible: c.visible,
                            order: index + 1,
                            width: c.width ?? undefined,
                            fixed: c.fixed ?? undefined,
                          })),
                        }).then(() => {
                          setDirty(false);
                          message.success('설정이 저장되었습니다.');
                        }).catch((err: Error) => {
                          message.error(`저장 실패: ${err.message}`);
                        });
                      }}
                    >
                      저장
                    </Button>
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={() => {
                        const base = DEFAULT_COLUMNS[tableKey] || [];
                        setColumns(normalizeConfig([], base));
                        setDirty(true);
                      }}
                    >
                      기본값 복원
                    </Button>
                  </Space>

                  <Divider style={{ margin: '12px 0' }} />

                  <Table
                    columns={tableColumns}
                    dataSource={columns}
                    rowKey="columnKey"
                    pagination={false}
                    size="middle"
                  />
                </Card>
              </>
            ),
          },
          {
            key: 'board',
            label: '게시판관리',
            children: (
              <>
                <Alert
                  type="info"
                  showIcon
                  message="게시판관리"
                  description="공지/업데이트/가이드 게시물을 운영합니다."
                  style={{ marginBottom: 16 }}
                />
                <BoardAdminPage embedded />
              </>
            ),
          },
          {
            key: 'permissions',
            label: '권한관리',
            children: (
              <>
                <Alert
                  type="info"
                  showIcon
                  message="권한관리"
                  description="기능 정의와 메뉴/역할/기능 권한을 저장하고 프론트 접근 제어에 즉시 반영합니다."
                  style={{ marginBottom: 16 }}
                />
                <Card style={{ marginBottom: 16 }}>
                  <Collapse
                    defaultActiveKey={[]}
                    items={[
                      {
                        key: 'roles',
                        label: (
                          <Space size={8}>
                            <span style={{ fontWeight: 600 }}>역할(Role) 정의</span>
                            <Tag color="default">{ROLE_DEFINITIONS.length}</Tag>
                          </Space>
                        ),
                        children: (
                          <Table
                            columns={roleColumns}
                            dataSource={ROLE_DEFINITIONS}
                            rowKey="role"
                            pagination={false}
                            size="small"
                          />
                        ),
                      },
                    ]}
                  />
                </Card>
                <Card style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, marginBottom: 12 }}>메뉴/권한 통합 관리</div>
                  <Alert
                    type="warning"
                    showIcon
                    message="상위 메뉴 OFF 시 하위 기능은 기본 차단"
                    description="메뉴가 비활성화되면 해당 도메인의 기능 권한이 허용이어도 접근이 막힙니다."
                    style={{ marginBottom: 12 }}
                  />
                  <Space style={{ marginBottom: 12 }}>
                    <Button type="primary" disabled={!permissionsDirty} onClick={savePermissions}>
                      저장
                    </Button>
                    <Button
                      disabled={!permissionsDirty}
                      onClick={() => {
                        setMenuEnabled(savedMenuEnabled);
                        setPermissionOverrides(savedPermissionOverrides);
                        setMenuRolePermissions(savedMenuRolePermissions);
                        message.info('변경 내용을 되돌렸습니다.');
                      }}
                    >
                      되돌리기
                    </Button>
                    {permissionsDirty ? <Tag color="orange">변경 내용 있음</Tag> : <Tag color="green">저장됨</Tag>}
                  </Space>
                  <Collapse
                    accordion
                    items={MENU_GATES.map((menu) => {
                      const menuSection = PERMISSION_SECTIONS.find((section) => section.menuKey === menu.key);
                      const sections = menuSection?.features ?? [];
                      const extraSections = PERMISSION_SECTIONS.filter(
                        (section) => !MENU_GATES.some((menuItem) => menuItem.key === section.menuKey),
                      ).flatMap((section) => section.features ?? []);
                      const mergedSections =
                        menu.key === MENU_GATES[MENU_GATES.length - 1].key && extraSections.length > 0
                          ? [...sections, { title: '기타', items: extraSections.flatMap((item) => item.items ?? []) }]
                          : sections;
                      const gateEnabled = menuEnabled[menu.key] ?? true;
                      return {
                        key: menu.key,
                        label: (
                          <Space size={12}>
                            <span>{menu.label}</span>
                            <span
                              onClick={(event) => event.stopPropagation()}
                              style={{ display: 'inline-flex', alignItems: 'center' }}
                            >
                              <Switch
                                checked={gateEnabled}
                                onChange={(checked) =>
                                  setMenuEnabled((prev) => ({
                                    ...prev,
                                    [menu.key]: checked,
                                  }))
                                }
                              />
                            </span>
                            {!gateEnabled ? <Tag color="red">OFF</Tag> : <Tag color="green">ON</Tag>}
                          </Space>
                        ),
                        children: (
                          <div>
                            <div style={{ fontWeight: 600, marginBottom: 8 }}>역할별 메뉴 접근</div>
                            <Table
                              columns={menuRoleColumns}
                              dataSource={[buildMenuRoleRow(menu.key, menu.label)]}
                              rowKey="key"
                              pagination={false}
                              size="small"
                            />
                            {mergedSections.length === 0 ? (
                              <div style={{ marginTop: 12 }}>
                                <Tag color="default">하위 기능 없음</Tag>
                              </div>
                            ) : (
                              mergedSections.map((section) => (
                                <Card key={section.title} style={{ marginTop: 12 }}>
                                  <div style={{ fontWeight: 600, marginBottom: 8, color: gateEnabled ? '#333' : '#999' }}>
                                    {section.title}
                                  </div>
                                  <div
                                    style={{
                                      opacity: gateEnabled ? 1 : 0,
                                      filter: gateEnabled ? 'none' : 'grayscale(1)',
                                      pointerEvents: gateEnabled ? 'auto' : 'none',
                                      visibility: gateEnabled ? 'visible' : 'hidden',
                                      height: gateEnabled ? 'auto' : undefined,
                                    }}
                                  >
                                    {section.items.length === 0 ? (
                                      <Tag color="default">하위 기능 없음</Tag>
                                    ) : (
                                      <Table
                                        columns={permissionColumns}
                                        dataSource={section.items.map((item): PermissionRow => ({
                                          key: item.tool,
                                          menuKey: menu.key,
                                          tool: item.tool,
                                          desc: item.desc,
                                          admin: item.admin,
                                          operator: item.operator,
                                          editor: item.editor,
                                          instructor: item.instructor,
                                          viewer: item.viewer,
                                          guest: item.guest,
                                          isNew: 'isNew' in item ? item.isNew : undefined,
                                          planned: 'planned' in item ? item.planned : undefined,
                                          exclusiveRole:
                                            'exclusiveRole' in item
                                              ? item.exclusiveRole
                                              : undefined,
                                        }))}
                                        rowKey="key"
                                        pagination={false}
                                        size="middle"
                                      />
                                    )}
                                  </div>
                                </Card>
                              ))
                            )}
                          </div>
                        ),
                      };
                    })}
                  />
                </Card>
                <Card>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>표기 규칙</div>
                  <div style={{ color: '#666' }}>
                    O = 허용, X = 거부, - = 인증 불필요(공개)
                  </div>
                </Card>
              </>
            ),
          },
        ]}
      />
    </div>
  );
}
