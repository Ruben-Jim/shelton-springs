/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as archiver from "../archiver.js";
import type * as boardMembers from "../boardMembers.js";
import type * as communityPosts from "../communityPosts.js";
import type * as covenants from "../covenants.js";
import type * as documents from "../documents.js";
import type * as fees from "../fees.js";
import type * as fines from "../fines.js";
import type * as hoaInfo from "../hoaInfo.js";
import type * as http from "../http.js";
import type * as messages from "../messages.js";
import type * as notifications from "../notifications.js";
import type * as payments from "../payments.js";
import type * as pets from "../pets.js";
import type * as polls from "../polls.js";
import type * as residentNotifications from "../residentNotifications.js";
import type * as residents from "../residents.js";
import type * as storage from "../storage.js";
import type * as storageCleanup from "../storageCleanup.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  archiver: typeof archiver;
  boardMembers: typeof boardMembers;
  communityPosts: typeof communityPosts;
  covenants: typeof covenants;
  documents: typeof documents;
  fees: typeof fees;
  fines: typeof fines;
  hoaInfo: typeof hoaInfo;
  http: typeof http;
  messages: typeof messages;
  notifications: typeof notifications;
  payments: typeof payments;
  pets: typeof pets;
  polls: typeof polls;
  residentNotifications: typeof residentNotifications;
  residents: typeof residents;
  storage: typeof storage;
  storageCleanup: typeof storageCleanup;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
