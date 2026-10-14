import unittest

from check_built_site import Page


class DocumentMarkupTests(unittest.TestCase):
    def test_article_section_label_is_not_a_second_heading_or_current_page(self):
        page = Page()
        page.feed('<header><span class="site-page-title">Infrastructure</span>'
                  '<a class="page-link" href="/infrastructure/" aria-current="location">Infra</a>'
                  '</header><article><a class="post-category" data-type-filter="infra">INFRA</a>'
                  '<h1>News Feed</h1></article>')
        self.assertEqual(page.section_titles, [("span", "Infrastructure")])
        self.assertEqual(page.current_navigation, [("/infrastructure/", "location")])
        self.assertEqual(page.post_categories, ["infra"])
        self.assertEqual(page.headings, ["News Feed"])
        listing = Page()
        listing.feed('<h1 class="site-page-title">Design</h1>'
                     '<a class="page-link" href="/designs/" aria-current="page">Design</a>')
        self.assertEqual(listing.section_titles, [("h1", "Design")])
        self.assertEqual(listing.current_navigation, [("/designs/", "page")])
        self.assertEqual(listing.headings, ["Design"])

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

    def test_search_selects_and_project_anchors(self):
        page = Page()
        page.feed('<dialog data-site-search><select></select></dialog>'
                  '<select></select>'
                  '<article id="hermes" class="portfolio-item"></article>')
        self.assertEqual(page.search_selects, 1)
        self.assertEqual(page.project_ids, {"hermes"})

    def test_build_check_detects_removed_category_shortcuts(self):
        page = Page()
        page.feed('<ul data-document-nav-categories aria-label="Article categories">'
                  '<li><a data-article-category="tech" href="/infrastructure/?type=tech">'
                  'Technologies</a></li></ul>')
        self.assertEqual(page.category_shortcuts, 2)
        article_only = Page()
        article_only.feed('<nav aria-label="Article navigation"><div data-document-nav-articles>'
                          '<span id="document-nav-tech">Technologies</span>'
                          '<ul aria-labelledby="document-nav-tech"><li><a data-article-link href="/designs/tech-memcached/">'
                          'Memcached</a></li></ul></div></nav>')
        self.assertEqual(article_only.category_shortcuts, 0)
        self.assertEqual(article_only.library_links, ["/designs/tech-memcached/"])
        self.assertEqual(article_only.article_groups, ["document-nav-tech"])
        self.assertIn("document-nav-tech", article_only.ids)
