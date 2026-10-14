"""Exercise the exact Python examples shown in the LD article."""
import ast
import dataclasses
import inspect
import json
from pathlib import Path
import re
import subprocess
import sys
import unittest
from unittest.mock import patch


ARTICLE = Path(__file__).resolve().parents[1] / "_designs/low-level-design-feature-flag-evaluator.md"
TEXT = ARTICLE.read_text()
IMPLEMENTATION = TEXT.split("## Key implementation\n", 1)[1].split("### A worked example\n", 1)[0]
EXAMPLE = TEXT.split("### A worked example\n", 1)[1].split("## Edge cases and tests\n", 1)[0]
BLOCKS = re.findall(r"```python\n(.*?)\n```", IMPLEMENTATION, re.DOTALL)
EXAMPLE_BLOCKS = re.findall(r"```python\n(.*?)\n```", EXAMPLE, re.DOTALL)
API = {}
exec("\n\n".join(BLOCKS), API)
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
        exec("\n\n".join(BLOCKS + EXAMPLE_BLOCKS), {})

    def test_models_match_implementation_fields(self):
        section = TEXT.split("## Core entities\n", 1)[1].split("## Classes and interfaces\n", 1)[0]
        models = dict(re.findall(r"message (\w+)\s*\{(.*?)\}", section, re.DOTALL))
        names = ("Context", "Condition", "Rule", "Flag", "Snapshot", "Evaluation")
        self.assertEqual(set(models), set(names))
        for name in names:
            fields = re.findall(r"^\s*(?:optional\s+|repeated\s+)?(?:map<[^>]+>|\w+)\s+(\w+)\s*;", models[name], re.MULTILINE)
            self.assertEqual(fields, [field.name for field in dataclasses.fields(API[name])])

    def test_model_presentation_and_invariant_comments(self):
        section = TEXT.split("## Core entities\n", 1)[1].split("## Classes and interfaces\n", 1)[0]
        schemas = re.findall(r"```protobuf\n(.*?)\n```", section, re.DOTALL)
        self.assertEqual(len(schemas), 2)
        for schema in schemas:
            self.assertNotRegex(schema, r"=\s*\d+\s*;")
            self.assertIn("//", schema)
            self.assertTrue(all(len(line) <= 80 for line in schema.splitlines()))
        for invariant in ("first match wins", "all must match", "0..10,000", "map key = Flag.key", "captured snapshot"):
            self.assertIn(invariant, section)

    def test_typed_class_contracts_match_method_parameters(self):
        section = TEXT.split("## Classes and interfaces\n", 1)[1].split("## Functional scenarios\n", 1)[0]
        contract = re.search(r"```python\n(.*?)\n```", section, re.DOTALL).group(1)
        self.assertTrue(all(len(line) <= 80 for line in contract.splitlines()))
        for definition in ast.parse(contract).body:
            self.assertIsInstance(definition, ast.ClassDef)
            implementation = API[definition.name]
            for method in (node for node in definition.body if isinstance(node, ast.FunctionDef)):
                parameters = list(inspect.signature(getattr(implementation, method.name)).parameters)
                self.assertEqual([argument.arg for argument in method.args.args], parameters)
                self.assertEqual(len(method.args.defaults), len([
                    parameter for parameter in inspect.signature(getattr(implementation, method.name)).parameters.values()
                    if parameter.default is not inspect.Parameter.empty
                ]))
        self.assertIn("_snapshot: Snapshot", contract)
        self.assertIn("snapshot: Snapshot", contract)
        self.assertIn("context: Context", contract)

    def test_breadth_first_sections_and_functional_diagrams(self):
        headings = re.findall(r"^## (.+)$", TEXT, re.MULTILINE)
        self.assertEqual(headings, [
            "Problem", "Requirements", "High-level design", "Core entities",
            "Classes and interfaces", "Functional scenarios", "Deep dives",
            "Key implementation", "Edge cases and tests", "Extensions and trade-offs",
        ])
        overview = TEXT.split("## High-level design\n", 1)[1].split("## Core entities\n", 1)[0]
        self.assertIn("flowchart TB", overview)
        self.assertIn("Application process", overview)
        scenarios = TEXT.split("## Functional scenarios\n", 1)[1].split("## Deep dives\n", 1)[0]
        cases = re.findall(r"^### ([^\n]+)\n(.*?)(?=^### |\Z)", scenarios, re.MULTILINE | re.DOTALL)
        self.assertEqual([title for title, _ in cases], [
            "Evaluating a flag", "Expanding a rollout", "Publishing configuration during a request",
        ])
        for _, case in cases:
            self.assertIn("sequenceDiagram", case)
            self.assertIn("accTitle:", case)
        self.assertNotIn("```python", scenarios)

    def test_deep_dives_explain_choices_and_tradeoffs(self):
        section = TEXT.split("## Deep dives\n", 1)[1].split("## Key implementation\n", 1)[0]
        dives = re.findall(r"^### ([^\n]+)\n(.*?)(?=^### |\Z)", section, re.MULTILINE | re.DOTALL)
        self.assertEqual(len(dives), 3)
        choices = (
            "Use ordered first-match rules, with a separate off switch.",
            "Use stable hash buckets because this design needs memory-only Boolean percentage rollout",
            "Capture one immutable snapshot per request. The consistency boundary is **one session, one version**.",
        )
        for (_, dive), choice in zip(dives, choices):
            for label in ("Problem", "Options",
                          "How it works", "Tradeoffs and recovery"):
                self.assertIn("**" + label + ".**", dive)
            self.assertIn("Cost and failure mode", dive)
            self.assertIn("\n\n" + choice, dive)
            self.assertNotIn("**Choice and rationale.**", dive)
            self.assertNotIn("**Options and tradeoffs.**", dive)
        self.assertNotIn("launchdarkly.com", TEXT)

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
        for threshold, rule_value in [(0, True), (10000, False)]:
            rule = Rule("explicit", (Condition("employee", "true"),), rule_value)
            result = self.session(self.flag(rollout_bps=threshold, rules=(rule,)),
                                  attributes={"employee": "true"}).evaluate("checkout_v2")
            self.assertEqual(result.value, rule_value)
            self.assertEqual(result.reason, "RULE_MATCH")

    def test_calculated_table_and_process_stability(self):
        expected = {"customer-42": 250, "customer-17": 4560, "customer-91": 7524}
        flag = self.flag()
        self.assertEqual({s: API["stable_bucket"](flag, s) for s in expected}, expected)
        program = "\n\n".join(BLOCKS) + (
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
