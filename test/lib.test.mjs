import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { hashToken, parseCookies, cookie, OWNER_ACTIONS, verifyStripeSignature } from "../src/lib.mjs";

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

test("Stripe signature verifier accepts current valid signature", () => {
  const secret = "whsec_test";
  const payload = '{"id":"evt_test"}';
  const timestamp = 1700000000;
  const signature = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  assert.equal(
    verifyStripeSignature(payload, `t=${timestamp},v1=${signature}`, secret, timestamp * 1000),
    true
  );
});

test("Stripe signature verifier rejects expired signature", () => {
  const secret = "whsec_test";
  const payload = '{"id":"evt_test"}';
  const timestamp = 1700000000;
  const signature = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  assert.equal(
    verifyStripeSignature(payload, `t=${timestamp},v1=${signature}`, secret, (timestamp + 301) * 1000),
    false
  );
});
