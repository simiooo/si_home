import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";
import { CloseOutlined } from "@ant-design/icons";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children?: React.ReactNode;
  title?: string;
  footer?: React.ReactElement | null;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  title,
  footer,
}) => {
  const [isBrowser, setIsBrowser] = useState(false);
  const [modalContainer, setModalContainer] = useState<HTMLDivElement | null>(
    null
  );

  useEffect(() => {
    if(!isOpen) return
    setIsBrowser(typeof window !== "undefined");
    const container = document.createElement("div");
    container.setAttribute("id", "modal-root");
    document.body.appendChild(container);
    setModalContainer(container);

    return () => {
      if (container) {
        document.body.removeChild(container);
      }
    };
  }, [isOpen]);

  if (!isOpen || !isBrowser || !modalContainer) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 bg-black/20 overflow-y-auto h-full w-full z-20 "
      onClick={onClose}
    >
      <div
        className="relative top-20 mx-auto p-5  w-96 shadow-lg rounded-md bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex w-full align-bottom justify-between">
          <div className="text-lg font-semibold mb-4">{title}</div>
          <Button 
          size="sm"
          onClick={onClose} buttonType="link" className="">
            <CloseOutlined style={{fontSize: '1rem'}} />
          </Button>
        </div>

        {children}
        <div className="flex justify-end mt-4">
          {footer ? (
            footer
          ) : footer === null ? (
            <></>
          ) : (
            <Button
              onClick={onClose}
              buttonType="outline"
            >
              Close
            </Button>
          )}
        </div>
      </div>
    </div>,
    modalContainer
  );
};

export default Modal;
