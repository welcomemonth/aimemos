import { timestampDate } from "@bufbuild/protobuf/wkt";
import dayjs from "dayjs";
import { useMemo } from "react";
import { useView } from "@/contexts/ViewContext";
import { State } from "@/types/proto/api/v1/common_pb";
import { Memo } from "@/types/proto/api/v1/memo_service_pb";

export interface UseMemoSortingOptions {
  pinnedFirst?: boolean;
  state?: State;
}

export interface UseMemoSortingResult {
  listSort: (memos: Memo[]) => Memo[];
  orderBy: string;
}

/**
 * 根据视图配置和传入参数，统一生成：
 * 1. 后端查询所需的 orderBy 字符串
 * 2. 前端列表展示所需的排序函数
 *
 * @param options 排序配置参数
 * @returns 排序规则及排序函数
 */
export const useMemoSorting = (options: UseMemoSortingOptions = {}): UseMemoSortingResult => {
  const { pinnedFirst = false, state = State.NORMAL } = options;
  const { orderByTimeAsc } = useView();

    /**
   * 生成用于 API 查询的 orderBy 字符串
   *
   * 排序优先级：
   * 1. pinned（如果启用）
   * 2. display_time（根据视图配置决定升/降序）
   */
  const orderBy = useMemo(() => {
    const timeOrder = orderByTimeAsc ? "display_time asc" : "display_time desc";
    return pinnedFirst ? `pinned desc, ${timeOrder}` : timeOrder;
  }, [pinnedFirst, orderByTimeAsc]);

    /**
   * 生成客户端排序函数
   *
   * 使用 useMemo 保证：
   * - 当依赖不变时，函数引用稳定
   * - 避免不必要的重新计算和渲染
   */
  const listSort = useMemo(() => {
    return (memos: Memo[]): Memo[] => {
      return memos
        .filter((memo) => memo.state === state)
        .sort((a, b) => {
          // First, sort by pinned status if enabled
          if (pinnedFirst && a.pinned !== b.pinned) {
            return b.pinned ? 1 : -1;
          }

          // Then sort by display time
          const aTime = a.displayTime ? timestampDate(a.displayTime) : undefined;
          const bTime = b.displayTime ? timestampDate(b.displayTime) : undefined;
          return orderByTimeAsc ? dayjs(aTime).unix() - dayjs(bTime).unix() : dayjs(bTime).unix() - dayjs(aTime).unix();
        });
    };
  }, [pinnedFirst, state, orderByTimeAsc]);

  return { listSort, orderBy };
};
