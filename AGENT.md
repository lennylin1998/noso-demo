# HVAC Call Analyzer — Spec (Vercel + Next.js + Versioned LLM Artifacts)

> Updated per instructions: **no transcript hash computation**, **LLM calls run via a developer CLI script**, **version-controlled prompt design**, and **frontend can toggle prompt version + view prompt + prompt notes**.

---

## 1) Requirements

### 1.1 Inputs & Data
- Accept **one transcript text file** (plain text) containing the full conversation.
- Transcript format: **speaker-labeled turns**, e.g.
  - `Speaker House owner: ...`
  - `Speaker HVAC technician: ...`
- A **transcriptHash** (or other stable ID) is **provided externally** (by user/dev/workflow).  
  - **Do not compute** transcript hash in the app or scripts.
  - This `transcriptHash` is used as the folder/key for storing analysis artifacts.

### 1.2 Parsing / Unitization
- Parse transcript into **ordered units** (preferably speaker turns, not sentences).
- Assign each unit a **stable unique identifier** (e.g., `u0001`, `u0002`, …).
- Track **text offsets** for highlighting:
  - For each unit: `startChar`, `endChar` (in the full transcript string).
- Normalize speaker names into canonical enums:
  - `TECH` and `HOMEOWNER` (and optionally `OTHER`).

### 1.3 Analysis Outputs (Single Canonical JSON Artifact per Prompt Version)
The analysis must produce one artifact containing:

#### A) Call Type Identification
- Determine one of:
  - `repair_call` | `maintenance_visit` | `installation`
- Provide:
  - `confidence` (0–1 or discrete: low/med/high)
  - short `reason`
  - `evidenceUnitIds` (IDs supporting the decision)

#### B) Procedure Compliance Detection (highlight if present; otherwise absent/unknown)
Detect and highlight:
- (a) `introduction`
- (b) `problem_diagnosis`
- (c) `solution_explanation`
- (d) `closing_thank_you`
- (e) `maintenance_plan_offer`

For each category:
- `present`: `true | false | "unknown"`
- `evidenceUnitIds`: list of unit IDs supporting the determination
- `summary`: 1–2 sentence evaluation of how well the technician performed that part


#### C) Sales Insights
Tag units as:
- `customer_buying_signal` (typically HOMEOWNER)
- `tech_upsell_attempt` (TECH)
- `opportunity_cue` (either speaker; e.g., “unit is old”, “bandaid”, “options”, reliability/comfort risk)

Outputs:
1) Highlight any sales signals/cues and upsell attempts (evidence unit IDs).
2) Provide a short overall sales coaching summary:
   - what was done well
   - what was missed
   - recommended next actions
3) Provide “missed opportunities”:
   - Identify `customer_buying_signal` or `opportunity_cue` that is **not followed** by a relevant `tech_upsell_attempt` within the next **N units** (default N = 6).
   - Include explanation + suggested tech response.

### 1.4 Versioned Prompt Design & Artifacts
- The prompt design is version-controlled with a constant:
  - `PROMPT_VERSION = 1` (initial value)
- Analysis output files must be named after the prompt version.
- If the current version does **not** have a corresponding output artifact file, developers run the CLI script to generate it.

### 1.5 Non-Functional Requirements
- **No client-side secrets**: OpenAI API key must not be exposed to the browser.
- **Deterministic rendering**: UI renders from:
  1) raw transcript text
  2) a selected version’s analysis artifact
- **Auditable**: Every major claim references **evidence unit IDs**.


---

## 2) Frontend UI Description (Single Page)

### 2.1 Hydration Inputs
Frontend must load:
- Raw transcript text (from local/static file or fetched from a path)
- A set of **stored analysis artifact JSONs** (one per prompt version) associated with the provided `transcriptHash`.

Recommended file structure (public or fetched endpoint):

/data/
/{transcriptHash}/
transcript.txt
analysis.v1.json
analysis.v2.json
prompts.v1.md
prompts.v2.md
prompt-notes.json

### 2.2 Layout
- Single-page view with:
  - **Main transcript panel (left)**: rendered as readable turns
  - **Right sidebar (right)**: summaries, evidence chips, prompt info
  - **Top controls**:
    - Toggle: Procedure vs Sales highlighting
    - Dropdown: Prompt Version (e.g., v1, v2, …)
    - Button: View Prompt (modal/drawer)
    - Button: View Prompt Notes (modal/drawer)

### 2.3 Transcript Display & Highlighting
- Render transcript as a list of **speaker turns** (units).
- Highlight modes:
  1) **Procedure Mode**
     - Highlight by procedure tags (a–e) in distinct colors.
  2) **Sales Mode**
     - Highlight by sales tags in distinct colors.

Handling multiple tags:
- Allow multiple tags per unit. Use stacked badges or a priority rule.

### 2.4 Sidebar Content
When a prompt version is selected:
- Show call type + reason + evidence IDs.
- Procedure checklist (a–e):
  - Present/Absent/Unknown, summary, evidence chips
- Sales section:
  - Signals/cues IDs
  - Upsell attempt IDs
  - Missed opportunities list (each with trigger IDs + suggested response)
  - Coaching summary
- Evidence chips scroll to unit and briefly emphasize it.

### 2.5 Prompt Version UI + Prompt Design Notes
Provide a dedicated section titled **“Prompt Design”** with:
- Selected `PROMPT_VERSION`
- Short description of the prompt’s design logic and guardrails
- Issues addressed vs prior versions
- New issues observed
- Possible next triage solutions / experiments

Data source:
- `prompt-notes.json` (recommended), keyed by version
- Prompt text itself stored in `prompts.v{n}.md`

---

## 3) Backend / Developer Workflow (CLI Script; No Runtime LLM Calls Required)

> Per updated instructions, **LLM calls are performed by developers from terminal**, generating versioned artifacts checked into the repo or uploaded to storage/CDN.

### 3.1 Repository Layout (Suggested)

/analysis/
/prompts/
v1.md
v2.md
prompt-notes.json
schema.json
/scripts/
analyze-transcript.ts
/data/
/{transcriptHash}/
transcript.txt
analysis.v1.json
prompts.v1.md

### 3.2 CLI Script Responsibilities
Script name (example): `scripts/analyze-transcript.ts`

Inputs:
- `--transcriptHash <id>` (required; provided externally)
- `--transcriptPath <path>` (required)
- `--version <n>` (optional; default to `PROMPT_VERSION`)
- `--outDir <dir>` (optional; default `data/{transcriptHash}`)
- `--windowSize <n>` (optional; default 6)
- `--model <string>` (optional; default chosen model)

Steps:
1) Read transcript text from `--transcriptPath`.
2) Parse into units (speaker turns), assign unit IDs, compute start/end offsets.
3) Load prompt template for version `v{n}` from `/analysis/prompts/v{n}.md`.
4) Determine expected output file:
   - `analysis.v{n}.json` in `{outDir}`
5) If `analysis.v{n}.json` already exists:
   - Exit successfully (no API call), unless `--force` is provided.
6) If it does not exist:
   - Call OpenAI API once to produce the canonical analysis JSON.
   - Validate against JSON schema (`/analysis/schema.json`).
   - Write:
     - `analysis.v{n}.json`
     - optionally `units.json` (debug)
     - copy prompt file into `prompts.v{n}.md` under `{outDir}` for provenance.

### 3.3 Prompt Version Constant
- In the script (and optionally shared config), define:
  - `export const PROMPT_VERSION = 1;`
- Output file naming:
  - `analysis.v{PROMPT_VERSION}.json`
- Prompt file naming:
  - `/analysis/prompts/v{PROMPT_VERSION}.md`

### 3.4 Storage & Serving
- Artifacts can be:
  - committed into repo under `/data/{transcriptHash}/...` for demo
  - or uploaded to object storage (S3/R2) and fetched by the frontend
- Frontend must be able to enumerate available versions:
  - either by listing known versions in a manifest file:
    - `/data/{transcriptHash}/manifest.json`
  - or by a static list configured in code.

---

## 4) LLM Design: Prompt, Input, Expected Output

### 4.1 Prompt Versioning Rules
- Each prompt version is a file:
  - `/analysis/prompts/v{n}.md`
- Prompt notes are stored separately:
  - `/analysis/prompt-notes.json` keyed by version
- CLI script must embed the version number into:
  - `analysis.meta.promptVersion`
  - output filename `analysis.v{n}.json`

### 4.2 LLM Input (Recommended)
Provide **structured units** to reduce model confusion.

Input payload to LLM:
- `transcriptHash` (provided)
- `windowSize`
- `units[]`:
  - `id`, `speaker`, `text`, `startChar`, `endChar`
- Optionally include `rawTranscriptText` (but prefer units as primary truth)

### 4.3 Prompt Template (v{n}.md)
Prompt should instruct:
- Output **JSON only** matching schema
- Every major claim includes `evidenceUnitIds`
- Units may have multiple tags
- If transcript ends abruptly, `closing_thank_you.present = "unknown"`

Also define sales tags carefully:
- `customer_buying_signal`: customer expresses interest, urgency, budget/timeline, dissatisfaction, desire for options
- `opportunity_cue`: replacement/upgrade trigger (age, bandaid fix, frequent breakdown risk, comfort issues)
- `tech_upsell_attempt`: presenting upgrade/plan/IAQ/financing/options, asking discovery/close questions, scheduling next step

### 4.4 Expected Output (Canonical JSON Schema)
Top-level keys:
- `transcriptHash: string`
- `callType: { type, confidence, reason, evidenceUnitIds: string[] }`
- `units: UnitAnnotation[]`
- `procedure: ProcedureSection`
- `sales: SalesSection`
- `meta: { model: string, createdAt: string, promptVersion: number, notes?: string }`

`UnitAnnotation`:
- `id: string`
- `speaker: "TECH" | "HOMEOWNER" | "OTHER"`
- `text: string`
- `startChar: number`
- `endChar: number`
- `procedureTags: ("introduction" | "problem_diagnosis" | "solution_explanation" | "closing_thank_you" | "maintenance_plan_offer")[]`
- `salesTags: ("customer_buying_signal" | "tech_upsell_attempt" | "opportunity_cue")[]`

`ProcedureSection`:
- `introduction: { present, evidenceUnitIds, summary, score? }`
- `problem_diagnosis: { present, evidenceUnitIds, summary, score? }`
- `solution_explanation: { present, evidenceUnitIds, summary, score? }`
- `closing_thank_you: { present, evidenceUnitIds, summary, score? }`
- `maintenance_plan_offer: { present, evidenceUnitIds, summary, score? }`
- `overallSummary: string`

`SalesSection`:
- `signals: { unitIds: string[], summary: string }`
- `upsellAttempts: { unitIds: string[], summary: string }`
- `opportunityCues: { unitIds: string[], summary: string }`
- `missedOpportunities: MissedOpportunity[]`
- `coachingSummary: string`

`MissedOpportunity`:
- `triggerUnitIds: string[]`
- `reasonMissed: string`
- `suggestedTechResponse: string`
- `expectedUpsellType: "maintenance_plan" | "replacement_options" | "IAQ" | "thermostat" | "ductwork" | "other"`

### 4.5 “Missing Output” Logic (Developer Script Contract)
- Rule: If `analysis.v{PROMPT_VERSION}.json` does not exist for the transcriptHash:
  - Running the CLI script must generate it.
- Frontend should not attempt to call OpenAI; it only renders stored artifacts.

---

## 5) Prompt Design Notes (Versioned Documentation)

### 5.1 prompt-notes.json (Suggested Structure)
A JSON file keyed by version:
```json
{
  "1": {
    "title": "Single-pass canonical artifact with evidence IDs",
    "designLogic": [
      "Provide units to reduce parsing ambiguity",
      "Require evidenceUnitIds for every major claim",
      "Tag procedure + sales in one artifact to avoid cross-pass drift"
    ],
    "issuesAddressed": [
      "Inconsistent labels from multiple LLM passes",
      "Sentence-level fragmentation; moved to turn-level units"
    ],
    "newIssuesObserved": [
      "Over-tagging when tech discusses 'options' casually",
      "Ambiguity between 'opportunity_cue' and 'tech_upsell_attempt'"
    ],
    "nextTriageIdeas": [
      "Add stricter definitions and examples for sales tags",
      "Introduce confidence per tag or require minimal evidence threshold",
      "Optionally add a small deterministic post-pass for missed opportunity pairing"
    ]
  }
}

5.2 Frontend Rendering of Prompt Notes
	•	When user selects version vN, display:
	•	Prompt title
	•	design logic bullets
	•	issues addressed
	•	new issues observed
	•	next triage ideas
	•	Also show the raw prompt text (from prompts.vN.md) in a modal/drawer.

⸻

Appendix: Defaults
	•	PROMPT_VERSION = 1
	•	windowSize = 6
	•	Unitization: speaker turns
	•	Output filenames:
	•	analysis.v{n}.json
	•	prompts.v{n}.md

// "u0018": same type, updated version, better efficiency
// "u0020"-"u0028": heat pump
// "u0030": water damage solution -- plywood replacement
// "u0034"-"u0048": heat pump cont.
// "u0054" - "u0056": Daikin heatpump
// "u0058" - "u0064": attic package
// "u0068" - "u0070": Noise reduction
// "u0073" - "u0092": Customer preference and Boche item lookup
// "u0093" - "u0096": Installation time
// "u0099" - "u0116": Financing
// "u0122": Sign option and guarantee