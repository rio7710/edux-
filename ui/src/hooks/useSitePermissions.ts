import { useCallback, useEffect, useMemo, useState } from "react";
import {
  isFeatureAllowedBySnapshot,
  isMenuAllowedBySnapshot,
  readSitePermissionSnapshot,
  SITE_PERMISSIONS_UPDATED_EVENT,
  toSitePermissionRole,
} from "../utils/sitePermissions";

export function useSitePermissions(role?: string | null) {
  const [snapshot, setSnapshot] = useState(readSitePermissionSnapshot);
  const roleKey = useMemo(() => toSitePermissionRole(role), [role]);

  const refresh = useCallback(() => {
    setSnapshot(readSitePermissionSnapshot());
  }, []);

  useEffect(() => {
    const handleRefresh = () => refresh();
    window.addEventListener(
      SITE_PERMISSIONS_UPDATED_EVENT,
      handleRefresh as EventListener,
    );
    window.addEventListener("storage", handleRefresh);
    return () => {
      window.removeEventListener(
        SITE_PERMISSIONS_UPDATED_EVENT,
        handleRefresh as EventListener,
      );
      window.removeEventListener("storage", handleRefresh);
    };
  }, [refresh]);

  const canAccessMenu = useCallback(
    (menuKey: string) => isMenuAllowedBySnapshot(snapshot, menuKey, roleKey),
    [snapshot, roleKey],
  );

  const canUseFeature = useCallback(
    (menuKey: string, toolKey: string) =>
      isFeatureAllowedBySnapshot(snapshot, { menuKey, toolKey, role: roleKey }),
    [snapshot, roleKey],
  );

  return {
    snapshot,
    roleKey,
    canAccessMenu,
    canUseFeature,
    refreshSitePermissions: refresh,
  };
}
