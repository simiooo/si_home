import React, { useMemo } from 'react';
import {useDraggable} from '@dnd-kit/core';

export interface DraggableProps<T extends object & {type: "add" | "sort"}>{
    children: React.ReactElement;
    unikeyId?: string;
    data?: T
}
export function Draggable<T extends object & {type: "add" | "sort"}>(props: DraggableProps<T>) {
  const {attributes, listeners, setNodeRef, transform, isDragging} = useDraggable({
    id: props?.unikeyId ?? 'draggable',
    data: props?.data,
  attributes: {}
  });
  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;
  const isDraggingMemo = useMemo(() => {
    return isDragging
  }, [isDragging])
  
  return (
    <div ref={setNodeRef} className={`${isDraggingMemo ? 'z-10' : ''}`} style={style} {...listeners} {...attributes}>
      {props.children}
    </div>
  );
}