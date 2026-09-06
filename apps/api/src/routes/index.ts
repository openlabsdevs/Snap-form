import { Router } from "express";
import healthRouter from "./health";
import userAuthRouter from "./user/auth.routes";
import adminAuthRouter from "./admin/auth.routes";
import formRouter from "./form/form.routes";
import responseRouter from "./form/response.routes";
import publicRouter from "./public/public.routes";
import oauthRouter from "./user/oauth.routes";
import onboardingRouter from "./user/onboarding.routes";
import templateRouter from "./template/template.routes";
import conversationRouter from "./conversation/conversation.routes";
import { toNodeHandler } from "better-auth/node";
import { auth } from "../lib/auth";


const router: Router = Router();

router.use("/", healthRouter);

router.all("/api/auth/*", toNodeHandler(auth));

router.use("/api/v1/auth/manual", userAuthRouter);
router.use("/api/v1/auth/oauth", oauthRouter);
router.use("/api/v1/admin/auth", adminAuthRouter);
router.use("/api/v1/user/onboarding", onboardingRouter);
// NOTE: formRouter MUST be mounted before responseRouter.
// formRouter handles GET /api/v1/forms/:id/responses/export/csv — if responseRouter
// is mounted first, Express will intercept that path and return 404.
router.use("/api/v1/forms", formRouter);
router.use("/api/v1/templates", templateRouter);
router.use("/api/v1/conversations", conversationRouter);
router.use("/api/v1/forms/:id/responses", responseRouter);
router.use("/api/v1/public", publicRouter);

export default router;
