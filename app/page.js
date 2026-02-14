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

  const renderProcedureItem = (key) => {
    const item = analysis?.procedure?.[key];
    if (!item) return null;
    return (
      <li key={key}>
        <strong>{PROCEDURE_LABELS[key]}:</strong> {String(item.present)}
        <p>{item.summary}</p>
        <EvidenceChips ids={item.evidenceUnitIds} onSelect={handleEvidenceSelect} />
      </li>
    );
  };

  const renderSalesEvidence = (label, ids) => (
    <div className="section">
      <h3>{label}</h3>
      <EvidenceChips ids={ids} onSelect={handleEvidenceSelect} />
    </div>
  );

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
            return (
              <article
                key={unit.id}
                id={`unit-${unit.id}`}
                className={`unit ${activeUnitId === unit.id ? "is-active" : ""}`}
              >
                <div className="unit-header">
                  <span className="speaker">{unit.speaker}</span>
                  <div className="badges">
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

          <section className="section">
            <h3>Procedure checklist</h3>
            <ul className="list">
              {Object.keys(PROCEDURE_LABELS).map(renderProcedureItem)}
            </ul>
          </section>

          {analysis?.sales && (
            <section className="section">
              <h3>Sales signals</h3>
              <p>{analysis.sales.coachingSummary}</p>
            </section>
          )}

          {analysis?.sales && (
            <section className="section">
              {renderSalesEvidence("Buying signals", analysis.sales.signals.unitIds)}
              {renderSalesEvidence("Upsell attempts", analysis.sales.upsellAttempts.unitIds)}
              {renderSalesEvidence("Opportunity cues", analysis.sales.opportunityCues.unitIds)}
            </section>
          )}

          {analysis?.sales?.missedOpportunities?.length > 0 && (
            <section className="section">
              <h3>Missed opportunities</h3>
              <ul className="list">
                {analysis.sales.missedOpportunities.map((miss, index) => (
                  <li key={`${miss.expectedUpsellType}-${index}`}>
                    <p>
                      <strong>Trigger:</strong> {miss.triggerUnitIds.join(", ")}
                    </p>
                    <p>{miss.reasonMissed}</p>
                    <p>
                      <strong>Suggested response:</strong> {miss.suggestedTechResponse}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="section">
            <h3>Prompt design</h3>
            {promptMeta ? (
              <div className="prompt-meta">
                <strong>{promptMeta.title}</strong>
                <div>Version: v{selectedVersion}</div>
                <div>Design logic: {promptMeta.designLogic.join("; ")}</div>
                <div>Issues addressed: {promptMeta.issuesAddressed.join("; ")}</div>
                <div>New issues: {promptMeta.newIssuesObserved.join("; ")}</div>
                <div>Next triage: {promptMeta.nextTriageIdeas.join("; ")}</div>
              </div>
            ) : (
              <p>Prompt notes unavailable for this version.</p>
            )}
          </section>
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
