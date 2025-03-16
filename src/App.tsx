import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "./components/Button";
import { Group } from "./components/Group";
import List, { TagAddCard } from "./components/List";
import dayjs from "dayjs";
import { useVisibilityChange } from "@uidotdev/usehooks";
import Upload from "./components/Upload";
import Message from "./components/Message";
import { ExportOutlined, ImportOutlined } from "@ant-design/icons";
import Tooltip from "./components/Tooltip";
import { z } from "zod";
import { CardIdentify, useAppState } from "./store";
import Empty from "./components/Empty";
import { DndContext, MouseSensor, useSensor, useSensors } from "@dnd-kit/core";
import { siCollisionDetectionAlgorithm } from "./components/DragAndDrop/SiCollisionDetectionAlgorithm";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";

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
  href?: string;
  favIconUrl: string;
}
export default function App() {
  const [adding, setAdding] = useState(false);
  const [tabs, setTabs] = useState<chrome.tabs.Tab[]>([]);
  const [edingKey, setEditingKey] = useState<{ [key: string]: boolean }>({});
  const groups = useAppState((state) =>
    state.groups
  );
  const renderGroups = useMemo(() => {
    return groups.map((group) => {
      
      return {
        ...group,
        cards: group.cards?.toSorted((pre, val) => pre.order - val.order)
      };
    }).toSorted((pre, val) => pre?.order - val?.order)
  }, [groups])
  const groupAdd = useAppState((state) => state.groupAdd);
  const groupRemove = useAppState((state) => state.groupRemove);
  const cardRemove = useAppState((state) => state.cardRemove);
  const cardAdd = useAppState((state) => state.cardAdd);
  const cardUpdate = useAppState((state) => state.cardUpdate);
  const groupUpdate = useAppState((state) => state.groupUpdate);
  const cardOrder = useAppState((state) => state.cardOrder);
  const documentVisible = useVisibilityChange();
  const groupsRef = useRef<Groups[] | null>(renderGroups);
  useEffect(() => {
    groupsRef.current = renderGroups;
    return () => {
      groupsRef.current = null;
    };
  }, [renderGroups]);

  useEffect(() => {
    (async () => {
      if (!chrome.tabs) return;
      const tabs = await chrome.tabs.query({
        url: ["*://*/*"],
      });
      setTabs(tabs);
    })();
  }, [documentVisible]);

  const mouseSensor = useSensor(MouseSensor, {
    // Require the mouse to move by 10 pixels before activating
    activationConstraint: {
      distance: 10,
    },
  });

  const sensors = useSensors(mouseSensor);

  return (
    <DndContext
    modifiers={[restrictToWindowEdges]}
      collisionDetection={siCollisionDetectionAlgorithm}
      sensors={sensors}
      onDragEnd={(e) => {
        if ((e.collisions ?? [])?.length < 1) {
          return;
        }
        console.log(e)
        const target = Object.fromEntries(
          (e.collisions?.[0]?.id as string | undefined)
            ?.split(";")
            ?.map((temple) => temple?.split(":")) ?? []
        ) as CardIdentify;
        if (/group:.+;card:.+/.test(e?.active?.id as string)) {
          // 交换顺序,两个已存在卡片或目的地不卡片

          const source = Object.fromEntries(
            (e.active?.id as string | undefined)
              ?.split(";")
              ?.map((temple) => temple?.split(":")) ?? []
          ) as CardIdentify;
          
          cardOrder(
            {
              card: source?.card,
              group: source?.group,
            },
            {
              card: target?.card,
              group: target?.group,
            }
          );
          return;
        }
        if((e.active.data.current as unknown as TagAddCard)?.type === 'add') {
          // 未存在卡片添加至分组
          const data = e.active.data.current as unknown as TagAddCard
          cardAdd(target.group, {
            title: data.title,
            favIconUrl: data.favIconUrl,
            href: data.href,
            description: data.title
          })
          return
        }
      }}
    >
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
                          `si_home_data${dayjs().format(
                            "YYYYMMDD_HHssmm"
                          )}.json`,
                          { create: true }
                        );
                        const stream = await fileHandler.createWritable();
                        await stream.write(JSON.stringify(renderGroups));
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
                    order: renderGroups.length ?? 0,
                  });
                  setAdding(false);
                }}
              ></Group>
            )}
            {renderGroups?.length > 0 || adding ? (
              (renderGroups ?? []).map((group) => (
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
                  onEdit={(id) => {
                    if (!id) {
                      return;
                    }
                    setEditingKey({ ...edingKey, [String(id)]: true });
                  }}
                  onCancel={(id) => {
                    setEditingKey({ ...edingKey, [String(id)]: false });
                  }}
                  onCardRemove={async (group, card) => {
                    if(!group) return
                    if(!card) return
                    await cardRemove(group, card)
                  }}
                  onCardEdit={(groupId, payload) => {
                    cardUpdate(groupId, payload.id, payload)
                  }}
                  editting={edingKey[String(group.id)]}
                  key={group.id}
                  {...group}
                />
              ))
            ) : (
              <Empty
                title="No Collection Here"
                text={
                  <Button
                    onClick={() => {
                      setAdding(true);
                    }}
                  >
                    Create A Collection
                  </Button>
                }
              />
            )}
          </div>
          {(tabs ?? []).length > 0 ? (
            <div>
              <List items={tabs}></List>
            </div>
          ) : undefined}
        </div>
      </div>
    </DndContext>
  );
}
