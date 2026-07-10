/**
 * Stale-write (optimistic-concurrency) conflict helper.
 *
 * The backend guards every stage-advance write: if the row was already processed or
 * moved by another user (a stale/phantom record on this screen), the API responds
 * with HTTP 409 and a body carrying `code: "STALE_WRITE"`. The api-service `request()`
 * helper throws that body on non-ok responses, so callers see `err.code`.
 *
 * When this happens the correct UX is: tell the user the row was already handled, and
 * refetch that stage's pending list so the phantom row disappears without a full reload.
 */
export const STALE_WRITE_CODE = "STALE_WRITE"

export function isStaleWriteError(err: any): boolean {
  return err?.code === STALE_WRITE_CODE
}
