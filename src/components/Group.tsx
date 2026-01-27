import { motion } from "motion/react";
import { Button } from "./Button";
import { CardProps } from "./Card";
import Input from "./Input";
import Modal from "./Modal";
import { useEffect, useRef, useState } from "react";
import EditCardModal from "./EditCardModal";
import { useForm } from "react-hook-form";
import { useAppState } from "../store";
import { PageTabCard } from "../App";
import { Droppable } from "./DragAndDrop/Droppable";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { SortableCard } from "./SortableCard";
export interface GroupFormValue {
  title: string;
  id: string;
}
export interface RemoveFormValue {
  group?: string;
  card?: string;
}
interface GroupProps {
  title: string;
  cards?: PageTabCard[];
  onCancel?: (id?: React.Key) => void;
  onEdit?: (id?: React.Key) => void;
  onSave: (payload: GroupFormValue) => void;
  editting?: boolean;
  onDelete?: (id?: string) => void;
  onCardRemove?: (group?: string, card?: string) => void;
  onCardEdit?: (groupId: string, payload: PageTabCard) => void;
  id?: string;
  activeDragCardId?: string | null;
}
const DETAULT_CARD_FIELD = {};
export function Group({
  title,
  cards,
  onEdit,
  id,
  editting,
  onDelete,
  onCancel,
  onSave,
  onCardRemove,
  onCardEdit,
  activeDragCardId,
}: GroupProps) {
  const [addPageModalOpen, setAddPageModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const cardAdd = useAppState((state) => state.cardAdd);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);

  const { register, handleSubmit, setValue } = useForm<GroupFormValue>({
    defaultValues: {
      title,
    },
  });

  const {
    register: cardRemoveRegister,
    setValue: cardRemoveSetValues,
    getValues: cardRemoveGetValues,
    reset: cardRemoveReset,
  } = useForm<RemoveFormValue>({
    defaultValues: {
      group: undefined,
      card: undefined,
    },
  });
  const cardRemoveModalClose = () => {
    setIsCloseModalOpen(false);
  };
  const cardRemoveModalOpen = (cardId: string) => {
    cardRemoveReset();
    cardRemoveSetValues("card", cardId);
    cardRemoveSetValues("group", id);
    setIsCloseModalOpen(true);
  };
  const emptyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setValue("title", title);
  }, [title]);

  return (
    <motion.div
      className="space-y-4 group p-4 rounded-lg hover:bg-gray-50 border-1 
    border-transparent hover:border hover:border-gray-200
    active:shadow-lg
    group/collectionLevel 
    "
    >
      {editting ? (
        <form onSubmit={handleSubmit(onSave)}>
          <Input
            className="hidden"
            placeholder="Collection Name"
            {...register("id")}
          ></Input>
          <div className="flex gap-2 items-center">
            <Input
              placeholder="Collection Name"
              {...register("title", { required: true, min: 4, max: 50 })}
            ></Input>
            <div className="flex gap-2">
              <Button onClick={() => onCancel?.(id)} buttonType="link">
                Cancel
              </Button>
              <Button type="submit" buttonType="primary">
                Save
              </Button>
            </div>
          </div>
        </form>
      ) : (
        <div className="flex justify-between items-center ">
          <h2 className="text-xl font-bold">{title}</h2>
          <div className="group-hover/collectionLevel:opacity-100 space-x-2 opacity-0">
            <Button onClick={() => setAddPageModalOpen(true)}>Add Card</Button>
            <Button onClick={() => onEdit?.(id)}>Edit</Button>
            <Button
              onClick={() => setDeleteModalOpen(true)}
              buttonType="outline"
            >
              Delete
            </Button>
          </div>
        </div>
      )}

      {(cards ?? []).length > 0 ? (
        <SortableContext
          items={[
            ...(cards ?? []).map(card => `group:${id};card:${card.id}`),
            ...(activeDragCardId ? [activeDragCardId] : [])
          ]}
          strategy={rectSortingStrategy}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {(cards ?? []).map((card) => {
              if (!card.groupId) card.groupId = id;
              return (
                <SortableCard
                  key={card?.id}
                  id={`group:${id};card:${card.id}`}
                  title={card.title}
                  favIconUrl={card.favIconUrl}
                  href={card.href}
                  description={card.description}
                  onRemove={() => {
                    cardRemoveModalOpen(card.id);
                  }}
                  onEdit={(payload: Omit<CardProps, "favIconUrl">) => {
                    if(!id) return
                    onCardEdit?.(id, {...payload, order: card.order, favIconUrl: card.favIconUrl})
                  }}
                />
              );
            })}
          </div>
        </SortableContext>
      ) : (
        <Droppable
          isOverClass="transition-all ring-2 ring-cyan-400 bg-cyan-50 rounded-lg"
          unikeyId={`group:${id};card:empty`}
        >
          <div
            ref={emptyRef}
            className="text-gray-500 py-16 rounded-lg bg-gray-100 text-center w-full transition-all"
          >
            Empty now. Drag and drop to add.
          </div>
        </Droppable>
      )}
      <Modal
        title="Add Card"
        onClose={() => setAddPageModalOpen(false)}
        isOpen={addPageModalOpen}
      >
        <form></form>
      </Modal>
      <EditCardModal
        isOpen={addPageModalOpen}
        title="Add Card"
        onClose={() => setAddPageModalOpen(false)}
        initialCardData={DETAULT_CARD_FIELD}
        onSubmit={(e) => {
          if (!id) return;
          cardAdd(id, {
            favIconUrl: "",
            title: e.title,
            href: e.href ?? "",

            groupId: id,
          });
          setAddPageModalOpen(false);
        }}
      ></EditCardModal>
      <Modal
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Collection"
        isOpen={deleteModalOpen}
        footer={null}
      >
        <div>Are you sure you want to delete this collection?</div>
        <div className="flex justify-end gap-2">
          <Button
            onClick={() => setDeleteModalOpen(false)}
            buttonType="outline"
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              onDelete?.(id);
              setDeleteModalOpen(false);
            }}
            buttonType="primary"
          >
            Delete
          </Button>
        </div>
      </Modal>
      <Modal
        title="Delete Card"
        isOpen={isCloseModalOpen}
        onClose={() => cardRemoveModalClose()}
        footer={
          <div>
            <Button
              onClick={() => {
                const payload = cardRemoveGetValues();
                onCardRemove?.(payload.group, payload.card);
                cardRemoveModalClose();
              }}
            >
              Remove
            </Button>
          </div>
        }
      >
        <form style={{ display: "none" }}>
          <input type="group" {...cardRemoveRegister("group")} />
          <input type="card" {...cardRemoveRegister("card")} />
        </form>
        <div>Sure To Delete?</div>
      </Modal>
    </motion.div>
  );
}
