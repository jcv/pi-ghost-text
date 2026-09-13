# Gallery assets

These files back the `image` and `video` fields in the `pi` manifest of
`package.json`, which the [pi package gallery](https://pi.dev/packages) shows as
the listing preview.

| File | Used as | Spec |
|------|---------|------|
| `social-preview.png` | `pi.image` | PNG, JPEG, GIF, or WebP |
| `demo.mp4` | `pi.video` | MP4 only (takes precedence over `image`) |

The manifest points at GitHub raw URLs under `jcv/pi-ghost-text`, so these
files only resolve once this directory is pushed to that repo:

```
https://raw.githubusercontent.com/jcv/pi-ghost-text/main/assets/social-preview.png
https://raw.githubusercontent.com/jcv/pi-ghost-text/main/assets/demo.mp4
```

If the repo is named differently or the files live elsewhere, update the
`image`/`video` URLs in `package.json` to match.

These files are intentionally **not** part of the npm tarball (the `files`
field lists only `src`); the gallery fetches them from the URL.
