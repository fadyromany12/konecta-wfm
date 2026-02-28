import { Router } from "express";
import { authenticateJWT, AuthRequest, requireRole } from "../../middleware/auth";
import { AuxType } from "./repository";
import { endCurrentAux, startAux, getMyAuxHistory } from "./service";

const router = Router();

router.use(authenticateJWT, requireRole(["agent", "manager", "admin"]));

router.post("/start", async (req: AuthRequest, res) => {
  const { auxType } = req.body as { auxType?: AuxType };
  if (!auxType) {
    return res.status(400).json({ error: { message: "auxType is required" } });
  }
  try {
    const aux = await startAux(req.user!.sub, auxType);
    return res.status(201).json(aux);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Start AUX failed" } });
  }
});

router.post("/end", async (req: AuthRequest, res) => {
  try {
    const aux = await endCurrentAux(req.user!.sub);
    return res.json(aux);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "End AUX failed" } });
  }
});

router.get("/me", async (req: AuthRequest, res) => {
  const { from, to } = req.query as { from?: string; to?: string };
  try {
    const history = await getMyAuxHistory(req.user!.sub, from, to);
    return res.json(history);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Fetch AUX failed" } });
  }
});

export default router;
