import unittest

from check_built_site import Page


class DocumentMarkupTests(unittest.TestCase):
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
