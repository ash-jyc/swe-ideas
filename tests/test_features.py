from vibetrace.features import (
    FEATURE_NAMES,
    extract_features,
    specificity_score,
    strip_code_blocks,
)


def test_all_features_present_and_numeric():
    feats = extract_features("Fix the login bug in auth.py")
    assert set(feats) == set(FEATURE_NAMES)
    assert all(isinstance(v, (int, float)) for v in feats.values())


def test_vague_quick_prompt():
    feats = extract_features("just make a quick login page, something simple")
    assert feats["urgency_shortcut"] == 1
    assert feats["vague_term_count"] >= 1
    assert feats["starts_imperative"] == 0  # "just" is not an imperative verb
    assert feats["mentions_security"] == 0
    assert feats["path_mention_count"] == 0


def test_specific_security_prompt():
    prompt = (
        "Update `hash_password()` in src/auth/passwords.py to use bcrypt, "
        "must validate input length and never store plaintext"
    )
    feats = extract_features(prompt)
    assert feats["starts_imperative"] == 1
    assert feats["mentions_security"] == 1
    assert feats["path_mention_count"] == 1
    assert feats["identifier_count"] >= 1
    assert feats["inline_code_count"] == 1
    assert feats["constraint_count"] >= 2  # must, never
    assert feats["negation_count"] >= 1  # never
    assert feats["specificity_score"] > 0


def test_question_detection():
    assert extract_features("How does the session cache work?")["is_question"] == 1
    assert extract_features("what happens on logout")["is_question"] == 1
    assert extract_features("Add a logout button")["is_question"] == 0


def test_code_block_stripping_prevents_pollution():
    prompt = "Explain this\n```python\npassword = 'secret'  # test auth token\n```"
    assert "password" not in strip_code_blocks(prompt)
    feats = extract_features(prompt)
    assert feats["mentions_security"] == 0
    assert feats["mentions_testing"] == 0
    assert feats["has_code_block"] == 1


def test_unterminated_fence_stripped_to_end():
    prompt = "Fix this\n```\neval(user_input) # security hole"
    assert "security" not in strip_code_blocks(prompt)


def test_references_previous():
    assert extract_features("also add logging to that")["references_previous"] == 1
    assert extract_features("now do the same as before")["references_previous"] == 1
    assert extract_features("Create a new endpoint")["references_previous"] == 0


def test_counts_on_empty_prompt():
    feats = extract_features("")
    assert feats["char_len"] == 0
    assert feats["word_count"] == 0
    assert feats["line_count"] == 0
    assert feats["specificity_score"] == 0.0


def test_specificity_is_deterministic_and_bounded():
    prompt = "edit a/b.py c/d.py `x()` `y()` must only exactly 3 5 7"
    assert specificity_score(prompt) == specificity_score(prompt)
    assert 0.0 <= specificity_score(prompt) <= 10.0


def test_politeness_and_negation():
    feats = extract_features("Could you please avoid global state? Don't use eval")
    assert feats["politeness"] == 1
    assert feats["negation_count"] >= 2
