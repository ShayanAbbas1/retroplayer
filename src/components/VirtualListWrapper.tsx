"use client";

import { ReactNode } from "react";
import VirtualList from "./VirtualList";

interface VirtualListWrapperProps<T> {
  items: T[];
  itemHeight: number;
  className?: string;
  renderItem: (item: T, index: number) => ReactNode;
}

export default function VirtualListWrapper<T>({
  items,
  itemHeight,
  className,
  renderItem,
}: VirtualListWrapperProps<T>) {
  return (
    <VirtualList<T> items={items} itemHeight={itemHeight} className={className}>
      {(item, index) => renderItem(item, index)}
    </VirtualList>
  );
}
