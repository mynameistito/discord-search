/** Runtime state shared by the CLI menu and command handlers. */
export type AppState = {
  token: string | undefined;
  clientId: string | undefined;
  defaultGuildId: string | undefined;
};
