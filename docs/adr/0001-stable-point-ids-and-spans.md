# Control points have stable IDs and everything on the track references them

Barriers used to point at control points by array index, so every insertion, deletion, reversal or closing of the track needed bespoke code to shift indices. The upcoming features (pit lanes, timing sectors, per-span surfaces, AI lines) would each have multiplied that code. In project format v2, every control point carries a stable ID and anything laid along the track is a span between two point IDs, so inserting a point inside a span needs no maintenance and deleting one only affects spans that end on it.

Format v1 is dropped without a migration: the site had no users when v2 was introduced.
