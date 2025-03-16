import Avatar from "./Avatar";
import Tooltip from "./Tooltip";
import { useMemo, useState } from "react";
import { Button } from "./Button";
import Modal from "./Modal";
import EditCardModal from "./EditCardModal";
import {
  CloseOutlined,
  EditOutlined,
  ShareAltOutlined,
} from "@ant-design/icons";
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
  onRemove,
  onEdit,
}: CardProps & {
  onRemove: () => void;
  onEdit: (payload: Omit<CardProps, "favIconUrl">) => void;
}) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const handleEditClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setIsEditModalOpen(true);
  };



  const handleEditModalClose = () => {
    setIsEditModalOpen(false);
  };

  
  const renderIniitData = useMemo(() => {
    return { title, favIconUrl, href, description };
  }, [title, favIconUrl, href, description]);

  return (
    
        <div
          data-id={id}
          data-url={href}
          className="page_card_container transition-all relative block group/card  p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:scale-[1.02] focus:ring-2 
      focus:ring-cyan-500 focus:ring-offset-2 active:scale-95 active:bg-gray-50  cursor-pointer hover:opacity-100 group active:shadow-2xl active:z-1"
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
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove?.()}}
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
              onSubmit={(payload) => {
                onEdit({...(payload ?? {}),id: id})
                handleEditModalClose();
              }}
            ></EditCardModal>
            
            <Modal
              title="Share Card"
              isOpen={isShareModalOpen}
              onClose={() => setIsShareModalOpen(false)}
            >
              <div
              className="flex flex-col gap-0.5"
              >
                <div className="text-3xl">{title}</div>
                <div className="text-md">{description}</div>
                {href ? <a className="text-md">{href}</a> : "No Link"}
              </div>
            </Modal>
        </div>
  );
}
