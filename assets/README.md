# Gallery assets

This file backs the `image` field in the `pi` manifest of `package.json`, which
the [pi package gallery](https://pi.dev/packages) shows as the listing preview.

| File | Used as | Spec |
|------|---------|------|
| `social-preview.png` | `pi.image` | PNG, JPEG, GIF, or WebP |

The manifest points at a GitHub raw URL under `jcv/pi-ghost-text`, so the file
only resolves once this directory is pushed to that repo:

```
https://raw.githubusercontent.com/jcv/pi-ghost-text/main/assets/social-preview.png
```

If the repo is named differently or the file lives elsewhere, update the `image`
URL in `package.json` to match.

This file is intentionally **not** part of the npm tarball (the `files` field
lists only `src`); the gallery fetches it from the URL.
