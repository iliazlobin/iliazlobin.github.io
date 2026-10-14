import unittest

from check_built_site import Page


class DocumentMarkupTests(unittest.TestCase):
    def test_header_order_distinguishes_category_metadata_from_topic_tags(self):
        page = Page()
        page.feed('<header class="post-header"><div class="meta"><time>July 17</time>'
                  '<a class="type-label post-category">INFRA</a></div>'
                  '<h1>News Feed</h1><div class="post-tags"><a class="tag">Redis</a>'
                  '</div></header><h1>Unrelated title</h1>')
        self.assertEqual(page.post_headers, [["metadata", "category", "title", "tags"]])
        old = Page()
        old.feed('<header class="post-header"><div class="meta">'
                 '<span class="post-tags">Redis</span></div><h1>News Feed</h1></header>')
        self.assertEqual(old.post_headers, [["metadata", "tags", "title"]])

    def test_article_scope_and_nested_cell_text_are_preserved(self):
        page = Page()
        page.feed('<article class="post post--document"><table><tr>'
                  '<td>Feed read availability</td>'
                  '<td><code>status=~"2.. &#124; 4.."</code></td>'
                  '<td>99.95% monthly</td></tr></table></article>')
        self.assertEqual(page.articles, [["post", "post--document"]])
        self.assertEqual(page.table_rows, [["Feed read availability",
                                          'status=~"2.. | 4.."', "99.95% monthly"]])

    def test_escaped_backslash_stays_visible_for_the_build_check(self):
        page = Page()
        page.feed('<table><tr><td><code>a\\|b</code></td></tr></table>')
        self.assertEqual(page.table_rows, [["a\\|b"]])

    def test_search_selects_category_ownership_and_project_anchors(self):
        page = Page()
        page.feed('<dialog data-site-search><select></select></dialog>'
                  '<select></select><a data-article-category="tech" '
                  'href="/infrastructure/?type=tech" aria-current="true">Tech</a>'
                  '<article id="hermes" class="portfolio-item"></article>')
        self.assertEqual(page.search_selects, 1)
        self.assertEqual(page.article_categories, [("tech", "/infrastructure/?type=tech")])
        self.assertEqual(page.current_categories, ["tech"])
        self.assertEqual(page.project_ids, {"hermes"})

    def test_category_list_preserves_semantics_and_accessible_name(self):
        page = Page()
        page.feed('<ul data-document-nav-categories aria-label="Article categories">'
                  '<li><a data-article-category="tech" href="/infrastructure/?type=tech">'
                  'Technologies</a></li></ul>')
        self.assertEqual(page.category_lists, [("ul", "Article categories")])
        invalid = Page()
        invalid.feed('<div data-document-nav-categories role="group"></div>')
        self.assertEqual(invalid.category_lists, [("div", None)])
