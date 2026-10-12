import unittest

from check_article_outline import ArticleOutline


class ArticleOutlineTests(unittest.TestCase):
    def parse(self, html):
        page = ArticleOutline()
        page.feed(html)
        return page

    def test_custom_ids_inline_markup_entities_and_skipped_levels(self):
        page = self.parse('<aside data-article-toc><nav aria-label="On this page"><ol>'
                          '<li><a href="#custom:root">API &amp; setup</a><ol>'
                          '<li><a href="#deep">Retry keys</a></li></ol></li>'
                          '<li><a href="#other">Other</a></li></ol></nav></aside>'
                          '<div class="post-content"><h2 id="custom:root">API &amp; setup</h2>'
                          '<h4 id="deep">Retry <code>keys</code></h4><h2 id="other">Other</h2></div>')
        self.assertEqual(page.validate(), [])

    def test_h4_returns_to_h3_under_the_same_h2(self):
        page = self.parse('<aside data-article-toc><nav aria-label="On this page"><ol><li><a href="#a">A</a>'
                          '<ol><li><a href="#b">B</a></li></ol><ol><li><a href="#c">C</a></li></ol></li></ol></nav></aside>'
                          '<div class="post-content"><h2 id="a">A</h2><h4 id="b">B</h4><h3 id="c">C</h3></div>')
        self.assertEqual(page.validate(), [])

    def test_broken_ids_or_nesting_fail(self):
        page = self.parse('<aside data-article-toc><nav aria-label="On this page"><ol><li><a href="#wrong">A</a>'
                          '</li><li><a href="#b">B</a></li></ol></nav></aside>'
                          '<div class="post-content"><h2 id="a">A</h2><h3 id="b">B</h3></div>')
        self.assertTrue(page.validate())

    def test_unlinkable_raw_heading_and_code_content_are_ignored(self):
        page = self.parse('<div class="post-content"><h2>Unlinkable</h2><pre>&lt;h2 id="code"&gt;</pre></div>')
        self.assertEqual(page.validate(), [])
