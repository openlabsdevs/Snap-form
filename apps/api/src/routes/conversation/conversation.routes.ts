import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth";
import { validate } from "../../middleware/validate";
import { CreateConversationSchema, CreateMessageSchema } from "../../lib/conversation-schemas";
import { createConversation, addMessage, getConversation } from "../../controllers/conversation.controller";

const conversationRouter: Router = Router();

conversationRouter.use(requireAuth);

conversationRouter.post("/", validate(CreateConversationSchema), createConversation);
conversationRouter.post("/:id/messages", validate(CreateMessageSchema), addMessage);
conversationRouter.get("/:id", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
}, getConversation);

export default conversationRouter;
