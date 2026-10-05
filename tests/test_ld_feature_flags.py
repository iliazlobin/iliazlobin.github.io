"""Exercise the exact Python examples shown in the LD article."""
import dataclasses
import json
from pathlib import Path
import re
import subprocess
import sys
import unittest
from unittest.mock import patch


ARTICLE = Path(__file__).resolve().parents[1] / "_designs/low-level-design-feature-flag-evaluator.md"
BLOCKS = re.findall(r"```python\n(.*?)\n```", ARTICLE.read_text(), re.DOTALL)
API = {}
exec("\n\n".join(BLOCKS[:3]), API)
Context, Condition, Rule, Flag, Snapshot, Evaluation, Session, Store = (
    API[name] for name in (
        "Context", "Condition", "Rule", "Flag", "Snapshot", "Evaluation",
        "EvaluationSession", "SnapshotStore",
    )
)


class FeatureFlagTests(unittest.TestCase):
    def flag(self, **changes):
        values = dict(key="checkout_v2", enabled=True, rules=(),
                      rollout_bps=1000, salt="checkout-v1")
        values.update(changes)
        return Flag(**values)

    def session(self, flag, subject="customer-42", attributes=None):
        return Session(Snapshot(12, {flag.key: flag}),
                       Context(subject, attributes or {}))

    def test_entire_worked_example_runs(self):
        exec("\n\n".join(BLOCKS), {})

    def test_missing_flag_uses_default_and_reason(self):
        result = self.session(self.flag()).evaluate("absent", True)
        self.assertEqual(result, Evaluation(True, "FLAG_NOT_FOUND", 12))

    def test_off_switch_overrides_matching_rule_and_default(self):
        rule = Rule("staff", (Condition("employee", "true"),), True)
        session = self.session(self.flag(enabled=False, rules=(rule,)),
                               attributes={"employee": "true"})
        self.assertEqual(session.evaluate("checkout_v2", True),
                         Evaluation(False, "DISABLED", 12))

    def test_first_matching_rule_wins(self):
        condition = Condition("plan", "business")
        rules = (Rule("excluded", (condition,), False),
                 Rule("included", (condition,), True))
        result = self.session(self.flag(rules=rules),
                              attributes={"plan": "business"}).evaluate("checkout_v2")
        self.assertEqual(result, Evaluation(False, "RULE_MATCH", 12, "excluded"))

    def test_all_conditions_required_and_missing_attribute_fails(self):
        rule = Rule("staff-us", (Condition("employee", "true"),
                                 Condition("country", "US")), True)
        flag = self.flag(rules=(rule,), rollout_bps=0)
        self.assertFalse(self.session(flag, attributes={"employee": "true"})
                         .evaluate("checkout_v2").value)
        self.assertTrue(self.session(flag, attributes={"employee": "true", "country": "US"})
                        .evaluate("checkout_v2").value)

    def test_anonymous_fallback_and_explicit_targeting(self):
        self.assertEqual(self.session(self.flag(), subject=None)
                         .evaluate("checkout_v2", True),
                         Evaluation(True, "MISSING_SUBJECT", 12))
        rule = Rule("staff", (Condition("employee", "true"),), False)
        result = self.session(self.flag(rules=(rule,)), subject=None,
                              attributes={"employee": "true"}).evaluate("checkout_v2", True)
        self.assertEqual(result.reason, "RULE_MATCH")
        self.assertFalse(result.value)

    def test_rollout_boundaries(self):
        for bucket, expected in [(999, True), (1000, False), (9999, False)]:
            with patch.dict(API, stable_bucket=lambda *_: bucket):
                self.assertEqual(self.session(self.flag()).evaluate("checkout_v2").value,
                                 expected)
        for threshold, expected in [(0, False), (10000, True)]:
            for subject in ("customer-42", "customer-17", "customer-91"):
                self.assertEqual(self.session(self.flag(rollout_bps=threshold), subject)
                                 .evaluate("checkout_v2").value, expected)

    def test_calculated_table_and_process_stability(self):
        expected = {"customer-42": 250, "customer-17": 4560, "customer-91": 7524}
        flag = self.flag()
        self.assertEqual({s: API["stable_bucket"](flag, s) for s in expected}, expected)
        program = "\n\n".join(BLOCKS[:3]) + (
            '\nprint(json.dumps({s: stable_bucket(Flag("checkout_v2", True, (), 1000, '
            '"checkout-v1"), s) for s in ["customer-42", "customer-17", "customer-91"]}))'
        )
        result = subprocess.check_output([sys.executable, "-c", program], text=True)
        self.assertEqual(json.loads(result), expected)

    def test_rollout_growth_keeps_previous_cohort(self):
        small, large = self.flag(rollout_bps=1000), self.flag(rollout_bps=5000)
        for i in range(300):
            subject = "customer-" + str(i)
            old = self.session(small, subject).evaluate("checkout_v2").value
            new = self.session(large, subject).evaluate("checkout_v2").value
            self.assertFalse(old and not new)

    def test_inputs_are_copied_and_objects_frozen(self):
        attributes = {"plan": "business"}
        context = Context("customer-42", attributes)
        flags = {"checkout_v2": self.flag()}
        snapshot = Snapshot(12, flags)
        attributes.clear()
        flags.clear()
        self.assertEqual(context.attributes["plan"], "business")
        self.assertIn("checkout_v2", snapshot.flags)
        with self.assertRaises(TypeError):
            snapshot.flags["other"] = self.flag()
        with self.assertRaises(dataclasses.FrozenInstanceError):
            snapshot.version = 99
        conditions = [Condition("plan", "business")]
        rule = Rule("business", conditions, True)
        conditions.clear()
        self.assertTrue(rule.matches(context))

    def test_invalid_candidate_leaves_store_unchanged(self):
        store = Store(Snapshot(12, {"checkout_v2": self.flag()}))
        for threshold in (-1, 10001, True):
            with self.assertRaises(ValueError):
                store.publish(Snapshot(13, {"checkout_v2": self.flag(rollout_bps=threshold)}))
        rule = Rule("staff", (Condition("employee", "true"),), True)
        with self.assertRaises(ValueError):
            self.flag(rules=(rule, rule))
        with self.assertRaises(ValueError):
            Rule("empty", (), True)
        with self.assertRaises(ValueError):
            Snapshot(13, {"wrong-key": self.flag()})
        self.assertEqual(store.session(Context("customer-42", {})).snapshot.version, 12)

    def test_snapshot_swap_and_stale_publication(self):
        store = Store(Snapshot(12, {"checkout_v2": self.flag(rollout_bps=10000)}))
        old = store.session(Context("customer-42", {}))
        store.publish(Snapshot(13, {"checkout_v2": self.flag(enabled=False)}))
        self.assertTrue(old.evaluate("checkout_v2").value)
        fresh = store.session(old.context)
        self.assertFalse(fresh.evaluate("checkout_v2").value)
        self.assertEqual(fresh.snapshot.version, 13)
        for version in (11, 12, 13):
            with self.assertRaises(ValueError):
                store.publish(Snapshot(version, {}))
        self.assertEqual(store.session(old.context).snapshot.version, 13)

    def test_concurrent_capture_and_publication_have_complete_snapshots(self):
        from concurrent.futures import ThreadPoolExecutor
        store = Store(Snapshot(1, {"checkout_v2": self.flag(rollout_bps=10000)}))
        context = Context("customer-42", {})

        def publish():
            for version in range(2, 201):
                store.publish(Snapshot(version, {"checkout_v2": self.flag(enabled=bool(version % 2))}))

        def capture():
            results = []
            for _ in range(300):
                session = store.session(context)
                first = session.evaluate("checkout_v2")
                self.assertEqual(first, session.evaluate("checkout_v2"))
                results.append((first.version, first.value))
            return results

        with ThreadPoolExecutor(max_workers=4) as pool:
            updater = pool.submit(publish)
            readers = [pool.submit(capture) for _ in range(3)]
            updater.result()
            for reader in readers:
                for version, value in reader.result():
                    # Version 1 enables everyone; later versions toggle the off switch.
                    self.assertEqual(value, bool(version % 2))


if __name__ == "__main__":
    unittest.main()
