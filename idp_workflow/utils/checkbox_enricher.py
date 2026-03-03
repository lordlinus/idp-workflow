"""
Checkbox Markdown Enricher

When Azure Document Intelligence extracts forms with multi-column checkbox
layouts (e.g., Yes/No checkbox tables), the markdown serialization separates
checkbox symbols (☐/☒) from their question text. This module detects that
pattern and appends an interpretation guide so that downstream LLMs (DSPy)
can correctly associate checkbox states with their questions.

Only activates when ☐/☒ symbols are present — no-op for other documents.
"""

import re
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# Unicode checkbox symbols used by Document Intelligence
UNCHECKED = "☐"  # U+2610 BALLOT BOX
CHECKED = "☒"    # U+2612 BALLOT BOX WITH X

# Words that indicate a header/label row rather than an answer row
HEADER_KEYWORDS = frozenset({
    "ya", "yes", "tidak", "no", "details", "perincian",
    "penemuan", "pendapat", "memuaskan", "adverse", "findings",
})


@dataclass
class CheckboxPair:
    """A detected Yes/No checkbox pair."""
    yes_state: str   # "checked" or "unchecked"
    no_state: str     # "checked" or "unchecked"
    answer: str       # "Yes", "No", "Unmarked", or "Both marked"
    line_num: int
    raw_line: str
    is_header: bool


def _extract_checkbox_pairs(markdown: str) -> list[CheckboxPair]:
    """Extract all checkbox pairs from the markdown.

    Each pair consists of two consecutive ☐/☒ symbols:
    - First symbol = Yes/Ya column (typically left)
    - Second symbol = No/Tidak column (typically right)
    """
    lines = markdown.split("\n")
    pairs: list[CheckboxPair] = []

    for line_num, line in enumerate(lines):
        stripped = line.strip()
        if not stripped:
            continue

        # Find all checkbox symbols on this line
        symbols = [(m.start(), m.group()) for m in re.finditer(f"[{UNCHECKED}{CHECKED}]", stripped)]
        if len(symbols) < 2:
            # Need at least 2 symbols to form a pair
            # A single symbol might be part of a header label
            continue

        # Detect header lines: contain multiple header keywords
        words = set(re.findall(r"[a-zA-Z]+", stripped.lower()))
        is_header = len(words & HEADER_KEYWORDS) >= 2

        # Extract pairs from consecutive symbols
        i = 0
        while i + 1 < len(symbols):
            _, yes_sym = symbols[i]
            _, no_sym = symbols[i + 1]

            # Determine answer
            if yes_sym == CHECKED and no_sym == UNCHECKED:
                answer = "Yes"
            elif yes_sym == UNCHECKED and no_sym == CHECKED:
                answer = "No"
            elif yes_sym == UNCHECKED and no_sym == UNCHECKED:
                answer = "Unmarked"
            else:
                answer = "Both marked"

            pairs.append(CheckboxPair(
                yes_state="checked" if yes_sym == CHECKED else "unchecked",
                no_state="checked" if no_sym == CHECKED else "unchecked",
                answer=answer,
                line_num=line_num,
                raw_line=stripped,
                is_header=is_header,
            ))
            i += 2

    return pairs


def _extract_checkbox_questions(markdown: str) -> list[dict]:
    """Extract numbered questions that likely have checkbox answers.

    Looks for patterns like:
    - "9. Question text..."
    - "10. Question text..."
    - "11. (a) Question text..." or "(a) Question text..."
    - "12(a) Question text..."

    Sub-questions like "(b)" inherit the parent question number from the
    most recent main question (e.g., "11." or "12.").
    """
    lines = markdown.split("\n")
    questions: list[dict] = []

    # Pattern for main numbered questions: "9.", "10.", "11.", "12.", "13.", "14."
    main_q_pattern = re.compile(
        r"^\s*(\d+)\.\s+"
    )
    # Pattern for sub-questions: "(a)", "(b)", "(A)", "(B)", "11. (a)", "12(a)"
    sub_q_pattern = re.compile(
        r"^\s*(?:(\d+)\.\s*)?\((\w+)\)\s+"
    )

    # Track the most recent parent question number for orphaned sub-questions
    current_parent_num = ""

    for line_num, line in enumerate(lines):
        stripped = line.strip()
        if not stripped or len(stripped) < 10:
            continue

        # Skip lines that are just checkbox symbols
        if all(c in f"{UNCHECKED}{CHECKED} \t" for c in stripped):
            continue

        # Try sub-question pattern first (more specific)
        m = sub_q_pattern.match(stripped)
        if m:
            parent_num = m.group(1) or ""
            sub_id = m.group(2)
            if parent_num:
                # Explicit parent: "11. (a)" or "12(a)"
                current_parent_num = parent_num
                qid = f"{parent_num}({sub_id})"
            elif current_parent_num:
                # Inherit parent: "(b)" after "11. (a)" → "11(b)"
                qid = f"{current_parent_num}({sub_id})"
            else:
                qid = f"({sub_id})"
            # Extract question text (first 100 chars after the ID)
            text_start = m.end()
            qtext = stripped[text_start:text_start + 100].strip()
            questions.append({
                "id": qid,
                "line_num": line_num,
                "text": qtext,
            })
            continue

        # Try main question pattern
        m = main_q_pattern.match(stripped)
        if m:
            qid = m.group(1)
            current_parent_num = qid  # Update parent for following sub-questions
            text_start = m.end()
            qtext = stripped[text_start:text_start + 100].strip()
            # Only include if it looks like a question (has alphabetic content)
            if re.search(r"[a-zA-Z]{3,}", qtext):
                questions.append({
                    "id": qid,
                    "line_num": line_num,
                    "text": qtext,
                })

    return questions


def enrich_markdown_with_checkbox_context(markdown: str) -> str:
    """Enrich DI markdown with checkbox interpretation context for LLM extraction.

    When Document Intelligence extracts forms with multi-column Yes/No checkbox
    tables, the checkbox symbols (☐/☒) get separated from their question text
    in the markdown output. This function:

    1. Detects checkbox symbol pairs (☐☒ or ☒☐)
    2. Identifies numbered questions in the document
    3. Appends a structured interpretation guide to the markdown

    The guide helps downstream LLMs (DSPy) correctly associate checkbox states
    with their corresponding questions.

    Args:
        markdown: Raw markdown from Document Intelligence

    Returns:
        Enriched markdown with checkbox interpretation guide appended.
        Returns original markdown unchanged if no checkbox symbols found.
    """
    if UNCHECKED not in markdown and CHECKED not in markdown:
        return markdown

    all_pairs = _extract_checkbox_pairs(markdown)
    if not all_pairs:
        return markdown

    # Separate header pairs from data pairs
    header_pairs = [p for p in all_pairs if p.is_header]
    data_pairs = [p for p in all_pairs if not p.is_header]

    if not data_pairs:
        return markdown

    # Extract questions for correlation
    questions = _extract_checkbox_questions(markdown)

    logger.info(
        f"Checkbox enricher: {len(data_pairs)} checkbox pairs, "
        f"{len(header_pairs)} header pairs, "
        f"{len(questions)} questions detected"
    )

    # Build the interpretation guide
    guide_lines = [
        "",
        "",
        "---",
        "## CHECKBOX DETECTION RESULTS",
        "",
        "**IMPORTANT**: This document contains a form with checkbox columns.",
        "Due to the multi-column table layout, the checkbox symbols (☐/☒) above",
        "appear SEPARATED from their question text in this markdown.",
        "",
        "### Symbol Legend",
        f"- {UNCHECKED} = unchecked / empty box (no mark)",
        f"- {CHECKED} = checked / marked box (has a tick, cross, or fill)",
        "",
        "### Column Layout",
        "Each checkbox question has TWO boxes in a row:",
        "- **First/Left box** = Yes / Ya column",
        "- **Second/Right box** = No / Tidak column",
        "",
        "### Reading Rules",
        f"- {UNCHECKED} {CHECKED} → Yes is unchecked, No is checked → **Answer: No**",
        f"- {CHECKED} {UNCHECKED} → Yes is checked, No is unchecked → **Answer: Yes**",
        f"- {UNCHECKED} {UNCHECKED} → Both unchecked → **Answer: Unmarked**",
        "",
    ]

    # List detected pairs with answers
    guide_lines.append(f"### Detected Checkbox Pairs ({len(data_pairs)} pairs in document order)")
    guide_lines.append("")

    for idx, pair in enumerate(data_pairs, 1):
        yes_sym = CHECKED if pair.yes_state == "checked" else UNCHECKED
        no_sym = CHECKED if pair.no_state == "checked" else UNCHECKED
        guide_lines.append(
            f"  Pair {idx}: {yes_sym} {no_sym} → **{pair.answer}**"
        )

    guide_lines.append("")

    # If we found questions, show the mapping hint
    if questions:
        guide_lines.append(f"### Numbered Questions Found ({len(questions)})")
        guide_lines.append("")
        for q in questions:
            guide_lines.append(f"  - Q{q['id']}: {q['text'][:60]}...")
        guide_lines.append("")
        guide_lines.append(
            "The checkbox pairs above are in the SAME order as the checkbox questions."
        )
        guide_lines.append(
            "Match Pair 1 → first checkbox question, Pair 2 → second question, etc."
        )

        # If counts match, show explicit mapping
        if len(data_pairs) == len(questions):
            guide_lines.append("")
            guide_lines.append("### Suggested Question-to-Checkbox Mapping")
            guide_lines.append("")
            for idx, (pair, q) in enumerate(zip(data_pairs, questions), 1):
                guide_lines.append(
                    f"  Q{q['id']} → Pair {idx} → **{pair.answer}**"
                )
        elif len(data_pairs) != len(questions):
            guide_lines.append("")
            guide_lines.append(
                f"⚠ Note: {len(data_pairs)} checkbox pairs vs {len(questions)} questions detected."
            )
            guide_lines.append(
                "Some questions may not have checkboxes, or some checkboxes may belong to"
            )
            guide_lines.append(
                "questions not detected in the text. Use the document context to determine"
            )
            guide_lines.append(
                "the correct mapping."
            )

    guide_lines.extend(["", "---", ""])

    enriched = markdown + "\n".join(guide_lines)

    logger.info(
        f"Checkbox enricher: appended {len(guide_lines)} lines of context "
        f"({len(data_pairs)} pairs, {len(questions)} questions)"
    )

    return enriched
