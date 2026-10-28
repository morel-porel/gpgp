# Pizza Recipe Book

Ad-free recipe book for *Good Pizza, Great Pizza*, built from the wiki XML export. Plain static HTML/CSS/JS, no build step needed to run it.

- `site/` – the website (deploy this folder)
- `tools/build_data.py` – regenerates `site/js/data.js` from the XML in `references/`
- `resources/` – original images (copied to `site/img/`)

## Update the data
Drop a newer wiki export into `references/`, then:

    python tools\build_data.py

## Run locally
    cd site
    python -m http.server 8080      # open http://localhost:8080
(`site/index.html` also works when opened directly.)

## Deploy
- **Any static host / nginx / Caddy:** serve the `site/` folder.
- **Docker:** `docker build -t pizza-book . && docker run -d -p 80:80 pizza-book`

Press `/` anywhere to jump to the search box.
