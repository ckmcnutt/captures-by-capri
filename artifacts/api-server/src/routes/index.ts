import { Router, type IRouter } from "express";
import healthRouter from "./health";
import galleryRouter from "./gallery";

const router: IRouter = Router();

router.use(healthRouter);
router.use(galleryRouter);

export default router;
