# MineAtlas Standalone

MineAtlas is a fully static, English-language Minecraft discovery catalog designed for Cloudflare Pages. The project catalog is bundled locally, so the deployed website does not query Modrinth, CurseForge, a database, or any external API.

## Deploy to Cloudflare Pages

1. Keep every file and folder in this directory.
2. Create a Cloudflare Pages project and choose **Direct Upload**.
3. Upload this complete folder (or the downloadable ZIP that contains it) into the upload area.
4. No build command, framework preset, environment variable, database, API key, or output directory is required.

If Cloudflare asks for a framework preset, choose **None**. The root directory already contains `index.html`.

## What is included

- Local catalog of mods, modpacks, shaders and resource packs captured from the previous MineAtlas catalog.
- Search, project-type filters, Minecraft version filter, loader and category filters.
- Sorting, pagination, project detail dialogs and a browser-local saved collection.
- MineAtlas Copilot in the lower-right corner. It is a local recommendation assistant that ranks the bundled catalog by the player’s request. It does not call an external AI service and therefore has no running cost or secret key.
- Responsive desktop, tablet and mobile layouts.
- Cloudflare `_headers` security policy and SPA `_redirects`.

## Important limitations

- Project names are preserved as creator names. The interface is English.
- MineAtlas stores discovery metadata, not third-party mod binaries. It intentionally does not provide fake or unverified download files.
- To update the catalog later, replace `catalog-data.js` with a newly exported local dataset.
- Saved projects stay in the visitor’s own browser via localStorage.

## Local preview

Opening `index.html` directly may not work in older browsers because the local catalog is compressed. Preview the folder through any static web server, for example:

```
python -m http.server 8080
```

Then open `http://localhost:8080`.
