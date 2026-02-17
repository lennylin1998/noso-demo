"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

const DEFAULT_HASH = "demo-001";

const PROCEDURE_LABELS = {
  introduction: "Introduction",
  problem_diagnosis: "Problem diagnosis",
  solution_explanation: "Solution explanation",
  closing_thank_you: "Closing thank you",
  maintenance_plan_offer: "Maintenance plan offer"
};

const SALES_LABELS = {
  customer_buying_signal: "Customer buying signal",
  tech_upsell_attempt: "Tech upsell attempt",
  opportunity_cue: "Opportunity cue"
};

function parseTranscript(rawText) {
  if (!rawText) return [];
  const regex = /^Speaker (.+?): (.*?)(?=\n\nSpeaker |\nSpeaker |$)/gms;
  const units = [];
  let match;
  let index = 0;
  while ((match = regex.exec(rawText))) {
    const rawSegment = match[2];
    const startOffset = match.index + match[0].indexOf(rawSegment);
    const leading = rawSegment.length - rawSegment.trimStart().length;
    const trailing = rawSegment.length - rawSegment.trimEnd().length;
    const text = rawSegment.trim();
    const startChar = startOffset + leading;
    const endChar = startOffset + rawSegment.length - trailing;

    const speakerLabel = match[1].toLowerCase();
    let speaker = "OTHER";
    if (speakerLabel.includes("technician")) speaker = "TECH";
    if (speakerLabel.includes("house owner") || speakerLabel.includes("homeowner")) {
      speaker = "HOMEOWNER";
    }

    units.push({
      id: `u${String(index + 1).padStart(4, "0")}`,
      speaker,
      text,
      startChar,
      endChar,
      procedureTags: [],
      salesTags: []
    });
    index += 1;
  }
  return units;
}

function EvidenceChips({ ids, onSelect }) {
  if (!ids || ids.length === 0) {
    return <p>None referenced.</p>;
  }
  return (
    <div className="evidence">
      {ids.map((id) => (
        <button key={id} type="button" onClick={() => onSelect(id)}>
          {id}
        </button>
      ))}
    </div>
  );
}

function Badge({ mode, tag }) {
  const label = mode === "procedure" ? PROCEDURE_LABELS[tag] : SALES_LABELS[tag];
  return <span className={`badge ${mode}-${tag}`}>{label}</span>;
}

function PageContent() {
  const searchParams = useSearchParams();
  const transcriptHash = searchParams.get("hash") || DEFAULT_HASH;
  const [versions, setVersions] = useState([1]);
  const [selectedVersion, setSelectedVersion] = useState(1);
  const [analysis, setAnalysis] = useState(null);
  const [transcriptText, setTranscriptText] = useState("");
  const [promptNotes, setPromptNotes] = useState(null);
  const [promptText, setPromptText] = useState("");
  const [highlightMode, setHighlightMode] = useState("procedure");
  const [activeUnitId, setActiveUnitId] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  useEffect(() => {
    async function loadManifest() {
      try {
        const res = await fetch(`/data/${transcriptHash}/manifest.json`);
        if (res.ok) {
          const payload = await res.json();
          const versionList = payload.versions || [1];
          setVersions(versionList);
          setSelectedVersion((current) => (versionList.includes(current) ? current : versionList[0]));
          return;
        }
      } catch (err) {
        console.error("Failed to load manifest", err);
      }
      setVersions([1]);
      setSelectedVersion(1);
    }
    loadManifest();
  }, [transcriptHash]);

  useEffect(() => {
    async function loadData() {
      try {
        const [transcriptRes, analysisRes, promptNotesRes, promptRes] = await Promise.all([
          fetch(`/data/${transcriptHash}/transcript.txt`),
          fetch(`/data/${transcriptHash}/analysis.v${selectedVersion}.json`),
          fetch("/analysis/prompt-notes.json"),
          fetch(`/data/${transcriptHash}/prompts.v${selectedVersion}.md`)
        ]);

        if (transcriptRes.ok) {
          setTranscriptText(await transcriptRes.text());
        }
        if (analysisRes.ok) {
          setAnalysis(await analysisRes.json());
        }
        if (promptNotesRes.ok) {
          setPromptNotes(await promptNotesRes.json());
        }
        if (promptRes.ok) {
          setPromptText(await promptRes.text());
        } else {
          setPromptText("Prompt file missing for this version.");
        }
      } catch (err) {
        console.error("Failed to load data", err);
      }
    }
    loadData();
  }, [transcriptHash, selectedVersion]);

  const units = useMemo(() => {
    if (analysis?.units && analysis.units.length > 0) {
      return analysis.units;
    }
    return parseTranscript(transcriptText);
  }, [analysis, transcriptText]);

  const promptMeta = promptNotes?.[String(selectedVersion)];

  const handleEvidenceSelect = (id) => {
    setActiveUnitId(id);
    const element = document.getElementById(`unit-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const solutionGroups = [
    {
      id: "solution-1",
      label: "Same type, updated version, better efficiency",
      ranges: [["u0018", "u0018"]],
      comment: "The techician quickly go over the two option of upgrading current system. Point out the benefit and cost in one or two sentences, and smoothly transition to next heat pump option with state policy."
    },
    {
      id: "solution-2",
      label: "Heat pump",
      ranges: [["u0020", "u0028"]],
      comment: "Mentioning the reabate and make heat pump sound: 'reasonable' is a smart move. Let the customer feel it's a good deal. Emphasizing the thermostat upgrade option is to 'make client easier' is also a subtle but brilliant move."
    },
    {
      id: "solution-3",
      label: "Water damage solution — plywood replacement",
      ranges: [["u0030", "u0030"]],
      comment: "Probably telling from experience, water damage is the most common issue houseowners have."
    },
    {
      id: "solution-4",
      label: "Heat pump cont.",
      ranges: [["u0034", "u0048"]],
      comment: "Digging into more details of heat pump. Introduing HERS test, and seaminglessly bring out duct sealing service. Then the benefit of heat pump. The technician put a lot good words on this one, probably the most important product of their line. The technician also does a great job in including all possible discount/promotion/rebates. It should make client feel genuine."
    },
    {
      id: "solution-5",
      label: "Daikin heat pump",
      ranges: [["u0054", "u0056"]],
      comment: "Clinet is interested in one of the item on the list. Technician does a great job explaining the brand, Daikin, and good parnership with the brand. Probably a little bit too hastle in diving into technical detail. Mabye ask the client why they are interested in this particular product before extending on the defrosting topic."
    },
    {
      id: "solution-6",
      label: "Attic package",
      ranges: [["u0058", "u0064"]],
      comment: "The technician responds to client's request to move the machine to another place. Great work explaining why current option is the best choice, and the cost comes with moving it."
    },
    {
      id: "solution-7",
      label: "Noise reduction",
      ranges: [["u0068", "u0070"]],
      comment: "The technician quicly understand client's real pain point, and offer a noise reduction solution."
    },
    {
      id: "solution-8",
      label: "Customer preference and Bosch item lookup",
      ranges: [["u0073", "u0092"]],
      comment: "Client gives another preference signal here. The technician again responds promptly, introduce the brand, Boche, that client seems interested in, and lookup product detail for a potential rebate."
    },
    {
      id: "solution-9",
      label: "Installation time",
      ranges: [["u0093", "u0096"]],
      comment: "The technician explains default time expected, and offers an option for quicker installation time. A witty move to make. Since the houseowner asks about time, it must mean that time is something they value."
    },
    {
      id: "solution-10",
      label: "Financing",
      ranges: [["u0099", "u0116"]],
      comment: "Very detailed explanation on financing plan. Clearly point out any intrinsic cost of paying off earlier."
    },
    {
      id: "solution-11",
      label: "Sign option and guarantee",
      ranges: [["u0122", "u0122"]],
      comment: "Strong call to action. A invitation to down payment and seal the deal is on point. No further pushing is another great choice, after client explicitly says no."
    }
  ];

  const introRanges = [["u0002", "u0002"]];
  const diagnosisRanges = [["u0014", "u0014"]];
  const closingRanges = [["u0122", "u0122"]];

  const groupRanges = [
    { kind: "intro", ranges: introRanges },
    { kind: "diagnosis", ranges: diagnosisRanges },
    { kind: "solution", ranges: solutionGroups.flatMap((group) => group.ranges) },
    { kind: "closing", ranges: closingRanges }
  ];

  const unitNumber = (id) => Number(id.replace("u", ""));
  const isInRange = (unitId, startId, endId) => {
    const value = unitNumber(unitId);
    return value >= unitNumber(startId) && value <= unitNumber(endId);
  };

  const unitGroupClass = (unitId) => {
    for (const group of groupRanges) {
      for (const [startId, endId] of group.ranges) {
        if (isInRange(unitId, startId, endId)) {
          return `group-${group.kind}`;
        }
      }
    }
    return "";
  };

  const unitGroupLabel = (unitId) => {
    for (const group of groupRanges) {
      for (const [startId, endId] of group.ranges) {
        if (isInRange(unitId, startId, endId)) {
          return group.kind;
        }
      }
    }
    return "";
  };

  const salesTaggedUnits = units.filter((unit) => unit.salesTags?.length > 0);

  return (
    <main>
      <section className="hero">
        <h1>HVAC Call Analyzer</h1>
        <p>
          Review a full transcript with evidence-linked highlights, sales signals, and procedure
          compliance. Switch prompt versions to compare prompt design outcomes.
        </p>
      </section>

      <section className="controls">
        <div className="control-group">
          <span>Highlight mode</span>
          <div className="toggle">
            <button
              type="button"
              className={highlightMode === "procedure" ? "active" : ""}
              onClick={() => setHighlightMode("procedure")}
            >
              Procedure
            </button>
            <button
              type="button"
              className={highlightMode === "sales" ? "active" : ""}
              onClick={() => setHighlightMode("sales")}
            >
              Sales
            </button>
          </div>
        </div>

        <div className="control-group">
          <span>Prompt version</span>
          <select
            value={selectedVersion}
            onChange={(event) => setSelectedVersion(Number(event.target.value))}
          >
            {versions.map((version) => (
              <option key={version} value={version}>
                v{version}
              </option>
            ))}
          </select>
        </div>

        <button className="control-button" type="button" onClick={() => setShowPrompt(true)}>
          View Prompt
        </button>
        <button className="control-button" type="button" onClick={() => setShowNotes(true)}>
          View Prompt Notes
        </button>
      </section>

      <section className="grid">
        <div className="panel transcript">
          {units.map((unit) => {
            const tags = highlightMode === "procedure" ? unit.procedureTags : unit.salesTags;
            const groupClass =
              highlightMode === "procedure"
                ? unitGroupClass(unit.id)
                : unit.salesTags?.length
                ? `sales-${unit.salesTags[0]}`
                : "";
            const groupLabel = unitGroupLabel(unit.id);
            return (
              <article
                key={unit.id}
                id={`unit-${unit.id}`}
                className={`unit ${groupClass} ${activeUnitId === unit.id ? "is-active" : ""}`}
              >
                <div className="unit-header">
                  <div className="unit-meta">
                    <span className="unit-id">{unit.id}</span>
                    <span className="speaker">{unit.speaker}</span>
                  </div>
                  <div className="badges">
                    {highlightMode === "procedure" && groupLabel ? (
                      <span className={`badge group-badge ${groupClass}`}>{groupLabel}</span>
                    ) : null}
                    {tags.map((tag) => (
                      <Badge key={`${unit.id}-${tag}`} mode={highlightMode} tag={tag} />
                    ))}
                  </div>
                </div>
                <p className="unit-text">{unit.text}</p>
              </article>
            );
          })}
        </div>

        <aside className="panel sidebar">
          <section className="section">
            <h3>Call type</h3>
            <div className="kv">
              <div className="kv-row">
                {analysis?.callType?.type || "unknown"}
                <span>{analysis?.callType?.confidence || "unknown"}</span>
              </div>
            </div>
            <p>{analysis?.callType?.reason || "No reasoning provided yet."}</p>
            <EvidenceChips
              ids={analysis?.callType?.evidenceUnitIds}
              onSelect={handleEvidenceSelect}
            />
          </section>

          {highlightMode === "procedure" ? (
            <section className="section">
              <h3>Procedure comments</h3>
              <div className="comment-block comment-intro">
                <div className="comment-header">
                  <span>Introduction</span>
                  <div className="comment-ids">
                    <button type="button" onClick={() => handleEvidenceSelect("u0002")}>
                      u0002
                    </button>
                  </div>
                </div>
                <div className="comment-placeholder">No formal introduction, just a brief opening. It should be that they've met earlier, and the houseowner let the technicain do the maintenance work. This is the converastion after the work is done.</div>
              </div>

              <div className="comment-block comment-diagnosis">
                <div className="comment-header">
                  <span>Problem diagnosis</span>
                  <div className="comment-ids">
                    <button type="button" onClick={() => handleEvidenceSelect("u0014")}>
                      u0014
                    </button>
                  </div>
                </div>
                <div className="comment-placeholder">Explain that this maintenance work is just temporary remedy, so hop into the cure -- new installation.</div>
              </div>

              <div className="group-divider">
                <span>Solution explanation</span>
              </div>

              {solutionGroups.map((group) => (
                <div key={group.id} className="comment-block comment-solution">
                  <div className="comment-header">
                    <span>{group.label}</span>
                    <div className="comment-ids">
                      {group.ranges.map(([startId, endId]) => (
                        <button
                          key={`${group.id}-${startId}`}
                          type="button"
                          onClick={() => handleEvidenceSelect(startId)}
                        >
                          {startId === endId ? startId : `${startId}–${endId}`}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="comment-placeholder">
                    {group.comment}
                  </div>
                </div>
              ))}

              <div className="comment-block comment-closing">
                <div className="comment-header">
                  <span>Closing thank you</span>
                  <div className="comment-ids"></div>
                </div>
                <div className="comment-placeholder">No closing and thank you is recorded. The technicain probably ends recording earlier.</div>
              </div>
            </section>
          ) : (
            <section className="section">
              <h3>Sales comments</h3>
              {salesTaggedUnits.length === 0 ? (
                <p>No sales-tagged messages found.</p>
              ) : (
                salesTaggedUnits.map((unit) => (
                  <div
                    key={unit.id}
                    className={`comment-block comment-sales comment-sales-${unit.salesTags[0]}`}
                  >
                    <div className="comment-header">
                      <span>Sales comment</span>
                      <div className="comment-ids">
                        <button type="button" onClick={() => handleEvidenceSelect(unit.id)}>
                          {unit.id}
                        </button>
                      </div>
                    </div>
                    <div className="comment-tags">
                      {unit.salesTags.map((tag) => (
                        <Badge key={`${unit.id}-${tag}`} mode="sales" tag={tag} />
                      ))}
                    </div>
                    <div className="comment-placeholder">
                      Write your sales comment here for {unit.id}.
                    </div>
                  </div>
                ))
              )}
            </section>
          )}
        </aside>
      </section>

      {showPrompt && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h2>Prompt v{selectedVersion}</h2>
            <pre>{promptText}</pre>
            <button className="control-button" type="button" onClick={() => setShowPrompt(false)}>
              Close
            </button>
          </div>
        </div>
      )}

      {showNotes && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h2>Prompt notes v{selectedVersion}</h2>
            {promptMeta ? (
              <div className="prompt-meta">
                <strong>{promptMeta.title}</strong>
                <div>Design logic: {promptMeta.designLogic.join("; ")}</div>
                <div>Issues addressed: {promptMeta.issuesAddressed.join("; ")}</div>
                <div>New issues: {promptMeta.newIssuesObserved.join("; ")}</div>
                <div>Next triage: {promptMeta.nextTriageIdeas.join("; ")}</div>
              </div>
            ) : (
              <p>No prompt notes found.</p>
            )}
            <button className="control-button" type="button" onClick={() => setShowNotes(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<main className="loading">Loading...</main>}>
      <PageContent />
    </Suspense>
  );
}
