import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dmxRouter from "./dmx";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dmxRouter);

export default router;
