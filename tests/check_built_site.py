"""Check the published-site contract without third-party dependencies."""

import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit

from check_article_outline import ArticleOutline


SITE_ORIGIN = "https://iliazlobin.com"
NAVIGATION = ["Resume", "Portfolio", "Design", "Infra", "Advisory", "About"]
ROUTES = {
    "/": "About",
    "/resume/": "Resume",
    "/portfolio/": "Portfolio",
    "/designs/": "Design",
    "/infrastructure/": "Infrastructure",
    "/advisory/": "Advisory",
    "/designs/system-design-bitly-url-shortener/": "SD: Bitly / URL Shortener",
    "/designs/tech-memcached/": "TECH: Memcached",
    "/designs/low-level-design-feature-flag-evaluator/": "LD: Feature Flag Evaluator",
}
REDIRECTS = {
    "/machine-learning/": "/designs/",
    "/tech/": "/infrastructure/",
}


class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.resources = []
        self.navigation = []
        self.headings = []
        self.articles = []
        self.table_rows = []
        self._navigation_text = None
        self._heading_text = None
        self._row = None
        self._cell_text = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        for attribute in ("href", "src", "poster"):
            if attrs.get(attribute):
                self.resources.append(attrs[attribute])
        if tag == "a" and "page-link" in attrs.get("class", "").split():
            self._navigation_text = []
        if tag == "h1":
            self._heading_text = []
        if tag == "article":
            self.articles.append(attrs.get("class", "").split())
        if tag == "tr":
            self._row = []
        if tag in ("td", "th") and self._row is not None:
            self._cell_text = []

    def handle_data(self, data):
        if self._navigation_text is not None:
            self._navigation_text.append(data)
        if self._heading_text is not None:
            self._heading_text.append(data)
        if self._cell_text is not None:
            self._cell_text.append(data)

    def handle_endtag(self, tag):
        if tag == "a" and self._navigation_text is not None:
            self.navigation.append("".join(self._navigation_text).strip())
            self._navigation_text = None
        if tag == "h1" and self._heading_text is not None:
            self.headings.append("".join(self._heading_text).strip())
            self._heading_text = None
        if tag in ("td", "th") and self._cell_text is not None:
            self._row.append("".join(self._cell_text).strip())
            self._cell_text = None
        if tag == "tr" and self._row is not None:
            self.table_rows.append(self._row)
            self._row = None


def route_file(root, route):
    target = root / unquote(route).lstrip("/")
    if target.is_dir():
        target /= "index.html"
    return target


def check_document_layout(root, errors):
    document_count = 0
    for source in (root / "designs").glob("*/index.html"):
        page = Page()
        page.feed(source.read_text(encoding="utf-8"))
        posts = [classes for classes in page.articles if "post" in classes]
        if not posts:
            continue
        document_count += 1
        if any("post--document" not in classes for classes in posts):
            errors.append(f"{source}: missing compact document scope")
        styles = [urlsplit(resource).path for resource in page.resources if ".css" in resource]
        if any(path not in styles for path in ("/assets/css/documents.css", "/assets/css/diagrams.css")) or styles.index("/assets/css/documents.css") < styles.index("/assets/css/diagrams.css"):
            errors.append(f"{source}: compact styles must load after diagram styles")
        if "/assets/css/article-toc.css" not in styles:
            errors.append(f"{source}: missing document outline styles")
        outline = ArticleOutline()
        outline.feed(source.read_text(encoding="utf-8"))
        errors.extend(f"{source}: {error}" for error in outline.validate())
    if not document_count:
        errors.append("No document articles found")

    for route in ("/", "/resume/", "/portfolio/", "/blog/", "/designs/", "/infrastructure/"):
        source = route_file(root, route)
        if source.is_file():
            html = source.read_text(encoding="utf-8")
            if "post--document" in html or "/assets/css/documents.css" in html or "data-article-toc" in html:
                errors.append(f"{route}: document styles leaked outside articles")

    for source in (root / "blog").glob("**/index.html"):
        if "data-article-toc" in source.read_text(encoding="utf-8"):
            errors.append(f"{source}: document outline leaked into an ordinary blog post")

    page = Page()
    source = route_file(root, "/designs/infra-news-feed/")
    if source.is_file():
        page.feed(source.read_text(encoding="utf-8"))
    rows = [row for row in page.table_rows if row and row[0] == "Feed read availability"]
    expected = 'rate(http_requests_total{status=~"2.. | 4.."}[1m]) / rate(http_requests_total[1m])'
    if rows != [["Feed read availability", expected, "99.95% monthly"]]:
        errors.append(f"News Feed availability table is malformed: {rows!r}")
    return document_count


def check_site(root):
    errors = []
    resource_count = 0
    for route, heading in ROUTES.items():
        source = route_file(root, route)
        if not source.is_file():
            errors.append(f"Missing route: {route}")
            continue
        page = Page()
        page.feed(source.read_text(encoding="utf-8"))
        if page.navigation != NAVIGATION:
            errors.append(f"{route}: unexpected navigation {page.navigation!r}")
        if heading not in page.headings:
            errors.append(f"{route}: missing heading {heading!r}")
        for resource in page.resources:
            parsed = urlsplit(urljoin(SITE_ORIGIN + route, resource))
            if parsed.scheme not in ("http", "https") or parsed.netloc != "iliazlobin.com":
                continue
            target = route_file(root, parsed.path)
            if not target.is_file():
                errors.append(f"{route}: missing local resource {resource!r}")
            resource_count += 1

    for route, destination in REDIRECTS.items():
        source = route_file(root, route)
        if not source.is_file() or SITE_ORIGIN + destination not in source.read_text(encoding="utf-8"):
            errors.append(f"{route}: missing redirect to {destination}")

    pdf = root / "assets/documents/ilia-zlobin-resume.pdf"
    if not pdf.is_file() or not pdf.read_bytes().startswith(b"%PDF-"):
        errors.append("Missing or invalid resume PDF")

    document_count = check_document_layout(root, errors)

    if errors:
        for error in errors:
            print(error, file=sys.stderr)
        return 1
    print(f"Checked {len(ROUTES)} routes, {document_count} document layouts, {len(REDIRECTS)} redirects, {resource_count} local links/assets, and the resume PDF.")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python3 tests/check_built_site.py BUILD_DIRECTORY")
    raise SystemExit(check_site(Path(sys.argv[1]).resolve()))
