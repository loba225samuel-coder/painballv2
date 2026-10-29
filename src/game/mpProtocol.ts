import type { MpEvent, MpInput, MpMode, MpPhase, SimState } from "./mpSim";

export const PROTOCOL_VERSION = 1;

export interface RoomPlayerInfo {
  id: string;
  name: string;
  slot: 0 | 1;
  color: string;
  ready: boolean;
  connected: boolean;
}

export type ClientMsg =
  | { t: "create"; v: number; name: string; mode: MpMode }
  | { t: "join"; v: number; name: string; code: string }
  | { t: "rejoin"; v: number; code: string; id: string; token: string }
  | { t: "ready"; ready: boolean }
  | { t: "start" }
  | { t: "input"; input: MpInput }
  | { t: "ping"; time: number }
  | { t: "leave" };

export type ServerMsg =
  | { t: "welcome"; id: string; token: string; code: string; mode: MpMode; slot: 0 | 1 }
  | { t: "room"; code: string; mode: MpMode; phase: MpPhase; hostId: string | null; players: RoomPlayerInfo[] }
  | { t: "snapshot"; state: SimState; events: MpEvent[]; ack: Record<string, number>; serverTime: number }
  | { t: "pong"; time: number }
  | { t: "error"; message: string; fatal?: boolean };

export function roomInfo(sim: SimState, code: string): Extract<ServerMsg, { t: "room" }> {
  return {
    t: "room",
    code,
    mode: sim.mode,
    phase: sim.phase,
    hostId: sim.hostId,
    players: sim.players.map((p) => ({
      id: p.id,
      name: p.name,
      slot: p.slot,
      color: p.color,
      ready: p.ready,
      connected: p.connected,
    })),
  };
}
