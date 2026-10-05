"""Check the published-site contract without third-party dependencies."""

import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit


SITE_ORIGIN = "https://iliazlobin.com"
NAVIGATION = ["Resume", "Portfolio", "Design", "Infra", "About"]
ROUTES = {
    "/": "About",
    "/resume/": "Resume",
    "/portfolio/": "Portfolio",
    "/designs/": "Design",
    "/infrastructure/": "Infrastructure",
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
        self._navigation_text = None
        self._heading_text = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        for attribute in ("href", "src", "poster"):
            if attrs.get(attribute):
                self.resources.append(attrs[attribute])
        if tag == "a" and "page-link" in attrs.get("class", "").split():
            self._navigation_text = []
        if tag == "h1":
            self._heading_text = []

    def handle_data(self, data):
        if self._navigation_text is not None:
            self._navigation_text.append(data)
        if self._heading_text is not None:
            self._heading_text.append(data)

    def handle_endtag(self, tag):
        if tag == "a" and self._navigation_text is not None:
            self.navigation.append("".join(self._navigation_text).strip())
            self._navigation_text = None
        if tag == "h1" and self._heading_text is not None:
            self.headings.append("".join(self._heading_text).strip())
            self._heading_text = None


def route_file(root, route):
    target = root / unquote(route).lstrip("/")
    if target.is_dir():
        target /= "index.html"
    return target


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

    if errors:
        for error in errors:
            print(error, file=sys.stderr)
        return 1
    print(f"Checked {len(ROUTES)} routes, {len(REDIRECTS)} redirects, {resource_count} local links/assets, and the resume PDF.")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python3 tests/check_built_site.py BUILD_DIRECTORY")
    raise SystemExit(check_site(Path(sys.argv[1]).resolve()))
