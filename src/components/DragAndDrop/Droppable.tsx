import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { motion } from 'motion/react';

export interface DroppableProps {
  children: React.ReactElement;
  onDropOver?: (isOver: boolean) => void;
  unikeyId?: string;
  isOverClass?: string;
}

export function Droppable(props: DroppableProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: props?.unikeyId ?? 'droppable',
  });

  React.useEffect(() => {
    props.onDropOver?.(isOver);
  }, [isOver, props.onDropOver]);

  return (
    <motion.div
      ref={setNodeRef}
      animate={{
        scale: isOver ? 1.02 : 1,
        borderColor: isOver ? '#06b6d4' : '#e5e7eb',
        backgroundColor: isOver ? '#f0fdfa' : 'transparent',
      }}
      transition={{
        duration: 0.15,
        ease: 'easeInOut'
      }}
      className={`rounded-lg border-2 border-transparent transition-all ${isOver ? props?.isOverClass ?? '' : ""}`}
    >
      {props.children}
    </motion.div>
  );
}