import Avatar from "./Avatar";
import Tooltip from "./Tooltip";
import { motion, useAnimation } from "motion/react";
import { useMemo, useRef, useState } from "react";
import { Button } from "./Button";
import Modal from "./Modal";
import EditCardModal from "./EditCardModal";
import {
  CloseOutlined,
  EditOutlined,
  ShareAltOutlined,
} from "@ant-design/icons";
import {
  DragContextListener,
  DragContextTrigger,
  DragStateChangeTrigger,
} from "./DragAndDrop/DragContextProvider";
import { PageTabCard } from "../App";
export interface CardProps {
  id: string;
  title: string;
  favIconUrl?: string;
  href?: string;
  description?: string;
}

export function getSourceDom<T>(e?: React.MouseEvent<T>, className?: string) {
  let sourceDom = e?.target as unknown as HTMLElement | null;
  while (
    sourceDom &&
    sourceDom.className.indexOf(className ?? "page_card_container") === -1
  ) {
    sourceDom = sourceDom.parentElement;
  }
  if (!sourceDom) {
    return;
  }
  return sourceDom
};
export const isInBox = (target: DOMRect, box: DOMRect) => {
  const isOverlap =
    target.x < box.x + box.width &&
    box.x < target.x + target.width &&
    target.y < box.y + box.height &&
    box.y < target.height + target.y;
  if (!isOverlap) return { isOverlap };
  const width =
    Math.min(target.x + target.width, box.x + box.width) -
    Math.max(target.x, box.x);
  const height =
    Math.min(target.y + target.height, box.y + box.height) -
    Math.max(target.height, box.y);
  const area = width * height;
  const minBoxArea = Math.min(
    target.width * target.height,
    box.height * box.width
  );
  return { isOverlap, ratio: Math.abs(area / minBoxArea) };
};
export function Card({
  title,
  favIconUrl,
  description,
  href,
  id,
  onDropped,
  onDroppedByNewTab,
  onRemove,
  onCardEdit,
}: CardProps & {
  onRemove: (id?: string) => void;
  onDropped?: (source: { id?: string }, target: { id?: string }) => void;
  onDroppedByNewTab?: (source: PageTabCard, target: { id?: string }) => void;
  onCardEdit?: (payload: Omit<CardProps, "favIconUrl">) => void;
}) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const handleEditClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setIsEditModalOpen(true);
  };
  const controls = useAnimation();

  const handleCloseClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setIsCloseModalOpen(true);
  };

  const handleEditModalClose = () => {
    setIsEditModalOpen(false);
  };

  const handleCloseModalClose = () => {
    setIsCloseModalOpen(false);
  };
  const [dragging, setDragging] = useState(false);

  const ref = useRef<{ trigger: DragStateChangeTrigger<HTMLElement> }>(null);
  const self = useRef<HTMLDivElement>(null);
  const renderIniitData = useMemo(() => {
    return { title, favIconUrl, href, description };
  }, [title, favIconUrl, href, description]);

  return (
    <DragContextTrigger ref={ref}>
      <DragContextListener
        onDragStateChange={(e: React.MouseEvent<HTMLElement>) => {
          const sourceDom = getSourceDom(e as unknown as React.MouseEvent<HTMLElement> | undefined)
          if (!sourceDom) {
            return;
          }

          const draggable = sourceDom?.getBoundingClientRect();
          const dropable = self.current?.getBoundingClientRect();
          if (!dropable) return;
          const res = isInBox(dropable, draggable);
          if (!res.isOverlap) return;
          const source = {
            id: sourceDom?.dataset["id"],
          };
          const target = {
            id: self.current?.dataset["id"],
          };
          if (target.id !== source.id && res.ratio > 0.6) {
            const isNew = sourceDom.dataset["isnew"];
            if (isNew === "1") {
              const source = {
                title: sourceDom.dataset["title"] ?? "",
                id: "",
                order: 0,
                href: sourceDom.dataset["url"] ?? "",
                favIconUrl:
                  sourceDom.dataset["favIconUrl".toLocaleLowerCase()] ?? "",
              }
              const cardDropEvent = new CustomEvent('cardDropByNewTab', {
                detail: {
                  source,
                  target
                },
                bubbles: true,
                cancelable: true
              });
              self.current?.dispatchEvent(cardDropEvent);
              onDroppedByNewTab?.(
                source,
                target
              );
              return;
            }
            // 创建自定义事件
            const cardDropEvent = new CustomEvent('cardDrop', {
              detail: {
                source,
                target
              },
              bubbles: true,
              cancelable: true
            });

            // 触发自定义事件
            self.current?.dispatchEvent(cardDropEvent);
            onDropped?.(source, target);
          }
        }}
      >
        <motion.div
          data-id={id}
          data-url={href}
          className="page_card_container relative"
          ref={self}
          whileDrag={{ zIndex: 1 }}
          animate={controls}
          drag
          dragMomentum={false}
          onClick={(e) => {
            if (dragging) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }
          }}
          onDragStart={() => {
            setDragging(true);
          }}
          onDragEnd={async (e) => {
            ref?.current?.trigger(
              e as unknown as React.MouseEvent<HTMLElement>
            );
            setDragging(false);
            controls.set({ opacity: 1, x: 0, y: 0 });
          }}
        >
          <motion.a
            draggable={false}
            href={href}
            target="_blank"
            className={` block group/card  p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:scale-[1.02] focus:ring-2 
      focus:ring-cyan-500 focus:ring-offset-2 active:scale-95 active:bg-gray-50 ${dragging ? "transition-none" : "transition-all duration-200"
              }  cursor-pointer hover:opacity-100 group`}
          >
            <div className="flex w-full overflow-hidden items-center space-x-3">
              <Avatar src={favIconUrl} />
              <div className="w-[calc(100%-3.5rem)]">
                <Tooltip
                  className="w-full"
                  title={title}
                  description={description}
                >
                  <h3 className="text-lg text-ellipsis font-medium truncate">
                    {title}
                  </h3>
                </Tooltip>

                <p className="text-sm text-ellipsis text-gray-500 truncate">
                  {description || title}
                </p>
              </div>
            </div>
            <div className="absolute -top-2 -right-2 opacity-0 group-hover/card:opacity-100 transition-opacity">
              <button
                onClick={handleCloseClick}
                className="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-1.5 rounded-full text-xs"
              >
                <CloseOutlined />
              </button>
            </div>
            <div className="relative button-container">
              <div className="absolute top-1 w-full opacity-0 group-hover/card:opacity-100 flex space-x-2">
                <div className="grow"></div>
                <Tooltip title="Edit Card">
                  <Button
                    size="sm"
                    onClick={handleEditClick}
                    buttonType="primary"
                  >
                    <EditOutlined />
                  </Button>
                </Tooltip>
                <Tooltip title="Share Card">
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setIsShareModalOpen(true);
                    }}
                    buttonType="outline"
                  >
                    <ShareAltOutlined />
                  </Button>
                </Tooltip>
              </div>
            </div>

            <EditCardModal
              isOpen={isEditModalOpen}
              title="Card Edit"
              onClose={handleEditModalClose}
              initialCardData={renderIniitData}
              onSubmit={(e) => {
                onCardEdit?.(e);
                handleEditModalClose();
              }}
            ></EditCardModal>
            <Modal
              title="Delete Card"
              isOpen={isCloseModalOpen}
              onClose={handleCloseModalClose}
              footer={
                <div>
                  <Button
                    onClick={() => {
                      onRemove?.(id);
                      handleCloseModalClose();
                    }}
                  >
                    Remove
                  </Button>
                </div>
              }
            >
              <div>Sure To Delete?</div>
            </Modal>
            <Modal
              title="Share Card"
              isOpen={isShareModalOpen}
              onClose={() => setIsShareModalOpen(false)}
            >
              <div>Share Modal Content</div>
            </Modal>
          </motion.a>
        </motion.div>
      </DragContextListener>
    </DragContextTrigger>
  );
}
