import { http } from "@/utils/http";

export type InstallStatusResult = {
  code: number;
  message: string;
  data: {
    installed: boolean;
  };
};

export type InstallInitResult = {
  code: number;
  message: string;
  data: {
    username: string;
  };
};

/** 查询系统是否已初始化 */
export const getInstallStatus = () => {
  return http.request<InstallStatusResult>("get", "/api/install/status");
};

/** 初始化系统并创建初始管理员 */
export const postInstallInit = (data: {
  username: string;
  password: string;
  nickname?: string;
}) => {
  return http.request<InstallInitResult>("post", "/api/install/init", { data });
};
