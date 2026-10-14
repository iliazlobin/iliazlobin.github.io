"""Check the published-site contract without third-party dependencies."""

import json
import re
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
ARTICLE_CATEGORIES = ("system-design", "system-design-ml", "low-level-design", "ai", "infra", "tech")


class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.resources = []
        self.navigation = []
        self.headings = []
        self.articles = []
        self.table_rows = []
        self.document_shells = 0
        self.article_navigations = 0
        self.library_links = []
        self.current_articles = []
        self.article_skip_links = []
        self.search_dialogs = 0
        self.search_triggers = 0
        self.search_selects = 0
        self.category_shortcuts = 0
        self.article_groups = []
        self.post_headers = []
        self._post_header = None
        self.project_ids = set()
        self._in_search = False
        self.ids = set()
        self._navigation_text = None
        self._heading_text = None
        self._row = None
        self._cell_text = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        classes = attrs.get("class", "").split()
        if tag == "header" and "post-header" in classes:
            self._post_header = []
            self.post_headers.append(self._post_header)
        if self._post_header is not None:
            for name, present in (("metadata", "meta" in classes),
                                  ("category", "post-category" in classes),
                                  ("title", tag == "h1"),
                                  ("tags", "post-tags" in classes)):
                if present:
                    self._post_header.append(name)
        if attrs.get("id"):
            self.ids.add(attrs["id"])
        if "data-site-search" in attrs:
            self.search_dialogs += 1
            self._in_search = True
        if tag == "select" and self._in_search:
            self.search_selects += 1
        if "data-open-site-search" in attrs:
            self.search_triggers += 1
        if "data-document-shell" in attrs:
            self.document_shells += 1
        if tag == "nav" and attrs.get("aria-label") == "Article navigation":
            self.article_navigations += 1
        if tag == "a" and "data-article-link" in attrs:
            self.library_links.append(attrs.get("href"))
            if attrs.get("aria-current") == "page":
                self.current_articles.append(attrs.get("href"))
        if "data-article-category" in attrs or "data-document-nav-categories" in attrs:
            self.category_shortcuts += 1
        if tag == "ul" and attrs.get("aria-labelledby", "").startswith("document-nav-"):
            self.article_groups.append(attrs["aria-labelledby"])
        if tag == "a" and "document-skip" in attrs.get("class", "").split():
            self.article_skip_links.append(attrs.get("href"))
        for attribute in ("href", "src", "poster"):
            if attrs.get(attribute):
                self.resources.append(attrs[attribute])
        if tag == "a" and "page-link" in attrs.get("class", "").split():
            self._navigation_text = []
        if tag == "h1":
            self._heading_text = []
        if tag == "article":
            self.articles.append(attrs.get("class", "").split())
            if "portfolio-item" in attrs.get("class", "").split() and attrs.get("id"):
                self.project_ids.add(attrs["id"])
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
        if tag == "header":
            self._post_header = None
        if tag == "dialog":
            self._in_search = False
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
    sources = list((root / "designs").glob("*/index.html"))
    expected_articles = set()
    for source in sources:
        candidate = Page()
        candidate.feed(source.read_text(encoding="utf-8"))
        if any("post" in classes for classes in candidate.articles):
            expected_articles.add("/" + source.parent.relative_to(root).as_posix() + "/")
    for source in sources:
        page = Page()
        page.feed(source.read_text(encoding="utf-8"))
        posts = [classes for classes in page.articles if "post" in classes]
        if not posts:
            continue
        document_count += 1
        route = "/" + source.parent.relative_to(root).as_posix() + "/"
        if page.search_dialogs != 1 or page.search_triggers != 1 or page.search_selects:
            errors.append(f"{route}: missing or duplicate universal search UI")
        if page.document_shells != 1 or page.article_navigations != 1:
            errors.append(f"{source}: missing or duplicate documentation shell/navigation")
        if len(page.library_links) != len(expected_articles) or set(page.library_links) != expected_articles:
            errors.append(f"{source}: article navigation must preserve every distinct article URL")
        if page.current_articles != [route]:
            errors.append(f"{source}: expected exactly one current article, got {page.current_articles!r}")
        if page.category_shortcuts:
            errors.append(f"{source}: sidebar must contain article groups without category shortcuts")
        expected_groups = [f"document-nav-{category}" for category in ARTICLE_CATEGORIES]
        if page.article_groups != expected_groups or any(group not in page.ids for group in expected_groups):
            errors.append(f"{source}: sidebar must preserve all six accessible article groups")
        if page.post_headers not in ([["metadata", "category", "title", "tags"]],
                                    [["metadata", "category", "title"]]):
            errors.append(f"{source}: header must put category metadata above title and topic tags below it")
        if page.article_skip_links != ["#document-article"]:
            errors.append(f"{source}: missing skip-to-article link")
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
        for heading in outline.headings:
            if re.match(r"(?:\d+(?:\.\d+)*[.)]\s+|D\d+:\s+)", heading["text"]):
                errors.append(f"{source}: numbered article heading: {heading['text']}")
    if not document_count:
        errors.append("No document articles found")

    for route in ("/", "/resume/", "/portfolio/", "/blog/", "/designs/", "/infrastructure/"):
        source = route_file(root, route)
        if source.is_file():
            html = source.read_text(encoding="utf-8")
            if "post--document" in html or "/assets/css/documents.css" in html or "data-article-toc" in html or "data-document-shell" in html or "data-document-nav" in html:
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


def check_search_index(root, errors):
    source = root / "search-index.json"
    try:
        entries = json.loads(source.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        errors.append(f"Search index unavailable: {exc}")
        return 0
    if not isinstance(entries, list) or not entries:
        errors.append("Search index must be a nonempty array")
        return 0
    urls = set()
    article_urls = set()
    project_ids = set()
    for entry in entries:
        if not isinstance(entry, dict) or not all(isinstance(entry.get(key), str) for key in ("url", "title", "description", "category", "categoryLabel", "section", "html")) or not isinstance(entry.get("tags"), list) or not all(isinstance(tag, str) for tag in entry.get("tags", [])):
            errors.append("Search index entry is missing typed metadata/content")
            continue
        url = entry["url"]
        parsed = urlsplit(url)
        if not url.startswith("/") or parsed.netloc or parsed.scheme or parsed.query or url in urls:
            errors.append(f"Search index has a duplicate or nonlocal URL: {url!r}")
            continue
        urls.add(url)
        target = route_file(root, parsed.path)
        if not target.is_file():
            errors.append(f"Search index links to a missing page: {url}")
            continue
        page = Page()
        page.feed(target.read_text(encoding="utf-8"))
        if parsed.fragment and unquote(parsed.fragment) not in page.ids:
            errors.append(f"Search index fragment has no destination: {url}")
        if any("post--document" in classes for classes in page.articles):
            article_urls.add(parsed.path)
            expected_section = "infra" if entry["category"] in ("infra", "tech") else "design"
            if entry["category"] not in ARTICLE_CATEGORIES or entry["section"] != expected_section:
                errors.append(f"Search article has invalid category/section ownership: {url}")
        if parsed.path == "/portfolio/" and parsed.fragment:
            project_ids.add(unquote(parsed.fragment))
            if entry["section"] != "portfolio" or entry["category"] not in ("full-stack", "ai-ml", "infra", "research"):
                errors.append(f"Search project has invalid category/section ownership: {url}")
        for anchor in re.findall(r'<h[1-6]\b[^>]*\bid=["\']([^"\']+)', entry["html"], re.I):
            if anchor not in page.ids:
                errors.append(f"Search index heading has no destination: {url}#{anchor}")
    expected_articles = {"/" + path.parent.relative_to(root).as_posix() + "/"
                         for path in (root / "designs").glob("*/index.html")
                         if "post--document" in path.read_text(encoding="utf-8")}
    if article_urls != expected_articles:
        errors.append("Universal search must cover every design/technology article")
    for url in ("/", "/resume/", "/portfolio/", "/designs/", "/infrastructure/", "/advisory/"):
        if url not in urls:
            errors.append(f"Universal search is missing a main page: {url}")
    portfolio = Page()
    portfolio.feed(route_file(root, "/portfolio/").read_text(encoding="utf-8"))
    if project_ids != portfolio.project_ids:
        errors.append("Universal search must index every Portfolio project exactly once")
    return len(entries)


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
        if page.search_dialogs != 1 or page.search_triggers != 1 or page.search_selects:
            errors.append(f"{route}: missing or duplicate universal search UI")
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
    search_count = check_search_index(root, errors)

    if errors:
        for error in errors:
            print(error, file=sys.stderr)
        return 1
    print(f"Checked {len(ROUTES)} routes, {document_count} document layouts, {search_count} search entries, {len(REDIRECTS)} redirects, {resource_count} local links/assets, and the resume PDF.")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python3 tests/check_built_site.py BUILD_DIRECTORY")
    raise SystemExit(check_site(Path(sys.argv[1]).resolve()))
