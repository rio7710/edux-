import { useCallback } from "react";
import { Modal } from "antd";

type UseSessionExpiredGuardArgs = {
  onGoToLogin: () => void;
  saveDraft?: () => void;
};

export function useSessionExpiredGuard({
  onGoToLogin,
  saveDraft,
}: UseSessionExpiredGuardArgs) {
  return useCallback(
    (reason?: string) => {
      saveDraft?.();
      Modal.confirm({
        title: "세션이 만료되었습니다",
        content: reason
          ? `작성 중인 내용을 임시 저장했습니다. (${reason})`
          : "작성 중인 내용을 임시 저장했습니다. 다시 로그인해주세요.",
        okText: "로그인으로 이동",
        cancelButtonProps: { style: { display: "none" } },
        onOk: onGoToLogin,
      });
    },
    [onGoToLogin, saveDraft],
  );
}
