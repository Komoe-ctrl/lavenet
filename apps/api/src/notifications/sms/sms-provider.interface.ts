// Every external SMS integration (a real one, eventually -- Orange Money's
// SMS gateway or similar) implements this. CLAUDE.md §11: no integration
// may require an API key to run the demo, so SandboxSmsProvider is the
// default binding (see notifications.module.ts) until a real one exists.
export interface SmsProvider {
  send(phone: string, message: string): Promise<void>;
}

export const SMS_PROVIDER = Symbol('SMS_PROVIDER');
