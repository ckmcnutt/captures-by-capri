import { Router } from "express";
import calRouter from "./cal";
import stripeRouter from "./stripe";

const router = Router();

// Both of these are authenticated by request signature, not by session, and both
// need the raw body — see the express.raw mounts in app.ts.
router.use(stripeRouter);
router.use(calRouter);

export default router;
