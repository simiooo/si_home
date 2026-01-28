import { Router } from "@oak/oak";
import { getAllData, syncConfig } from "../controllers/syncController.js";
import { incrementalSync } from "../controllers/incrementalSyncController.js";
import { processSingleOperation } from "../controllers/operationController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = new Router({ prefix: "/api/sync" });

router.use(authMiddleware);

router.get("/", getAllData);
router.post("/batch", incrementalSync);
router.post("/operation", processSingleOperation);
router.post("/config", syncConfig);

export default router;
