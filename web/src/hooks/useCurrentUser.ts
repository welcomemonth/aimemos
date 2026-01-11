import { useAuth } from "@/contexts/AuthContext";

/**
 * 获取当前已登录用户信息
 *
 * @returns 当前登录用户对象；如果未登录，返回 null
 *
 * @example
 * const currentUser = useCurrentUser();
 * if (currentUser) {
 *   console.log(currentUser.email);
 * }
 */
const useCurrentUser = () => {
  const { currentUser } = useAuth();
  return currentUser;
};

export default useCurrentUser;
