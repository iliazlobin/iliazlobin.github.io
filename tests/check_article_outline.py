"""Validate rendered article outlines against their actual heading IDs and nesting."""

from html.parser import HTMLParser
from urllib.parse import unquote


class ArticleOutline(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.headings = []
        self.links = []
        self.errors = []
        self._content_depth = 0
        self._toc = False
        self._list_parents = []
        self._last_li_id = None
        self._heading = None
        self._link = None

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag == "div":
            if self._content_depth or "post-content" in attrs.get("class", "").split():
                self._content_depth += 1
        if tag == "aside" and "data-article-toc" in attrs:
            self._toc = True
        if self._toc:
            if tag == "nav" and attrs.get("aria-label") != "On this page":
                self.errors.append("outline navigation lacks its accessible name")
            if tag == "ol":
                self._list_parents.append(self._last_li_id)
            if tag == "a":
                href = attrs.get("href", "")
                if not href.startswith("#"):
                    self.errors.append("outline link is not a plain fragment anchor")
                self._link = {"id": unquote(href[1:]), "parent": self._list_parents[-1] if self._list_parents else None, "text": []}
        if self._content_depth and tag in ("h2", "h3", "h4"):
            self._heading = {"id": attrs.get("id"), "level": int(tag[1]), "text": []}

    def handle_data(self, data):
        if self._heading is not None:
            self._heading["text"].append(data)
        if self._link is not None:
            self._link["text"].append(data)

    def handle_endtag(self, tag):
        if tag in ("h2", "h3", "h4") and self._heading is not None:
            self._heading["text"] = " ".join("".join(self._heading["text"]).split())
            self.headings.append(self._heading)
            self._heading = None
        if tag == "a" and self._link is not None:
            self._link["text"] = " ".join("".join(self._link["text"]).split())
            self._last_li_id = self._link["id"]
            self.links.append(self._link)
            self._link = None
        if tag == "ol" and self._toc:
            if self._list_parents:
                self._last_li_id = self._list_parents.pop()
            else:
                self.errors.append("unbalanced outline list")
        if tag == "aside" and self._toc:
            if self._list_parents:
                self.errors.append("outline has unclosed nested lists")
            self._toc = False
        if tag == "div" and self._content_depth:
            self._content_depth -= 1

    def validate(self):
        expected = []
        stack = []
        seen = set()
        for heading in self.headings:
            if not heading["id"]:
                continue  # A raw HTML heading without an ID is not linkable.
            if heading["id"] in seen:
                self.errors.append(f"duplicate article heading ID: {heading['id']}")
            seen.add(heading["id"])
            while stack and stack[-1]["level"] >= heading["level"]:
                stack.pop()
            expected.append({"id": heading["id"], "text": heading["text"], "parent": stack[-1]["id"] if stack else None})
            stack.append(heading)
        if self.links != expected:
            self.errors.append(f"outline differs from heading order, labels or hierarchy: expected {expected!r}, received {self.links!r}")
        return self.errors
