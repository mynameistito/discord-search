/** Runtime state shared by the CLI menu and command handlers. */
export interface AppState {
  token: string | undefined;
  clientId: string | undefined;
  defaultGuildId: string | undefined;
}
