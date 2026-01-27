import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardProps } from "./Card";

interface SortableCardProps extends CardProps {
  id: string;
  onRemove: () => void;
  onEdit: (payload: Omit<CardProps, "favIconUrl">) => void;
}

export function SortableCard({ id, onRemove, onEdit, ...props }: SortableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? "none" : (transform ? "transform 200ms cubic-bezier(0.2, 0, 0, 1)" : undefined),
    opacity: isDragging ? 0.9 : 1,
    cursor: isDragging ? "grabbing" : "grab",
    zIndex: isDragging ? 50 : 1,
    transformOrigin: "center center",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      <Card
        id={id}
        onRemove={onRemove}
        onEdit={onEdit}
        {...props}
      />
    </div>
  );
}
