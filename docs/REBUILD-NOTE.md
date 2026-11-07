# Rebuild note — read before you trust the provenance of this repo

**Pack 00 arrived. Packs 01–06 did not.**

This repository was recreated from [`HANDOFF-00-CONTEXT.md`](HANDOFF-00-CONTEXT.md)
(the project's own context, decision-log and acceptance-test document), not copied from
the original source packs. The handoff asks the receiving agent to "recreate the
repository from code packs 01–06" — those files were never attached to the session and
do not exist in the workspace, and no `organichy-source.zip` was present either. The
checkout it started from contained one file: a 10-byte `README.md`.

So this is a **specification-faithful reconstruction**, not the byte-identical original.

## What is guaranteed

Every externally observable contract named in Pack 00 is implemented and verified by
`npm test` (60 checks):

- the 19 acceptance URLs from §8 return `200`;
- `POST /api/cart/price` with the §8 payload returns exactly `subtotal 1098,
  discount 110, shippingFee 0, codFee 29, total 1017`;
- `POST /api/admin/login` with `organichy@2026` returns `{"ok":true,"token":"…"}`;
- the §5 repository layout, file names and the file-level responsibilities in it;
- the §2 feature inventory, the §4 configuration table, the coupon definitions,
  ₹899 / ₹49 / ₹29 pricing rules, the 14 pages + confirmation + admin + 404,
  the JSON-LD set, the motion inventory, and "zero npm dependencies on Node 18+".

## What may differ from the original (and does not matter operationally)

- Internal naming, comment text, copy wording and section ordering inside views.
- Exact CSS class names where Pack 00 did not dictate them.
- The seed demo data (product names/prices follow the §8 test vectors — `p-creamy`
  500 g at ₹549 is required by the acceptance test — but the surrounding marketing copy
  is newly written).
- Binary assets in §6 could not be copied from a zip that does not exist, so
  `public/images/*.png` are **newly generated stand-ins** (jar photography + lifestyle +
  farm shot). They must still be replaced with the brand's real photos before launch,
  exactly as §3 note 3 already said.

## If the original packs turn up later

Overlay them file-for-file; the routes, `lib/pricing.js` contract and the JSON shapes in
`lib/db.js` were kept to the documented behaviour, so a drop-in swap should need no
route changes. Then re-run `npm test` — it encodes §8, so it is the arbiter of whether
the original and this rebuild agree.
