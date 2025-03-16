
import { Draggable } from "./DragAndDrop/Draggable";
import ListItem from "./ListItem";
import cryptoRandomString from "crypto-random-string";
interface ListProps {
  items?: chrome.tabs.Tab[];
  title?: string;
  id?: string;
}
export interface TagAddCard{
  id: string,
  groupId: 'none',
  href: string,
  title: string,
  favIconUrl: string,
  type: "add",
}
const List = ({ items, title }: ListProps) => {
  return (
    <div className="space-y-2 w-60 h-60 rounded bg-container pl-8">
      {title && <h2 className="text-lg font-semibold">{title}</h2>}
      <ul className="list-disc space-y-2">
        {(items ?? []).map((item, index) => {
          const key = cryptoRandomString({length: 10})
          return (
          <Draggable
            unikeyId={`Tag:${key}`}
            key={key}
            data={{
              id: key,
              groupId: 'none',
              href: item.url,
              title: item.title,
              favIconUrl: item.favIconUrl,
              type: "add",
            } as TagAddCard}
          >
            <ListItem item={item} index={index}></ListItem>
          </Draggable>
        )}) ?? (
          <div className="text-sm list-none border border-gray-200 rounded-lg p-4 bg-white hover:border-gray-300 hover:scale-[1.02] hover:-rotate-4 focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 active:scale-95 active:bg-gray-50 transition-all duration-200 cursor-pointer hover:opacity-100">
            Empty Tabs
          </div>
        )}
      </ul>
    </div>
  );
};

export default List;
