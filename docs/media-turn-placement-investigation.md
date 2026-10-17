# Historical movies at the next reply tail

Reproduced on the main Web using session `session-64fe062e-fc15-4ffb-ae54-2ddbea335506`.

Two independent causes:

- rc.2 folds both individual flow items and their process group. The independent media mount skipped the outer fold's parent, which is the shared `conversation.chat.flow` slot. The resulting host sat after the entire flow, so new replies appeared before historical movies.
- Three rendered segments (10, 11, 15 seconds) were consumed by one successful 36-second process result. History retained all four as independent deliveries.

The mount now sits immediately after the outermost folded group, within the original turn's flow. With no fold it follows its turn item. Existing DOM relocation preserves media identity/playback. Completed process results retain only validated UUID input references; the player omits those constituent clips once their completed edit exists. Original records remain available for source-canvas ownership. Unrelated films are retained; no title, duration or filename similarity guessing is used.

Verification: unit lineage/independent-film cases; actual browser nested-fold/new-turn and unfold regression; real Web session displays exactly the 36-second final movie before turn 3, seeks to 20 seconds, and reloads with exactly one player. Desktop was not installed, restarted or modified. Public version remains 0.8.3; this is a local Web fix build.
