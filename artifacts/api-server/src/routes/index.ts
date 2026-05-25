import { Router, type IRouter } from "express";
import healthRouter from "./health";
import galleryRouter from "./gallery";
import bookingsRouter from "./bookings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(galleryRouter);
router.use(bookingsRouter);

export default router;
