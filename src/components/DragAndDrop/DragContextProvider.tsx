import React, {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useRef,
} from "react";

interface DragContextProviderProps
  extends React.HTMLAttributes<HTMLDivElement> {
  id?: string;
}

export interface DragStateChangeTrigger<T extends HTMLElement> {
  (id: React.MouseEvent<T>): void;
}
type onDragStateChange<T extends HTMLElement> = (cb: DragStateChangeTrigger<T>) => void;
export const DraggingContext = createContext<{
  onDragStateChange?: onDragStateChange<HTMLElement>;
  dragStateChangTrigger?: DragStateChangeTrigger<HTMLElement>;
}>({});
export default function DragContextProvider({
  children,
  ...props
}: DragContextProviderProps) {
  const listenerQueue = useRef<DragStateChangeTrigger<HTMLElement>[]>([]);
  const listenerRegistor = (cb: DragStateChangeTrigger<HTMLElement>) => {
    listenerQueue.current.push(cb);
    return cb;
  };

  return (
    <DraggingContext.Provider
      {...props}
      value={{
        onDragStateChange: listenerRegistor,
        dragStateChangTrigger: (e) => {
          for (const cb of listenerQueue.current) {
            cb(e);
          }
        },
      }}
    >
      {children}
    </DraggingContext.Provider>
  );
}

export const DragContextTrigger = forwardRef(function <T extends HTMLElement>(
  {
    children,
    ...props
  }: {
    children: React.ReactElement;
  },
  ref: React.ForwardedRef<{ trigger: DragStateChangeTrigger<T> | undefined }>
) {
  const { dragStateChangTrigger } = useContext(DraggingContext);

  if (!ref) return <></>;
  if (typeof ref === "object" && ref !== null) {
    ref.current = { trigger: dragStateChangTrigger };
  }
  return React.cloneElement(children, props);
});
export function DragContextListener(p: {
  children: React.ReactElement;
  onDragStateChange: DragStateChangeTrigger<HTMLElement>;
}) {
  const { onDragStateChange } = useContext(DraggingContext);
  useEffect(() => {
    if (!onDragStateChange) {
      return;
    }
    onDragStateChange(p.onDragStateChange);
  }, []);
  return p.children;
}
