import test from "node:test";
import assert from "node:assert/strict";
import { hashToken, parseCookies, cookie, OWNER_ACTIONS } from "../src/lib.mjs";

test("hashToken is deterministic SHA-256", () => {
  assert.equal(hashToken("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("parseCookies extracts values", () => {
  assert.deepEqual(parseCookies("a=1; sl_workspace=abc%20123"), { a:"1", sl_workspace:"abc 123" });
});

test("workspace cookie is hardened", () => {
  const value = cookie("sl_workspace","x",{secure:true});
  assert.match(value,/HttpOnly/);
  assert.match(value,/SameSite=Lax/);
  assert.match(value,/Secure/);
});

test("owner actions do not expose review decision RPCs", () => {
  assert.equal(OWNER_ACTIONS.has("decision"), false);
  assert.equal(OWNER_ACTIONS.has("review"), false);
  assert.equal(OWNER_ACTIONS.has("share"), true);
});
