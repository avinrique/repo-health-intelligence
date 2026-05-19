#!/usr/bin/env python3
"""Plain-language explainer PDF: what this project is + what's done.
Written so a non-technical reader (PM, designer, parent, judge from a different field)
can grasp the value in 5 minutes.
"""
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, Color
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak,
    HRFlowable, KeepTogether,
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER

# --- colors ---
INK = HexColor("#0f1726")
INK_SOFT = HexColor("#3a4459")
MUTED = HexColor("#6b7588")
BG = HexColor("#fafafd")
ACCENT = HexColor("#6d4fcf")   # violet
CYAN = HexColor("#1ba6c1")
GOOD = HexColor("#0d9d6a")
WARN = HexColor("#c98300")
BAD = HexColor("#b8425e")
HAIR = HexColor("#dddde3")

styles = getSampleStyleSheet()

def make_styles():
    return {
        "kicker": ParagraphStyle("kicker", parent=styles["Normal"], fontName="Helvetica-Bold",
                                  fontSize=8, textColor=ACCENT, spaceAfter=4, leading=10,
                                  alignment=TA_LEFT),
        "h1": ParagraphStyle("h1", parent=styles["Heading1"], fontName="Helvetica-Bold",
                              fontSize=26, textColor=INK, spaceAfter=10, leading=30),
        "h2": ParagraphStyle("h2", parent=styles["Heading2"], fontName="Helvetica-Bold",
                              fontSize=15, textColor=INK, spaceBefore=16, spaceAfter=6, leading=19),
        "h3": ParagraphStyle("h3", parent=styles["Heading3"], fontName="Helvetica-Bold",
                              fontSize=11.5, textColor=INK_SOFT, spaceBefore=10, spaceAfter=4, leading=15),
        "body": ParagraphStyle("body", parent=styles["BodyText"], fontName="Helvetica",
                                fontSize=10.5, textColor=INK, leading=15.5, spaceAfter=7),
        "lede": ParagraphStyle("lede", parent=styles["BodyText"], fontName="Helvetica",
                                fontSize=12, textColor=INK_SOFT, leading=18, spaceAfter=10),
        "small": ParagraphStyle("small", parent=styles["BodyText"], fontName="Helvetica",
                                 fontSize=9, textColor=MUTED, leading=12),
        "mono": ParagraphStyle("mono", parent=styles["Code"], fontName="Courier",
                                fontSize=9.5, textColor=INK, leading=13, leftIndent=10, spaceAfter=8),
        "bullet": ParagraphStyle("bullet", parent=styles["BodyText"], fontName="Helvetica",
                                  fontSize=10.5, textColor=INK, leading=15.5, leftIndent=14,
                                  bulletIndent=2, spaceAfter=4),
    }

S = make_styles()

def hr():
    return HRFlowable(width="100%", thickness=0.5, color=HAIR, spaceBefore=4, spaceAfter=10)

def bullets(items):
    return [Paragraph(f"• &nbsp;{x}", S["bullet"]) for x in items]

def callout(title, body, color=ACCENT):
    t = Table(
        [
            [Paragraph(f"<b>{title}</b>", ParagraphStyle("ct", parent=S["body"], fontName="Helvetica-Bold", textColor=color, fontSize=10.5, leading=14))],
            [Paragraph(body, S["body"])],
        ],
        colWidths=[6.7 * inch],
    )
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), Color(color.red, color.green, color.blue, 0.06)),
        ("BOX", (0, 0), (-1, -1), 0.5, Color(color.red, color.green, color.blue, 0.35)),
        ("LEFTPADDING", (0, 0), (-1, -1), 14),
        ("RIGHTPADDING", (0, 0), (-1, -1), 14),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("ROUNDEDCORNERS", [6, 6, 6, 6]),
    ]))
    return t

def two_col_card(left_title, left_body, right_title, right_body, left_color=ACCENT, right_color=CYAN):
    def cell(title, body, color):
        return [
            Paragraph(f"<b>{title}</b>", ParagraphStyle("tc", parent=S["body"], fontName="Helvetica-Bold", textColor=color, fontSize=10.5, leading=14)),
            Paragraph(body, S["body"]),
        ]
    t = Table(
        [[cell(left_title, left_body, left_color), cell(right_title, right_body, right_color)]],
        colWidths=[3.3 * inch, 3.3 * inch],
    )
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), Color(left_color.red, left_color.green, left_color.blue, 0.05)),
        ("BACKGROUND", (1, 0), (1, 0), Color(right_color.red, right_color.green, right_color.blue, 0.05)),
        ("BOX", (0, 0), (0, 0), 0.5, Color(left_color.red, left_color.green, left_color.blue, 0.3)),
        ("BOX", (1, 0), (1, 0), 0.5, Color(right_color.red, right_color.green, right_color.blue, 0.3)),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    return t

def metric_strip(items):
    """items: list of (label, value, color)"""
    cells = []
    for label, value, color in items:
        cells.append([
            Paragraph(f"<font color='#{color.hexval()[2:]}'><b>{value}</b></font>",
                      ParagraphStyle("mv", parent=S["body"], fontSize=20, fontName="Helvetica-Bold", textColor=color, alignment=TA_CENTER, leading=22)),
            Paragraph(label, ParagraphStyle("ml", parent=S["small"], alignment=TA_CENTER)),
        ])
    table_rows = [[Table([[r[0]], [r[1]]], rowHeights=[26, 14]) for r in cells]]
    t = Table(table_rows, colWidths=[1.65 * inch] * len(cells))
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BG),
        ("BOX", (0, 0), (-1, -1), 0.5, HAIR),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, HAIR),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    return t

def build(outpath="repo-health-intelligence-explainer.pdf"):
    doc = SimpleDocTemplate(
        outpath, pagesize=letter,
        leftMargin=0.7 * inch, rightMargin=0.7 * inch,
        topMargin=0.6 * inch, bottomMargin=0.6 * inch,
        title="Repo Health Intelligence — what it is, what's done",
    )
    story = []

    # ===== PAGE 1: WHAT =====
    story.append(Paragraph("REPO HEALTH INTELLIGENCE · EXPLAINER", S["kicker"]))
    story.append(Paragraph("What this project is, in plain English", S["h1"]))
    story.append(Paragraph(
        "Imagine you're a doctor — but instead of a patient, you're examining a software codebase. "
        "Most checkup tools only tell you the patient's current weight. "
        "This project gives you the full medical chart — every change since birth, with vital signs over time, "
        "so you can see whether the patient is getting healthier or sicker.",
        S["lede"]))
    story.append(hr())

    story.append(Paragraph("The everyday analogy", S["h2"]))
    story.append(Paragraph(
        "Think of a codebase like a kitchen used by a restaurant. Every day cooks come in and rearrange things — "
        "add a new burner here, store the salt over there, hire a new chef, remove an old recipe. After two years, "
        "the kitchen still <i>works</i>, but no one really knows:",
        S["body"]))
    story += bullets([
        "<b>Is it harder to cook in than it was a year ago?</b> (Has complexity quietly grown?)",
        "<b>Where do most accidents happen?</b> (Which files cause the most bugs?)",
        "<b>If chef Tarin quits tomorrow, what stops working?</b> (Who knows which corner of the kitchen?)",
        "<b>If we accept this new recipe, will the kitchen get messier?</b> (Will merging this PR hurt us?)",
    ])
    story.append(Paragraph(
        "Repo Health Intelligence answers all four questions automatically, with numbers, charts, and explanations.",
        S["body"]))

    story.append(Paragraph("The one-screen view", S["h2"]))
    story.append(callout(
        "Every codebase gets a single Health Score from 0 to 100",
        "It's not a black box. The score is made of five clearly named ingredients (we call them subscores). "
        "If the score drops, you can see exactly which ingredient went bad, click the dip, and read a plain-language "
        "explanation of why.",
        color=ACCENT,
    ))

    story.append(Spacer(1, 12))
    story.append(Paragraph("The five ingredients of the Health Score", S["h2"]))
    rows = [
        ["Complexity drift", "Is the code getting more tangled over time?", "0 = same as day 1   ·   1 = much worse"],
        ["Test coverage", "How much of the code has safety nets (tests) on it?", "0 = no tests   ·   1 = lots of tests"],
        ["Hotspot risk", "Are bugs concentrating in a few risky files?", "0 = evenly spread   ·   1 = one file is a bomb"],
        ["Dependency rot", "How many outside libraries do we lean on, and how long since we touched them?", "0 = healthy   ·   1 = stale and bloated"],
        ["Architectural drift", "Are the parts of the system getting tangled (circular dependencies, orphans)?", "0 = clean structure   ·   1 = spaghetti"],
    ]
    tbl_data = [[
        Paragraph(f"<b>{r[0]}</b>", ParagraphStyle("tn", parent=S["body"], fontName="Helvetica-Bold", textColor=INK)),
        Paragraph(r[1], S["body"]),
        Paragraph(r[2], S["small"]),
    ] for r in rows]
    t = Table(tbl_data, colWidths=[1.5 * inch, 3.3 * inch, 1.9 * inch])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, HAIR),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(t)

    # ===== PAGE 2: HOW IT WORKED ON A REAL REPO =====
    story.append(PageBreak())
    story.append(Paragraph("LIVE DEMO · TARINAGARWAL / EDULUME", S["kicker"]))
    story.append(Paragraph("What it found in a real project", S["h1"]))
    story.append(Paragraph(
        "We pointed the system at a public learning-platform codebase called Edulume. "
        "It read all 109 commits (every change ever made to the project), built a knowledge map of every file, "
        "and computed the five subscores at every point in history. The whole thing took about 30 seconds on a laptop.",
        S["lede"]))

    story.append(Paragraph("The headline numbers", S["h2"]))
    story.append(metric_strip([
        ("Starting health", "55.2", GOOD),
        ("Today's health", "28.2", BAD),
        ("Net drop", "−27.0", WARN),
        ("Days alive", "~270", MUTED),
    ]))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        "<b>Translation:</b> the project started in decent shape but has been quietly getting worse for almost a year. "
        "Without this tool, nobody on the team would notice.",
        S["body"]))

    story.append(Paragraph("Specific things the system caught", S["h2"]))
    story += bullets([
        "<b>Biggest single drop happened the day someone added a discussion forum</b> — health fell 18 points overnight because the new feature shipped without tests and doubled the size of the codebase.",
        "<b>One file (</b><font face='Courier'>client/src/utils/api.ts</font><b>) is the #1 risk</b> — touched 19 times, very complex. If something breaks, it's almost certainly here.",
        "<b>Two files actually depend on each other in a circle</b> — <font face='Courier'>TestTimeRemaining</font> ↔ <font face='Courier'>TestPageStandalone</font>. This is a textbook bug magnet.",
        "<b>One person (the founder) owns 87% of the server code and 100% of the auth code.</b> If they go on vacation, no one else knows how the login flow works.",
        "<b>If you were to merge the experimental \"olive theme\" branch</b>, the system predicts health would drop another 2.1 points — mostly because it concentrates more bug risk into already-risky files.",
    ])

    story.append(Spacer(1, 10))
    story.append(callout(
        "Why this matters",
        "These five findings are exactly the kind of insight an experienced engineer would surface in a code review — "
        "but only if they spent days reading every commit. The system does it in 30 seconds and updates as the team ships.",
        color=CYAN,
    ))

    # ===== PAGE 3: WHAT'S BUILT =====
    story.append(PageBreak())
    story.append(Paragraph("WHAT'S DONE · CHECKLIST", S["kicker"]))
    story.append(Paragraph("Everything the brief asked for, plus four bonus features", S["h1"]))

    story.append(Paragraph("The brief asked for five things. All five are done.", S["h2"]))
    core = [
        ("Walk a repo's history and build a per-commit code map", "Tree-sitter parser handles 5 programming languages."),
        ("A health score with at least 4 explainable subscores", "We built 5. Each one has a one-line explanation."),
        ("Time-series dashboard with PR-level annotations", "Health curve, with red dots marking moments the score dropped."),
        ("Knowledge graph diff — compare any two commits", "Shows files added, removed, restructured, plus changed imports."),
        ("Hotspot map — where do bugs live", "Ranked list with bar visualization, color-graded."),
    ]
    for title, body in core:
        story.append(Table(
            [[
                Paragraph(f"<font color='#{GOOD.hexval()[2:]}'><b>✓</b></font>",
                          ParagraphStyle("ck", parent=S["body"], fontSize=14, textColor=GOOD)),
                Paragraph(f"<b>{title}.</b> {body}", S["body"]),
            ]],
            colWidths=[0.3 * inch, 6.4 * inch],
            style=TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 1),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ])
        ))

    story.append(Paragraph("The brief also listed bonus objectives. We hit four of them.", S["h2"]))
    bonus = [
        ("Bus factor per module", "Shows who owns each part of the code and which parts collapse if one person leaves."),
        ("Architectural drift detection", "Catches when files start forming dependency circles or become disconnected."),
        ("LLM 'why did health drop' narrative", "Click any dip → AI writes a 2-3 sentence explanation, with a free fallback when no API key is set."),
        ("Pre-merge health prediction", "Pick any open branch, see exactly how merging it would shift the health score before you ship."),
        ("Multi-language support", "TypeScript, JavaScript, JSX/TSX, and Python all supported."),
    ]
    for title, body in bonus:
        story.append(Table(
            [[
                Paragraph(f"<font color='#{ACCENT.hexval()[2:]}'><b>★</b></font>",
                          ParagraphStyle("st", parent=S["body"], fontSize=12, textColor=ACCENT)),
                Paragraph(f"<b>{title}.</b> {body}", S["body"]),
            ]],
            colWidths=[0.3 * inch, 6.4 * inch],
            style=TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 1),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ])
        ))

    story.append(Paragraph("Bonus extras we added on our own", S["h2"]))
    story += bullets([
        "<b>Interactive knowledge-graph visualization</b> — every file as a glowing node, every import as a line, complexity shown by node size and color.",
        "<b>Circular-dependency detection</b> — finds tangled code automatically using a classic graph algorithm (Tarjan SCC).",
        "<b>Orphan-file detector</b> — flags files that nothing imports and that import nothing — often forgotten dead code.",
        "<b>Tabbed dashboard UI</b> with a distinct violet/cyan visual identity and animated brand mark.",
    ])

    # ===== PAGE 4: LLM COST + TECH + ASK =====
    story.append(PageBreak())
    story.append(Paragraph("HOW WE STAYED RESPONSIBLE", S["kicker"]))
    story.append(Paragraph("Why our AI usage is cheap, auditable, and optional", S["h1"]))
    story.append(Paragraph(
        "The hackathon brief specifically said \"LLM usage must be cost-justified — every call defended.\" "
        "Here's our discipline:",
        S["lede"]))
    story += bullets([
        "<b>Only one part of the app calls an AI model</b> — the \"explain this dip\" button.",
        "<b>It only runs when a human clicks it</b> — never automatically, never during ingestion. Reading a repo costs zero AI calls.",
        "<b>We send small, structured prompts</b> — not source code. The prompt is a short list of numbers (the score deltas) plus a few file names. About 600 tokens regardless of repo size.",
        "<b>Every answer is cached forever.</b> Clicking the same dip twice doesn't re-run the model.",
        "<b>Output is capped at 280 tokens.</b> A single dip explanation costs a fraction of a US cent on Claude Haiku.",
        "<b>Without an API key, the feature still works</b> — we fall back to a deterministic rule-based summary written from the same data. The user never sees a broken button.",
    ])

    story.append(Paragraph("What it's built with", S["h2"]))
    story.append(two_col_card(
        "The brain (offline)",
        "Node.js script reads git history, parses every file with tree-sitter (an industry-standard code parser used by GitHub itself), and stores the results in a local SQLite database. No cloud needed.",
        "The face (web app)",
        "Next.js + React dashboard. Charts via Recharts. Knowledge graph drawn on HTML canvas with a custom force-directed layout. Optional Claude Haiku narratives via Vercel AI Gateway.",
    ))

    story.append(Paragraph("Where to find it", S["h2"]))
    story.append(Paragraph(
        "<b>Code:</b> &nbsp; <font face='Courier'>github.com/avinrique/repo-health-intelligence</font><br/>"
        "<b>Demo repo:</b> &nbsp; <font face='Courier'>github.com/tarinagarwal/Edulume</font> &nbsp; (109 commits, real-world)<br/>"
        "<b>Pitch deck:</b> &nbsp; <font face='Courier'>repo-health-intelligence.pptx</font> in the same directory as this PDF",
        S["body"]))

    story.append(Paragraph("If you have 60 seconds, look at this", S["h2"]))
    story.append(callout(
        "The single most powerful demo",
        "On the dashboard, click the biggest red dot on the health chart. The system instantly tells you it was the "
        "\"add discussion forum\" commit, that health dropped 18 points, that the cause was complexity growth and missing "
        "tests, and that two specific files (DiscussionDetailPage.tsx, server/routes/discussions.js) carry most of the "
        "new risk — all without you ever reading the code.",
        color=BAD,
    ))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "That's the whole pitch in one click: any team, on any repo, gets a doctor's-eye view of their codebase's vital signs over time.",
        S["body"]))

    doc.build(story)
    print(f"wrote {outpath}")

if __name__ == "__main__":
    build()
