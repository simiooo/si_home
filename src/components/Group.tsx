import { motion } from "motion/react";
import { Button } from "./Button";
import { Card, getSourceDom, isInBox } from "./Card";
import Input from "./Input";
import Modal from "./Modal";
import { useEffect, useRef, useState } from "react";
import EditCardModal from "./EditCardModal";
import { useForm } from "react-hook-form";
import { DragContextListener } from "./DragAndDrop/DragContextProvider";
import { useAppState } from "../store";
import { PageTabCard } from "../App";
export interface GroupFormValue {
  title: string;
  id: string;
}
interface GroupProps {
  title: string;
  cards?: PageTabCard[];
  onCancel?: (id?: React.Key) => void;
  onEdit?: (id?: React.Key) => void;
  onSave: (payload: GroupFormValue) => void;
  editting?: boolean;
  onDelete?: (id?: string) => void;
  onDropped?: (source?: string, target?: PageTabCard) => void;
  onDroppedByNewTab?: (source: PageTabCard, target?: string) => void;
  id?: string;
}
const DETAULT_CARD_FIELD = {};
export function Group({
  title,
  cards,
  onEdit,
  id,
  editting,
  onDelete,
  onDropped,
  onDroppedByNewTab,
  onCancel,
  onSave,
}: GroupProps) {
  const [addPageModalOpen, setAddPageModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const cardAdd = useAppState((state) => state.cardAdd);
  const cardUpdate = useAppState((state) => state.cardUpdate);
  const cardRemove = useAppState((state) => state.cardRemove);
  const { register, handleSubmit, setValue } = useForm<GroupFormValue>({
    defaultValues: {
      title,
    },
  });

  const emptyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setValue("title", title);
  }, [title]);

  return (
    <motion.div
      drag
      dragSnapToOrigin
      whileDrag={{
        position: "relative",
        zIndex: 1,
      }}
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
            <Button onClick={() => setAddPageModalOpen(true)}>Add Page</Button>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {(cards ?? []).map((card) => {
            if (!card.groupId) card.groupId = id;
            return (
              <Card
                onCardEdit={(payload) => {
                  if (!id) return;
                  if (!card.id) return;
                  cardUpdate(id, card.id, {
                    title: payload.title ?? card.title,
                    order: card.order,
                    href: payload?.href ?? card.href,
                    favIconUrl: card.favIconUrl,
                    groupId: card.groupId,
                  });
                }}
                onRemove={(cardId) => {
                  if (!id) return;
                  if (!cardId) return;
                  cardRemove(id, cardId);
                }}
                onDroppedByNewTab={(source, target) => {
                  onDroppedByNewTab?.(source, target?.id);
                }}
                onDropped={(source) => {
                  onDropped?.(source?.id, card);
                }}
                key={card.title}
                {...card}
              />
            );
          })}
        </div>
      ) : (
        <DragContextListener
          onDragStateChange={(e: React.MouseEvent<HTMLElement>) => {
            const sourceDom = getSourceDom(
              e as unknown as React.MouseEvent<HTMLElement> | undefined,
              'page_card_container'
            );
            
            if (!sourceDom) {
              return;
            }
            const draggable = (
              e?.target as unknown as HTMLDivElement
            )?.getBoundingClientRect();
            const dropable = emptyRef.current?.getBoundingClientRect();
            if (!dropable) return;
            const res = isInBox(dropable, draggable);
            if (!res.isOverlap) return;
            if (res.ratio > 0.6) {
              // success
              onDroppedByNewTab?.({
                title: sourceDom.dataset["title"] ?? "",
                id: "",
                order: 0,
                href: sourceDom.dataset["url"] ?? "",
                favIconUrl:
                  sourceDom.dataset["favIconUrl".toLocaleLowerCase()] ?? "",
              });
            }
          }}
        >
          <div
            ref={emptyRef}
            className="text-gray-500 py-8 rounded bg-gray-100 text-center w-full"
          >
            Empty now. Drag and drop to add.
          </div>
        </DragContextListener>
      )}
      <Modal
        title="Add Page"
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
            order: cards?.length ?? 0,
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
    </motion.div>
  );
}
