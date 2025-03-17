import {
  Active,
  Collision,
  rectIntersection,
} from "@dnd-kit/core";
import { DroppableContainer, RectMap } from "@dnd-kit/core/dist/store";
import { Coordinates, ClientRect } from "@dnd-kit/core/dist/types";
export function siCollisionDetectionAlgorithm({
  droppableContainers,
  ...args
}: {
  active: Active;
  collisionRect: ClientRect;
  droppableRects: RectMap;
  droppableContainers: DroppableContainer[];
  pointerCoordinates: Coordinates | null;
}): Collision[] {
    console.log(droppableContainers, args)
    return rectIntersection({
      ...args,
      droppableContainers: droppableContainers.filter(({ id }) => id !== args?.active?.id),
    })
  // return closestCorners({
  //   ...args,
  //   droppableContainers: droppableContainers.filter(({ id }) => id !== args?.active?.id),
  // });
}
