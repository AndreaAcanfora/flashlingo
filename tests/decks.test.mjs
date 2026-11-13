// Every deck in the manifest loads through the app's own loader.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resetStorage } from './env.mjs';
const { loadManifest, loadDeck, levelsIn } = await import('../js/data/decks.js');
const { acceptedAnswers } = await import('../js/data/card.js');

resetStorage();
const manifest = await loadManifest();

test('manifest lists decks with unique ids', () => {
  assert.ok(manifest.length >= 6);
  assert.equal(new Set(manifest.map((d) => d.id)).size, manifest.length);
});

for (const meta of manifest) {
  test(`deck ${meta.id}`, async () => {
    const { cards } = await loadDeck(meta.id);
    assert.equal(cards.length, meta.count, 'count in decks.json matches the deck');
    assert.equal(new Set(cards.map((c) => c._id)).size, cards.length, 'ids are unique');
    for (const c of cards) {
      assert.ok(String(c.front ?? '').trim(), `${c._id}: empty front`);
      assert.ok(acceptedAnswers(c).size > 0, `${c._id}: no accepted answer`);
    }
    for (const l of levelsIn(cards)) assert.ok(l === null || /^[ABC][12]$/.test(l), `bad level ${l}`);
  });
}
