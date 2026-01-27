import React from 'react';
import { useDraggable } from '@dnd-kit/core';

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
  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition: isDragging ? "none" : "transform 200ms cubic-bezier(0.2, 0, 0, 1)",
    opacity: isDragging ? 0.9 : 1,
    cursor: isDragging ? "grabbing" : "grab",
    zIndex: isDragging ? 9999 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
    >
      {props.children}
    </div>
  );
}
