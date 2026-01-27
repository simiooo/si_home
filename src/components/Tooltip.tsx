import { motion } from "motion/react";
import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
interface TooltipProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  children: React.ReactNode;
}
const Tooltip: React.FC<TooltipProps> = ({ title, description, children, className }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [isBrowser, setIsBrowser] = useState(false);
  const [modalContainer, setModalContainer] = useState<HTMLDivElement | null>(
    null
  );
  const selfContainer = useRef<HTMLDivElement | null>(null);
  const id = useId()

  useEffect(() => {
    if (!isVisible) return;
    setIsBrowser(typeof window !== "undefined");
    const container = document.createElement("div");
    container.setAttribute("id", `tooltip-root${id}`);
    document.body.appendChild(container);
    setModalContainer(container)

    return () => {
      if (container) {
        document.body.removeChild(container);
      }
    };
  }, [isVisible]);

  const timer = useRef<number | null>(null);
  const openHandler: React.MouseEventHandler<HTMLDivElement> = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if(!selfContainer.current) return;
    setRect(selfContainer?.current?.getBoundingClientRect());
    setIsVisible(true);
  };
  const closeHandler: React.MouseEventHandler<HTMLDivElement> = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    timer.current = window.setTimeout(() => {
      setIsVisible(false);
      timer.current = null;
    }, 100);
  };

  if (!isBrowser || !modalContainer) {
    return (
      <div 
      ref={selfContainer}
      className={"inline-block" + " " + className}>
        <div
          onMouseEnter={openHandler}
          onMouseLeave={closeHandler}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <div 
    ref={selfContainer}
    className={"inline-block" + " " + className}>
      <div onMouseEnter={openHandler} onMouseLeave={closeHandler}>
        {children}
      </div>
      {createPortal(
        isVisible && (
          <motion.div
            initial={{ opacity: 0, scaleY: 0, originX: 0.5, originY: 0 }}
            onMouseEnter={openHandler}
            onMouseLeave={closeHandler}
            animate={{ opacity: 1, scaleY: 1 }}
            onClick={(e) => e.stopPropagation()}
            style={{

              top: (rect?.top ?? -999) + window.scrollY + (rect?.height ?? 0),
              left:
                (rect?.left ?? -999) + window.scrollX + (rect?.width ?? 0) / 2,
            }}
            className="absolute mt-2 z-10 min-w-32 max-w-96 p-2 bg-white border border-gray-200 rounded-lg shadow-lg transform -translate-x-1/2"
          >
            <h5 className="font-semibold text-gray-800">{title}</h5>
            <p className="text-sm text-gray-600">{description}</p>
          </motion.div>
        ),
        modalContainer
      )}
    </div>
  );
};
export default Tooltip;
