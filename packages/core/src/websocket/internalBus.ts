import { EventEmitter } from "node:events";

export type InternalEvent =
  | { type: "audit.created"; payload: unknown }
  | { type: "ticket.updated"; payload: unknown }
  | { type: "security.alert"; payload: unknown };

export const internalBus = new EventEmitter();

export function publish(event: InternalEvent) {
  internalBus.emit(event.type, event.payload);
}
