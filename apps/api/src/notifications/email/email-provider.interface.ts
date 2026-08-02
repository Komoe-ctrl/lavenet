// Every external email integration (a real one, eventually) implements
// this. CLAUDE.md §11: no integration may require an API key to run the
// demo, so SandboxEmailProvider is the default binding (see
// notifications.module.ts) until a real one exists.
export interface EmailProvider {
  send(to: string, subject: string, body: string): Promise<void>;
}

export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');
