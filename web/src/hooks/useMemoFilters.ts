import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useInstance } from "@/contexts/InstanceContext";
import { useMemoFilterContext } from "@/contexts/MemoFilterContext";
import { Visibility } from "@/types/proto/api/v1/memo_service_pb";

/**
 * 从资源 name 中提取用户 ID
 *
 * 示例：
 *   "users/123" -> "123"
 *
 * @param name 用户资源名称
 * @returns 用户 ID，如果无法解析则返回空字符串
 */
const extractUserIdFromName = (name: string): string => {
  const match = name.match(/users\/(\d+)/);
  return match ? match[1] : "";
};

/**
 * 将 Visibility 枚举转换为后端过滤语法所需的字符串
 *
 * @param visibility 可见性枚举值
 * @returns 对应的可见性字符串
 */
const getVisibilityName = (visibility: Visibility): string => {
  switch (visibility) {
    case Visibility.PUBLIC:
      return "PUBLIC";
    case Visibility.PROTECTED:
      return "PROTECTED";
    case Visibility.PRIVATE:
      return "PRIVATE";
    default:
      return "PRIVATE";
  }
};

/**
 * 从 shortcut 的 name 中提取 shortcut ID
 *
 * 示例：
 *   "users/1/shortcuts/10" -> "10"
 *
 * @param name shortcut 资源名称
 * @returns shortcut ID，如果格式不符合预期则返回空字符串
 */
const getShortcutId = (name: string): string => {
  const parts = name.split("/");
  return parts.length === 4 ? parts[3] : "";
};

export interface UseMemoFiltersOptions {
  creatorName?: string;
  includeShortcuts?: boolean;
  includePinned?: boolean;
  visibilities?: Visibility[];
}

/**
 * 根据当前上下文状态和传入参数，构建 memo 查询所需的过滤表达式
 *
 * @param options 过滤配置参数
 * @returns 过滤字符串；若无任何条件则返回 undefined
 */
export const useMemoFilters = (options: UseMemoFiltersOptions = {}): string | undefined => {
  const { creatorName, includeShortcuts = false, includePinned = false, visibilities } = options;
 // 当前登录用户下的快捷筛选列表
  const { shortcuts } = useAuth();
  // 当前激活的过滤条件和选中的 shortcut
  const { filters, shortcut: currentShortcut } = useMemoFilterContext();
  const { memoRelatedSetting } = useInstance();

    /**
   * 根据当前选中的 shortcut ID，找到对应的 shortcut 对象
   *
   * 仅在启用 includeShortcuts 时生效
   */
  const selectedShortcut = useMemo(() => {
    if (!includeShortcuts) return undefined;
    return shortcuts.find((shortcut) => getShortcutId(shortcut.name) === currentShortcut);
  }, [includeShortcuts, currentShortcut, shortcuts]);

    /**
   * 构建最终的过滤条件字符串
   *
   * 使用 useMemo：
   * - 避免在无关状态变化时重复计算
   * - 保证返回值在依赖不变时引用稳定
   */
  return useMemo(() => {
    const conditions: string[] = [];

    // Add creator filter if provided
    if (creatorName) {
      conditions.push(`creator_id == ${extractUserIdFromName(creatorName)}`);
    }

    // Add shortcut filter if enabled and selected
    if (includeShortcuts && selectedShortcut?.filter) {
      conditions.push(selectedShortcut.filter);
    }

    // Add active filters from context
    for (const filter of filters) {
      if (filter.factor === "contentSearch") {
        conditions.push(`content.contains("${filter.value}")`);
      } else if (filter.factor === "tagSearch") {
        conditions.push(`tag in ["${filter.value}"]`);
      } else if (filter.factor === "pinned") {
        if (includePinned) {
          conditions.push(`pinned`);
        }
      } else if (filter.factor === "property.hasLink") {
        conditions.push(`has_link`);
      } else if (filter.factor === "property.hasTaskList") {
        conditions.push(`has_task_list`);
      } else if (filter.factor === "property.hasCode") {
        conditions.push(`has_code`);
      } else if (filter.factor === "displayTime") {
        const displayWithUpdateTime = memoRelatedSetting?.displayWithUpdateTime ?? false;
        const factor = displayWithUpdateTime ? "updated_ts" : "created_ts";

        const filterDate = new Date(filter.value);
        const filterUtcTimestamp = filterDate.getTime() + filterDate.getTimezoneOffset() * 60 * 1000;
        const timestampAfter = filterUtcTimestamp / 1000;

        conditions.push(`${factor} >= ${timestampAfter} && ${factor} < ${timestampAfter + 60 * 60 * 24}`);
      }
    }

    // Add visibility filter if specified
    if (visibilities && visibilities.length > 0) {
      const visibilityValues = visibilities.map((v) => `"${getVisibilityName(v)}"`).join(", ");
      conditions.push(`visibility in [${visibilityValues}]`);
    }

    return conditions.length > 0 ? conditions.join(" && ") : undefined;
  }, [creatorName, includeShortcuts, includePinned, visibilities, selectedShortcut, filters, memoRelatedSetting]);
};
