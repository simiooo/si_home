import React from 'react';
import {useDroppable} from '@dnd-kit/core';

export interface DroppableProps{
    children: React.ReactElement;
    onDropOver?: (isOver: boolean) => void;
    unikeyId?: string;
    isOverClass?: string;
}

export function Droppable(props: DroppableProps) {
  const {isOver, setNodeRef, } = useDroppable({
    id: props?.unikeyId ?? 'droppable',
  });
  
  return (
    <div ref={setNodeRef} className={` ${isOver ? props?.isOverClass ?? '' : ""}`} >
      {props.children}
    </div>
  );
}