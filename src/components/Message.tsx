import cryptoRandomString from "crypto-random-string";
import React, { HTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";

type MessageProps = {
  message: string;
  danger?: boolean;
  onClose: () => void;
} &  HTMLAttributes<HTMLDivElement>;

interface MessageComponent extends React.FC<MessageProps> {
  show: (message: string, options?: {duration?: number, danger?: boolean}) => void;
}

const Message: MessageComponent = ({ message, onClose,danger, ...props }) => {
  
  return (
    <div 
    {...props}
    className={``}>
      <div className={`bg-cyan-500 ${danger && "bg-red-500"} flex align-top scale-100 hover:scale-105 transition-all duration-200 translate-x-1/2 rounded-2xl shadow-lg text-white text-sm font-bold px-4 py-2`}>
        
        <div className="pl-2 inline-block">{message}</div>
        <button onClick={onClose} className="float-right">
          &times;
        </button>
      </div>
    </div>
  );
};
const DEFAULT_DURATION = 3000
Message.show = (message: string, options?: {duration?: number, danger?: boolean}) => {
  
  let timer: number | undefined
  const component = document.createElement("div");
  const rd = "message" + cryptoRandomString({length: 10})
  component.id = rd;
  component.className = 'message-portal';
  const root = createRoot(component)
  const close = () => {
    const component = document.querySelector(`#${rd}`);
    if (component) {
      root.unmount()
      component.remove();
    }
  };
  const topoffset = document.querySelectorAll('.message-portal').length
  document.body.appendChild(component);
  root.render(createPortal(
    <div 
    style={{
      top: topoffset * 24
    }}
    className={`fixed top-0 right-1/2 p-4 z-50 `}>
      <Message 
      onMouseEnter={() => {clearTimeout(timer); timer = undefined}}
      onMouseLeave={() => {
        if(timer) {
          clearTimeout(timer); timer = undefined
        }
        timer = setTimeout(close, options?.duration ?? DEFAULT_DURATION)
      }}
      message={message} danger={options?.danger} onClose={close} />
    </div>,
    component
  ))

  timer = setTimeout(close, options?.duration ?? DEFAULT_DURATION);
};

export default Message;
