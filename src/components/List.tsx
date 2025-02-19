import ListItem from "./ListItem";

interface ListProps {
  items?: chrome.tabs.Tab[];
  title?: string;
  id?: string;
}

const List = ({ items, title }: ListProps) => {
  
  return (
    <div className="space-y-2 w-60 h-60 rounded bg-container pl-8">
      {title && <h2 className="text-lg font-semibold">{title}</h2>}
      <ul className="list-disc space-y-2">
        {(items ?? []).map((item, index) => (
          <ListItem
          item={item}
          index={index}
          ></ListItem>
        )) ?? (
          <div className="text-sm list-none border border-gray-200 rounded-lg p-4 bg-white hover:border-gray-300 hover:scale-[1.02] hover:-rotate-4 focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 active:scale-95 active:bg-gray-50 transition-all duration-200 cursor-pointer hover:opacity-100">
            Empty Tabs
          </div>
        )}
      </ul>
    </div>
  );
};

export default List;
