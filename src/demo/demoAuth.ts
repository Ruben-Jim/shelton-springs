import { DEMO_BOARD_ID, DEMO_LOGIN_ACCOUNTS } from './fixtures/initialSnapshot';

/**
 * Matches email + password against DEMO_LOGIN_ACCOUNTS.
 * Also accepts the raw synthetic _id (DEMO_BOARD_ID) in the email field so
 * testers can paste the id without knowing the email address.
 */
export function authenticateDemoUser(emailOrId: string, password: string): any | null {
  const raw = emailOrId.trim();
  const asLower = raw.toLowerCase();

  // Allow synthetic board id as an alias for the board email
  if (asLower === DEMO_BOARD_ID.toLowerCase()) {
    for (const row of DEMO_LOGIN_ACCOUNTS) {
      if (String(row.user?._id) === DEMO_BOARD_ID && row.password === password) {
        return { ...row.user };
      }
    }
    return null;
  }

  for (const row of DEMO_LOGIN_ACCOUNTS) {
    if (row.email.toLowerCase() === asLower && row.password === password) {
      return { ...row.user };
    }
  }
  return null;
}
