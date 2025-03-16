import { motion } from "motion/react";

export interface ListItemProps {
    item: Partial<{
        url: string;
        title: string;
        favIconUrl: string;
    }>;
    index: number;
}


export default function ListItem({item, index}: ListItemProps) {
  return (
    
      <motion.li
        data-isNew={1}
        data-url={item.url}
        data-title={item.title}
        data-favIconUrl={item.favIconUrl}
        data-description={""}
        key={index}
        className={`page_card_container transition-all text-sm list-none border border-gray-200 rounded-lg p-4 
          bg-white hover:border-gray-300 hover:scale-[1.02] 
          hover:-rotate-4 active:rotate-0 focus:ring-2 
          focus:ring-cyan-500 focus:ring-offset-2 active:scale-95 
          active:bg-gray-50 cursor-pointer hover:opacity-100`}
      >
        <div className="flex w-full overflow-hidden items-center space-x-3">
          <img src={item.favIconUrl} className="w-5 h-5" />
          <div className="w-[calc(100%-3.5rem)]">
            <h3 className="text-lg text-ellipsis font-medium truncate">
              {item.title}
            </h3>
          </div>
        </div>
      </motion.li>
  );
}
