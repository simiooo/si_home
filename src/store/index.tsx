import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { ConfigSchema, Groups, PageTabCard } from "../App";
import Message from "../components/Message";
import { ZodError } from "zod";
interface AppState {
  groups: Groups[];
  refresh: () => Promise<void>
  groupUpdate: (groupId: string, payload: Omit<Groups, "id" | "cards">) => void;
  groupRemove: (groupId: string) => void;
  groupAdd: (payload: Omit<Groups, "id">) => void;
  cardAddByNewTagDrop: (groupId: string, payload: Omit<PageTabCard, "id">,target?:PageTabCard,) => void;
  cardUpdate: (
    groupId: string,
    cardId: string,
    payload: Omit<PageTabCard, "id">
  ) => void;
  cardAdd: (groupId: string, payload: Omit<PageTabCard, "id">) => void;
  cardRemove: (groupId: string, cardId: string) => void;
  cardOrder: (source: PageTabCard, target: PageTabCard) => void;
}

export const useAppState = create(
  subscribeWithSelector<AppState>((set, get) => ({
    groups: [],
    refresh: async () => {
      if (!chrome.storage) return;
      const groups = (await chrome.storage.local.get("tabData"))?.tabData ?? [];
      set({groups})
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
      set({ groups: [{ ...payload, id: crypto.randomUUID() }, ...groups] });
    },
    cardUpdate: (
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
    cardAdd: (groupId: string, payload: Omit<PageTabCard, "id">) => {
      const groups = get().groups;
      set({
        groups: groups.map((group) =>
          group.id === groupId
            ? {
                ...group,
                cards: [
                  { ...payload, id: crypto.randomUUID(),groupId },
                  ...(group.cards ?? []),
                ],
              }
            : group
        ),
      });
    },
    cardAddByNewTagDrop: (groupId: string, payload: Omit<PageTabCard, "id">, target?:PageTabCard,) => {
        const groups = get().groups;
        const newCard=  { ...payload, id: crypto.randomUUID(),groupId }
        if(!target) {
          set({
            groups: groups.map((group) =>
              group.id === groupId
                ? {
                    ...group,
                    cards: (group.cards ?? []).concat([newCard]),
                  }
                : group
            ),
          })
          return 
        }
        set({
          groups: groups.map((group) =>
            group.id === groupId
              ? {
                  ...group,
                  cards: (group.cards ?? []).reduce<PageTabCard[]>((pre, card) => card.id === target.id ?[...pre,newCard,card] :[...pre,card],[]),
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
    cardOrder: (source: PageTabCard, target: PageTabCard) => {
      if (source === target) return;

      const groups = get().groups;
      const sourceGroup = groups.find((el) => el.id === source.groupId);
      const targetGroup = groups.find((el) => el.id === target.groupId);
      if (sourceGroup === targetGroup) {
        const cards = sourceGroup?.cards ?? [];

        const targetIndex = cards.findIndex((card) => card.id === target.id);
        const sourceIndex = cards.findIndex((card) => card.id === source.id);
        cards.splice(targetIndex, 1, source);
        cards.splice(sourceIndex, 1, target);
        set({
          groups: [...groups],
        });
        return;
      }
      if (!sourceGroup) return;
      if (!targetGroup) return;
      const finalSourceGroup = (sourceGroup?.cards ?? []).map((card) =>
        card.id === source.id ? { ...target, groupId: card.groupId } : card
      );
      const finalTargetGroup = (targetGroup?.cards ?? []).map((card) =>
        card.id === target.id ? { ...source, groupId: card.groupId } : card
      );
      const sourceIndex = groups.findIndex(
        (group) => group.id === sourceGroup?.id
      );
      const targetIndex = groups.findIndex(
        (group) => group.id === targetGroup?.id
      );
      groups.splice(sourceIndex, 1, {
        ...sourceGroup,
        cards: finalSourceGroup,
      });
      groups.splice(targetIndex, 1, {
        ...targetGroup,
        cards: finalTargetGroup,
      });
      set({
        groups: [...groups],
      });
    },
  }))
);
(async () => {
  if (!chrome.storage) return;
  const groups = await chrome.storage.local.get("tabData");
  useAppState.setState({ groups: groups.tabData ?? [] });
})();
useAppState.subscribe(
  (state) => state.groups,
  async (groups) => {
    try {
      if (!chrome.storage) throw Error("Not in Chrome Extension");
      ConfigSchema.parse(groups);
      await chrome.storage.local.set({ tabData: groups });
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
