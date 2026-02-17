export interface MatrixClientLike {
  sendText(roomId: string, text: string): Promise<string>;
  getRoomStateEvent(
    roomId: string,
    eventType: string,
    stateKey: string,
  ): Promise<Record<string, unknown>>;
  getRoomState(roomId: string): Promise<Record<string, unknown>[]>;
}
