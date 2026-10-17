# DSH 0.2.1-rc.2 compatibility

Compared the complete official `dsh-v0.2.1-rc.1...dsh-v0.2.1-rc.2` source diff on 2026-10-17.

## Runtime changes

The release adds DeepSeek-V4.1-Flash-1017 support and its model label, plus a settings switch for the DeepSeek Search and Fetch APIs. Motion UI does not replace the model-label slot or the search-provider settings.

No changes were found in the Host tool registration APIs, Motion UI conversation/sidebar slots, or Desktop media forwarding. The existing authenticated Blob source for native Desktop playback remains necessary: the Desktop forwarder still strips Content-Length. Browser HTTP media playback remains direct.

## Adaptation

- Include DSH 0.2.1-rc.2 explicitly in compatibility and SDK peer ranges, retaining the previously supported releases.
- Pin development SDKs and resolve a clean dependency cohort against rc.2.
- Rebuild the client without changing tool contracts, rendering behavior, user settings, or model limits.

## Validation

- 148 unit/integration tests, 24 build/browser regression groups, and 18 player checks passed against the rebuilt package.
- Both installed profiles match all 211 packed files. Host import, registration of 15 tools, and derived budget calculations passed.
- Actual packaged rc.2 Desktop, using the native dsh-app origin: a 32-second film exposes its full seekable range; real pointer drags move paused playback to 22.55 seconds and playing playback to approximately 9 seconds. Decoded frame times and pixel hashes confirm the picture changes. Navigation releases the Blob source.
- Desktop settings retain the guided mode and selected visual style across navigation, reload, and normal application restart. Temporary debugging was disabled afterward.
- Main Web rc.2 after restart: guided mode and the selected bright-flat style survive navigation and reload. The historical 32-second film has one visible player. Actual play/pause/seek, volume/mute, playback rate, fullscreen, chat switching and navigation cleanup passed with no uncaught page errors.

This is a local compatibility adaptation of Motion UI 0.8.1. The existing public 0.8.1 package and tag are unchanged.

Official release: https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.1-rc.2
