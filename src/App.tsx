import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "./components/Button";
import { Group } from "./components/Group";
import List from "./components/List";
import dayjs from "dayjs";
import { useVisibilityChange } from "@uidotdev/usehooks";
import Upload from "./components/Upload";
import Message from "./components/Message";
import { ExportOutlined, ImportOutlined } from "@ant-design/icons";
import Tooltip from "./components/Tooltip";
import { z } from "zod";
import { useAppState } from "./store";
import Empty from "./components/Empty";

export const CardSchema = z.object({
  title: z.string().nonempty("Title is required"),
  description: z.string().max(3000).optional(),
  id: z.string().nonempty("ID is required"),
  href: z.string().optional(),
  favIconUrl: z.string().optional(),
});
export const GroupSchema = z.object({
  title: z.string().nonempty("Title is required"),
  id: z.string().nonempty("ID is required"),
  cards: z.array(CardSchema).optional(),
});
export const ConfigSchema = z.array(GroupSchema);
export interface Groups {
  title: string;
  id: string;
  cards?: PageTabCard[];
  order: number;
}
export interface PageTabCard {
  title: string;
  description?: string;
  groupId?: string;
  id: string;
  order: number;
  href: string;
  favIconUrl: string;
}
export default function App() {
  const [adding, setAdding] = useState(false);
  const [tabs, setTabs] = useState<chrome.tabs.Tab[]>([]);
  const [edingKey, setEditingKey] = useState<{ [key: string]: boolean }>({});
  const groups = useAppState((state) => state.groups);
  const groupAdd = useAppState((state) => state.groupAdd);
  const groupRemove = useAppState((state) => state.groupRemove);
  const groupUpdate = useAppState((state) => state.groupUpdate);
  const cardOrder = useAppState((state) => state.cardOrder);
  const cardAddByNewTagDrop = useAppState((state) => state.cardAddByNewTagDrop);
  const documentVisible = useVisibilityChange();
  const groupsRef = useRef<Groups[] | null>(groups);
  useEffect(() => {
    groupsRef.current = groups;
    return () => {
      groupsRef.current = null;
    };
  }, [groups]);

  const dropHandler = useCallback((sourceId?: string, target?: PageTabCard) => {
    let sourceCard: PageTabCard | undefined;
    for (const group of groupsRef.current ?? []) {
      if (sourceCard) break;
      for (const card of group.cards ?? []) {
        if (card.id === sourceId) {
          sourceCard = card;
          break;
        }
      }
    }
    if (!sourceCard) return;
    if (!target) return;
    cardOrder(sourceCard, target);
  }, []);

  useEffect(() => {
    (async () => {
      if (!chrome.tabs) return;
      const tabs = await chrome.tabs.query({
        url: ["*://*/*"],
      });
      setTabs(tabs);
    })();
  }, [documentVisible]);

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="flex justify-center gap-1">
        <div className="space-y-8 w-full max-w-7xl">
          <div className="w-full flex justify-between items-center">
            <div>
              <span className="text-2xl font-bold"></span>
            </div>
            <div className="flex gap-1">
              <Button
                buttonType="primary"
                onClick={() => {
                  setAdding(true);
                }}
              >
                Add Collection
              </Button>
              <Tooltip title="Import Config">
                <Upload content={<ImportOutlined />}></Upload>
              </Tooltip>
              <Tooltip title="Export Config">
                <Button
                  buttonType="link"
                  onClick={async () => {
                    const data = await window.showDirectoryPicker();
                    try {
                      const fileHandler = await data.getFileHandle(
                        `si_home_data${dayjs().format("YYYYMMDD_HHssmm")}.json`,
                        { create: true }
                      );
                      const stream = await fileHandler.createWritable();
                      await stream.write(JSON.stringify(groups));
                      await stream.close();
                      Message.show("Success");
                    } catch (error) {
                      console.log(error);
                      Message.show(`Error${String(error)}`, { danger: true });
                    }
                  }}
                >
                  <ExportOutlined />
                </Button>
              </Tooltip>
            </div>
          </div>
          {adding && (
            <Group
              onCancel={() => setAdding(false)}
              editting
              title={"New Collection"}
              id={""}
              cards={[]}
              onSave={(e) => {
                groupAdd({
                  title: e.title,
                  order: groups.length ?? 0,
                });
                setAdding(false);
              }}
            ></Group>
          )}
          {(groups?.length > 0 || adding) ? (groups ?? []).map((group) => (
            <Group
              onDelete={(id) => {
                if (!id) return false;
                groupRemove(id);
                return true;
              }}
              onSave={(payload) => {
                groupUpdate(group.id, { ...group, title: payload.title });
                setEditingKey({ ...edingKey, [String(group.id)]: false });
              }}
              onDroppedByNewTab={(source, targetId) => {
                const target = group.cards?.find(
                  (card) => card.id === targetId
                );
                // if (!target) return;
                cardAddByNewTagDrop(group.id, source, target);
              }}
              onDropped={dropHandler}
              onEdit={(id) => {
                if (!id) {
                  return;
                }
                setEditingKey({ ...edingKey, [String(id)]: true });
              }}
              onCancel={(id) => {
                setEditingKey({ ...edingKey, [String(id)]: false });
              }}
              editting={edingKey[String(group.id)]}
              key={group.id}
              {...group}
            />
          )) : <Empty 
          title="No Collection Here" text={<Button 
          onClick={() => {
            setAdding(true)
          }}
          >Create A Collection</Button>} />}
        </div>
        {(tabs ?? []).length > 0 ? (
          <div>
            <List items={tabs}></List>
          </div>
        ) : undefined}
      </div>
    </div>
  );
}
