import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { ConfigSchema, Groups, PageTabCard } from "../App";
import Message from "../components/Message";
import { ZodError } from "zod";
import cryptoRandomString from "crypto-random-string";
import { ConfigStorage } from "../utils/storage";
export interface CardIdentify {
  card: string;
  group: string;
}
interface AppState {
  groups: Groups[];
  refresh: () => Promise<void>;
  groupUpdate: (groupId: string, payload: Omit<Groups, "id" | "cards">) => void;
  groupRemove: (groupId: string) => void;
  groupAdd: (payload: Omit<Groups, "id">) => void;
  cardAddByNewTagDrop: (
    groupId: string,
    payload: Omit<PageTabCard, "id">,
    target?: PageTabCard
  ) => void;
  cardUpdate: (
    groupId: string,
    cardId: string,
    payload: Omit<PageTabCard, "id">
  ) => void;
  cardAdd: (
    groupId: string,
    payload: Omit<PageTabCard, "id" | "order">,
    order?: number
  ) => void;
  cardRemove: (groupId: string, cardId: string) => void;
  cardOrder: (source: CardIdentify, target: CardIdentify) => void;
}

export const useAppState = create(
  subscribeWithSelector<AppState>((set, get) => ({
    groups: [],
    refresh: async () => {
      const groups = (await ConfigStorage.get("tabData"))?.tabData ?? [];
      set({ groups });
    },
    groupUpdate: (groupId: string, payload: Omit<Groups, "id" | "cards">) => {
      const groups = get().groups;
      set({
        groups: groups.map((el) =>
          el.id === groupId ? { ...payload, id: el.id, cards: el.cards } : el
        ),
      });
    },
    groupRemove: (groupId: string) => {
      const groups = get().groups;
      set({ groups: groups.filter((group) => group.id !== groupId) });
    },
    groupAdd: (payload: Omit<Groups, "id">) => {
      const groups = get().groups;
      set({
        groups: [
          { ...payload, id: cryptoRandomString({ length: 10 }) },
          ...groups,
        ],
      });
    },
    cardUpdate: (
      //不改变顺序
      groupId: string,
      cardId: string,
      payload: Omit<PageTabCard, "id">
    ) => {
      const groups = get().groups;
      set({
        groups: groups.map((group) =>
          group.id === groupId
            ? {
                ...group,
                cards: (group.cards ?? []).map((card) =>
                  card.id === cardId ? { ...payload, id: card.id } : card
                ),
              }
            : group
        ),
      });
    },
    cardAdd: (
      groupId: string,
      payload: Omit<PageTabCard, "id" | "order">,
      order?: number
    ) => {
      const groups = get().groups;
      set({
        groups: groups.map((group, i, thisArr) =>
          group.id === groupId
            ? {
                ...group,
                cards: [
                  {
                    ...payload,
                    id: cryptoRandomString({ length: 10 }),
                    groupId,
                    order:
                      order ??
                      (thisArr?.reduce?.(
                        (pre, val) => Math.max(pre, val.order),
                        Number.MIN_SAFE_INTEGER
                      ) ?? 0) + 1,
                  },
                  ...(group.cards ?? []),
                ],
              }
            : group
        ),
      });
    },
    cardAddByNewTagDrop: (
      groupId: string,
      payload: Omit<PageTabCard, "id">,
      target?: PageTabCard
    ) => {
      // 拖拽添加卡片
      const groups = get().groups;
      const newCard = {
        ...payload,
        id: cryptoRandomString({ length: 10 }),
        groupId,
      };
      if (!target) {
        set({
          groups: groups.map((group) =>
            group.id === groupId
              ? {
                  ...group,
                  cards: (group.cards ?? []).concat([newCard]),
                }
              : group
          ),
        });
        return;
      }
      set({
        groups: groups.map((group) =>
          group.id === groupId
            ? {
                ...group,
                cards: (group.cards ?? []).reduce<PageTabCard[]>(
                  (pre, card) =>
                    card.id === target.id
                      ? [...pre, newCard, card]
                      : [...pre, card],
                  []
                ),
              }
            : group
        ),
      });
    },
    cardRemove: (groupId: string, cardId: string) => {
      const groups = get().groups;
      set({
        groups: groups.map((group) =>
          group.id === groupId
            ? {
                ...group,
                cards: (group.cards ?? []).filter((card) => card.id !== cardId),
              }
            : group
        ),
      });
    },
    cardOrder: (source: CardIdentify, target: CardIdentify) => {
      // 拖拽卡片位置

      const groups = get().groups;
      let sourceGroup: Groups | undefined;
      let targetGroup: Groups | undefined;
      let sourceCard: PageTabCard | undefined;
      let targetCard: PageTabCard | undefined;
      let sourceCardIndex: number | undefined;
      let targetCardIndex: number | undefined;
      for (const group of groups) {
        if (group.id === source?.group) {
          sourceGroup = group;

          group.cards?.forEach((card, index) => {
            if (card?.id === source?.card) {
              sourceCardIndex = index;
              sourceCard = card;
            }
            return;
          });
        }
        if (group.id === target?.group) {
          targetGroup = group;
          group.cards?.forEach((card, index) => {
            if (card?.id === target?.card) {
              targetCardIndex = index;
              targetCard = card;
            }
            return;
          });
        }
      }
      if (!sourceCard) {
        return;
      }
      
      if(target?.card === 'empty') {
        
        if(typeof sourceCardIndex === 'number') {
          sourceGroup?.cards?.splice(sourceCardIndex, 1);
          targetGroup?.cards?.push({
            ...sourceCard,
            groupId: target.group,
            order: Number.MIN_SAFE_INTEGER
          });
          set({
            groups: [...groups],
          });
        }
        return
      }
      if (!targetCard) {
        return;
      }
      const tempOrder: number | undefined = sourceCard?.order;
      sourceCard.order = targetCard?.order;
      targetCard.order = tempOrder;
      if (sourceGroup != targetGroup && sourceCardIndex && targetCardIndex) {
        sourceGroup?.cards?.splice(sourceCardIndex, 1, targetCard);
        targetGroup?.cards?.splice(targetCardIndex, 1, sourceCard);
      }
      set({
        groups: [...groups],
      });
    },
  }))
);
(async () => {
  const groupsData = await ConfigStorage.get("tabData");
  const groups = groupsData?.tabData as Groups[];
  groups.forEach((group, index) => {
    if (typeof group.order !== "number") {
      group.order = index;
    }
    group?.cards?.forEach((card, cardI) => {
      if (typeof card.order !== "number") {
        card.order = cardI;
      }
    });
  });
  useAppState.setState({ groups: groups ?? [] });
})();
useAppState.subscribe(
  (state) => state.groups,
  async (groups) => {
    try {
      ConfigSchema.parse(groups);
      await ConfigStorage.save({ tabData: groups });
    } catch (error: unknown | ZodError) {
      console.error(error);
      if (error instanceof ZodError) {
        error.errors.map((error) => {
          Message.show(String(error.path.pop() + error.message), {
            danger: true,
          });
        });
      } else {
        Message.show(String(error), { danger: true });
      }
    }
  }
);
