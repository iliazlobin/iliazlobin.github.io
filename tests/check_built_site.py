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
ARTICLE_SECTIONS = {
    "Design": ("system-design", "system-design-ml", "low-level-design", "ai"),
    "Infrastructure": ("infra", "tech"),
}
PERSONAL_PAGE_ROUTES = ("/", "/resume/", "/advisory/")


class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.resources = []
        self.navigation = []
        self.current_navigation = []
        self.section_titles = []
        self._section_text = None
        self._section_tag = None
        self.headings = []
        self.articles = []
        self.table_rows = []
        self.document_shells = 0
        self.personal_page_shells = 0
        self.personal_page_rails = []
        self.personal_profile_rails = []
        self.profile_ids = set()
        self.page_rail_ids = set()
        self._profile_depth = 0
        self._page_rail_depth = 0
        self.article_navigations = 0
        self.outlines = 0
        self.outline_panels = []
        self.resume_downloads = []
        self.library_links = []
        self.current_articles = []
        self.article_skip_links = []
        self.search_dialogs = 0
        self.search_triggers = 0
        self.search_selects = 0
        self.category_shortcuts = 0
        self.article_groups = []
        self.post_headers = []
        self.post_categories = []
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
        if tag == "aside":
            if self._profile_depth or "page-profile-rail" in classes:
                self._profile_depth += 1
            if self._page_rail_depth or "page-side-rail" in classes:
                self._page_rail_depth += 1
        if "site-page-title" in classes:
            self._section_tag = tag
            self._section_text = []
        if "post-category" in classes:
            self.post_categories.append(attrs.get("data-type-filter"))
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
            if self._profile_depth:
                self.profile_ids.add(attrs["id"])
            if self._page_rail_depth:
                self.page_rail_ids.add(attrs["id"])
        if "data-site-search" in attrs:
            self.search_dialogs += 1
            self._in_search = True
        if tag == "select" and self._in_search:
            self.search_selects += 1
        if "data-open-site-search" in attrs:
            self.search_triggers += 1
        if "data-document-shell" in attrs:
            self.document_shells += 1
            if "document-shell--page" in classes:
                self.personal_page_shells += 1
        if "page-side-rail" in classes:
            self.personal_page_rails.append(("data-toc-scroll" in attrs,
                                             attrs.get("aria-label")))
        if "page-profile-rail" in classes:
            self.personal_profile_rails.append(("data-page-profile" in attrs,
                                                attrs.get("aria-label")))
        if "data-article-toc" in attrs:
            self.outlines += 1
        if tag == "details" and "article-toc-panel" in classes:
            self.outline_panels.append("open" in attrs)
        if tag == "a" and "resume-download" in classes:
            self.resume_downloads.append((attrs.get("href"), attrs.get("type"),
                                          attrs.get("download"), attrs.get("aria-label"),
                                          attrs.get("title")))
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
            if attrs.get("aria-current"):
                self.current_navigation.append((attrs.get("href"), attrs["aria-current"]))
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
        if self._section_text is not None:
            self._section_text.append(data)
        if self._navigation_text is not None:
            self._navigation_text.append(data)
        if self._heading_text is not None:
            self._heading_text.append(data)
        if self._cell_text is not None:
            self._cell_text.append(data)

    def handle_endtag(self, tag):
        if tag == "aside":
            if self._profile_depth:
                self._profile_depth -= 1
            if self._page_rail_depth:
                self._page_rail_depth -= 1
        if self._section_text is not None and tag == self._section_tag:
            self.section_titles.append((tag, "".join(self._section_text).strip()))
            self._section_text = None
            self._section_tag = None
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
    articles_by_category = {category: set() for category in ARTICLE_CATEGORIES}
    for source in sources:
        candidate = Page()
        candidate.feed(source.read_text(encoding="utf-8"))
        if (any("post" in classes for classes in candidate.articles)
                and len(candidate.post_categories) == 1
                and candidate.post_categories[0] in articles_by_category):
            articles_by_category[candidate.post_categories[0]].add(
                "/" + source.parent.relative_to(root).as_posix() + "/")
    for source in sources:
        page = Page()
        page.feed(source.read_text(encoding="utf-8"))
        posts = [classes for classes in page.articles if "post" in classes]
        if not posts:
            continue
        document_count += 1
        route = "/" + source.parent.relative_to(root).as_posix() + "/"
        if len(page.post_categories) != 1 or page.post_categories[0] not in ARTICLE_CATEGORIES:
            errors.append(f"{source}: expected exactly one known owning article category")
        infrastructure = page.post_categories == ["infra"] or page.post_categories == ["tech"]
        section_title = "Infrastructure" if infrastructure else "Design"
        section_url = "/infrastructure/" if infrastructure else "/designs/"
        section_categories = ARTICLE_SECTIONS[section_title]
        expected_articles = set().union(*(articles_by_category[category]
                                          for category in section_categories))
        if page.section_titles != [("span", section_title)] or len(page.headings) != 1:
            errors.append(f"{source}: article masthead must name its section without adding another H1")
        if page.current_navigation != [(section_url, "location")]:
            errors.append(f"{source}: article must mark its owning primary navigation section")
        if page.search_dialogs != 1 or page.search_triggers != 1 or page.search_selects:
            errors.append(f"{route}: missing or duplicate universal search UI")
        if page.document_shells != 1 or page.article_navigations != 1:
            errors.append(f"{source}: missing or duplicate documentation shell/navigation")
        if len(page.library_links) != len(expected_articles) or set(page.library_links) != expected_articles:
            errors.append(f"{source}: article navigation must contain every {section_title} article URL and no other section")
        if page.current_articles != [route]:
            errors.append(f"{source}: expected exactly one current article, got {page.current_articles!r}")
        if page.category_shortcuts:
            errors.append(f"{source}: sidebar must contain article groups without category shortcuts")
        expected_groups = [f"document-nav-{category}" for category in section_categories
                           if articles_by_category[category]]
        if page.article_groups != expected_groups or any(group not in page.ids for group in expected_groups):
            errors.append(f"{source}: sidebar must preserve only the accessible {section_title} article groups")
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

    for route in ("/portfolio/", "/blog/", "/designs/", "/infrastructure/"):
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


def check_personal_page_layout(root, errors):
    """Personal pages share the native outline without becoming design articles."""
    preserved_ids = {
        "/": ("career-focus", "professional-interests", "outside-of-work"),
        "/resume/": ("summary", "professional-experience", "education",
                     "professional-certifications", "talks",
                     "top-personal-projects-aiml-engineer--architect"),
        "/advisory/": ("advisory-focus",),
    }
    for route in PERSONAL_PAGE_ROUTES:
        source = route_file(root, route)
        if not source.is_file():
            continue  # The route check reports a missing page separately.
        html = source.read_text(encoding="utf-8")
        page = Page()
        page.feed(html)
        if page.document_shells != 1 or page.personal_page_shells != 1:
            errors.append(f"{route}: expected one scoped personal-page document shell")
        if page.personal_page_rails != [(True, "Page navigation and details")]:
            errors.append(f"{route}: expected one named shared scrolling page rail")
        expected_profile = [(True, "Contact and qualifications")] if route == "/resume/" else []
        if page.personal_profile_rails != expected_profile:
            errors.append(f"{route}: only Resume must retain its separate left qualifications rail")
        posts = [classes for classes in page.articles if "post" in classes]
        if len(posts) != 1 or not {"post--page", "post--document"}.issubset(posts[0]):
            errors.append(f"{route}: personal content must use the shared main document column")
        if page.article_navigations or page.library_links or page.article_skip_links:
            errors.append(f"{route}: personal pages must not acquire the technical article library")
        if page.outlines != 1 or page.outline_panels != [True]:
            errors.append(f"{route}: expected one native initially open outline for no-JS readers")
        if page.headings != [ROUTES[route]]:
            errors.append(f"{route}: retain one main page heading, got {page.headings!r}")
        styles = [urlsplit(resource).path for resource in page.resources if ".css" in resource]
        if styles.count("/assets/css/article-toc.css") != 1:
            errors.append(f"{route}: expected one shared document outline stylesheet")
        if len(re.findall(r"setupArticleToc\(", html)) != 1 or not re.search(r"document\.querySelector\([\"']\[data-document-shell\][\"']\)", html):
            errors.append(f"{route}: expected the shared outline enhancement once")
        if not re.search(r"/assets/js/article-toc\.mjs\?v=\d+", html):
            errors.append(f"{route}: outline module must retain the versioned shared asset URL")
        outline = ArticleOutline()
        outline.feed(html)
        errors.extend(f"{route}: {error}" for error in outline.validate())
        if not outline.headings or any(not heading["id"] for heading in outline.headings):
            errors.append(f"{route}: visible outline headings need stable native fragment targets")
        if any(anchor not in page.ids for anchor in preserved_ids[route]):
            errors.append(f"{route}: existing section fragment IDs were removed")
        if route == "/resume/":
            expected_download = ("/assets/documents/ilia-zlobin-resume.pdf", "application/pdf",
                                 "Ilia-Zlobin-Resume.pdf", "Download Resume PDF", "Download Resume PDF")
            if page.resume_downloads != [expected_download]:
                errors.append(f"{route}: retain the named native Resume PDF download")
            qualification_ids = {"contact", "education", "professional-certifications"}
            if not qualification_ids.issubset(page.profile_ids) or qualification_ids & page.page_rail_ids:
                errors.append(f"{route}: contact and qualifications must stay in the left rail, not the right outline")
            if any(item["id"] in ("education", "professional-certifications") for item in outline.links):
                errors.append(f"{route}: body outline must not misclassify left-rail qualifications as body sections")


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
        if parsed.path.startswith("/designs/") and any("post--document" in classes for classes in page.articles):
            article_urls.add(parsed.path)
            expected_section = "infra" if entry["category"] in ("infra", "tech") else "design"
            if entry["category"] not in ARTICLE_CATEGORIES or entry["section"] != expected_section:
                errors.append(f"Search article has invalid category/section ownership: {url}")
        if parsed.path == "/portfolio/" and parsed.fragment:
            project_ids.add(unquote(parsed.fragment))
            if entry["section"] != "portfolio" or entry["category"] not in ("full-stack", "ai-ml", "infra", "research"):
                errors.append(f"Search project has invalid category/section ownership: {url}")
        if parsed.path == "/resume/":
            if entry["category"] != "page" or entry["section"] != "resume":
                errors.append("Resume must retain page ownership in universal search")
            qualification_ids = ("education", "professional-certifications")
            indexed = Page()
            indexed.feed(entry["html"])
            if any(anchor not in indexed.ids for anchor in qualification_ids):
                errors.append("Universal search must retain Resume qualification section targets")
            qualification_terms = ("Bachelor's degree", "St. Petersburg State Transport University",
                                   "Cloud Architect", "Solutions Architect", "DevOps Engineer",
                                   "Certified Kubernetes Administrator")
            if any(term not in entry["html"] for term in qualification_terms):
                errors.append("Universal search lost Resume education or certification content")
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
    check_personal_page_layout(root, errors)
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
