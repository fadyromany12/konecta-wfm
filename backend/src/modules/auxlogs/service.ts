import {
  AuxLog,
  AuxType,
  closeAux,
  countAuxTypeToday,
  createAux,
  getAuxHistoryForUser,
  getOpenAuxForUser,
  isOncePerDayType,
} from "./repository";

const BREAK_LIMIT_MINUTES = Number(process.env.BREAK_LIMIT_MINUTES || 15);
const LUNCH_LIMIT_MINUTES = Number(process.env.LUNCH_LIMIT_MINUTES || 60);

function getLimitMinutesForType(auxType: AuxType): number | null {
  switch (auxType) {
    case "break":
    case "last_break":
      return BREAK_LIMIT_MINUTES;
    case "lunch":
      return LUNCH_LIMIT_MINUTES;
    default:
      return null;
  }
}

export async function startAux(userId: string, auxType: AuxType): Promise<AuxLog> {
  const now = new Date();
  if (isOncePerDayType(auxType)) {
    const count = await countAuxTypeToday(userId, auxType);
    if (count >= 1) {
      throw new Error(`You can only take one ${auxType.replace("_", " ")} per day.`);
    }
  }
  const open = await getOpenAuxForUser(userId);
  if (open) {
    const start = new Date(open.start_time);
    const seconds = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 1000));
    const limitMinutes = getLimitMinutesForType(open.aux_type);
    const overLimit = !!limitMinutes && seconds > limitMinutes * 60;
    await closeAux({
      id: open.id,
      end: now,
      durationSeconds: seconds,
      overLimit,
    });
  }
  return createAux(userId, auxType, now);
}

export async function endCurrentAux(userId: string): Promise<AuxLog> {
  const now = new Date();
  const open = await getOpenAuxForUser(userId);
  if (!open) throw new Error("No active AUX status.");
  const start = new Date(open.start_time);
  const seconds = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 1000));
  const limitMinutes = getLimitMinutesForType(open.aux_type);
  const overLimit = !!limitMinutes && seconds > limitMinutes * 60;
  return closeAux({
    id: open.id,
    end: now,
    durationSeconds: seconds,
    overLimit,
  });
}

export async function getMyAuxHistory(userId: string, from?: string, to?: string) {
  return getAuxHistoryForUser(userId, from, to);
}
