import React, { useMemo, useState } from 'react';

import { createRoot } from 'react-dom/client';
import { AlertTriangle, CheckCircle2, Calculator, Info } from 'lucide-react';
import './styles.css';

const presets = {
  localSafe: {
    name: 'Local safe default',
    lmStudioContext: 65536,
    openClawContextTokens: 65536,
    reserveTokens: 4096,
    maxTokens: 2048,
    keepRecentTokens: 3000,
    estimatedPromptTokens: 54000,
    compactionRatio: 0.55,
    overheadTokens: 3000,
  },
  localTight: {
    name: 'Risky / tight budget',
    lmStudioContext: 61265,
    openClawContextTokens: 61265,
    reserveTokens: 16384,
    maxTokens: 2048,
    keepRecentTokens: 4000,
    estimatedPromptTokens: 54032,
    compactionRatio: 0.55,
    overheadTokens: 3000,
  },
  cloudLarge: {
    name: 'Large cloud-ish context',
    lmStudioContext: 128000,
    openClawContextTokens: 128000,
    reserveTokens: 12000,
    maxTokens: 4096,
    keepRecentTokens: 12000,
    estimatedPromptTokens: 60000,
    compactionRatio: 0.5,
    overheadTokens: 5000,
  },
};

function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max);
}

function n(value) {
  return Number(value || 0);
}

function pct(value) {
  return `${Math.round(value)}%`;
}

function fmt(value) {
  return Math.round(value).toLocaleString();
}

/** Auto-fill dependent fields from just the LM Studio context length */
function autoFill(contextLength) {
  const ctx = n(contextLength);
  return {
    openClawContextTokens: ctx,
    reserveTokens: clamp(Math.round(ctx * 0.06), 2048, Math.floor(ctx * 0.15)),
    maxTokens: clamp(Math.round(ctx * 0.02), 1024, 8192),
    keepRecentTokens: clamp(Math.round(ctx * 0.04), 1500, 12000),
    compactionRatio: 0.55,
    estimatedPromptTokens: Math.round(ctx * 0.75),
    overheadTokens: clamp(Math.round(ctx * 0.04), 2000, 6000),
  };
}

/** Build a realistic OpenClaw JSON snippet from the computed results */
function generateRecommendedConfig(form, result) {
  const ctx = n(form.lmStudioContext);
  const modelHint =
    ctx >= 128000 ? 'qwen2.5-32b-instruct' :
    ctx >= 32000  ? 'llama-3.1-8b-instruct' :
                    'llama-3.2-3b-instruct';
  return {
    agents: {
      defaults: {
        compaction: {
          mode: "safeguard",
          model: `lmstudio/${modelHint}`,
          reserveTokens: result.recommendedReserve,
          reserveTokensFloor: result.recommendedReserve,
          keepRecentTokens: result.recommendedKeepRecent,
          truncateAfterCompaction: true,
          notifyUser: true,
          maxActiveTranscriptBytes: "1mb",
          midTurnPrecheck: { enabled: true },
          memoryFlush: {
            enabled: true,
            model: `lmstudio/${modelHint}`,
            softThresholdTokens: clamp(Math.round(ctx * 0.06), 2000, 8000),
          },
        },
        contextLimits: {
          memoryGetMaxChars: 2000,
          toolResultMaxChars: 4000,
          postCompactionMaxChars: clamp(Math.round(result.safePromptTarget * 0.012), 400, 2000),
        },
      },
    },
  };
}

function calculate(form) {
  const runtimeLimit = Math.min(n(form.lmStudioContext), n(form.openClawContextTokens));
  const requiredReserve = Math.max(n(form.reserveTokens), n(form.maxTokens));
  const usablePromptBudget = runtimeLimit - requiredReserve - n(form.overheadTokens);
  const overflowTokens = n(form.estimatedPromptTokens) - usablePromptBudget;
  const fitsNow = overflowTokens <= 0;

  const compactedPrompt = Math.max(
    n(form.keepRecentTokens),
    n(form.estimatedPromptTokens) * n(form.compactionRatio)
  );
  const compactedOverflow = compactedPrompt - usablePromptBudget;
  const fitsAfterCompaction = compactedOverflow <= 0;

  const headroom = usablePromptBudget - n(form.estimatedPromptTokens);
  const headroomPercent = usablePromptBudget > 0 ? (headroom / usablePromptBudget) * 100 : -100;
  const compactedHeadroom = usablePromptBudget - compactedPrompt;
  const compactedHeadroomPercent = usablePromptBudget > 0 ? (compactedHeadroom / usablePromptBudget) * 100 : -100;

  let successRate;
  if (fitsNow) {
    successRate = clamp(75 + headroomPercent * 1.5, 75, 99);
  } else if (fitsAfterCompaction) {
    successRate = clamp(55 + compactedHeadroomPercent * 2, 55, 95);
  } else {
    const miss = Math.abs(compactedOverflow);
    successRate = clamp(45 - (miss / Math.max(usablePromptBudget, 1)) * 100, 1, 45);
  }

  const recommendedReserve = clamp(Math.ceil(n(form.maxTokens) * 2), 2048, Math.floor(runtimeLimit * 0.15));
  const recommendedKeepRecent = clamp(Math.ceil(runtimeLimit * 0.05), 1500, 8000);
  const safePromptTarget = Math.floor((runtimeLimit - recommendedReserve - n(form.overheadTokens)) * 0.85);

  let verdict = 'Safe';
  let tone = 'good';
  let advice = 'Current prompt fits. Auto-compaction is likely to work if the session does not grow too much.';

  if (!fitsNow && fitsAfterCompaction) {
    verdict = 'Needs compaction';
    tone = 'warn';
    advice = 'Current prompt is too large, but compaction should fit if the summarizer produces a normal compact summary.';
  }

  if (!fitsAfterCompaction) {
    verdict = 'Likely fail';
    tone = 'bad';
    advice = 'Even after estimated compaction, the prompt may still be too large. Start a new session or reduce session/tool/skill context.';
  }

  return {
    runtimeLimit,
    requiredReserve,
    usablePromptBudget,
    overflowTokens,
    fitsNow,
    compactedPrompt,
    compactedOverflow,
    fitsAfterCompaction,
    successRate,
    verdict,
    tone,
    advice,
    recommendedReserve,
    recommendedKeepRecent,
    safePromptTarget,
  };
}

function Field({ label, value, onChange, help, min, max, step = 1, disabled = false }) {
  const displayValue = step < 1 ? Number(value).toFixed(2) : fmt(value);
  return (
    <label className={`field${disabled ? ' field--disabled' : ''}`}>
      <span className="field-header">
        <span>{label}</span>
        <strong className="field-value">{displayValue}</strong>
      </span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      {help && <small>{help}</small>}
    </label>
  );
}

function Toggle({ label, enabled, onChange, help }) {
  return (
    <label className="toggle">
      <span className="toggle-track" data-on={enabled} onClick={() => onChange(!enabled)}>
        <span className="toggle-knob" />
      </span>
      <span className="toggle-text">
        <strong>{label}</strong>
        {help && <small>{help}</small>}
      </span>
    </label>
  );
}

function App() {
  const [auto, setAuto] = useState(false);
  const [form, setForm] = useState(presets.localSafe);

  // When auto-mode is on, re-apply autoFill whenever lmStudioContext changes
  const set = (key, value) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (auto && key === 'lmStudioContext') {
        Object.assign(next, autoFill(value));
      }
      return next;
    });
  };

  // Toggle auto on/off – fill once when turning on
  const toggleAuto = (on) => {
    setAuto(on);
    if (on) {
      setForm((prev) => ({ ...prev, ...autoFill(prev.lmStudioContext) }));
    }
  };

  const result = useMemo(() => calculate(form), [form]);
  const recommendedConfig = useMemo(() => generateRecommendedConfig(form, result), [form, result]);

  return (
    <main className="page">
      <section className="hero">
        <div>
          <div className="eyebrow"><Calculator size={18} /> OpenClaw Local LLM</div>
          <h1>Context &amp; Auto-Compaction Calculator</h1>
          <p>
            Estimate whether your OpenClaw session fits inside the real LM Studio
            context budget, and how likely auto-compaction is to recover it.
          </p>
        </div>
        <div className={`score ${result.tone}`}>
          <span>{result.verdict}</span>
          <strong>{pct(result.successRate)}</strong>
          <small>estimated success rate</small>
        </div>
      </section>

      <section className="card preset-row">
        <button onClick={() => { setAuto(false); setForm(presets.localSafe); }}>Local safe default</button>
        <button onClick={() => { setAuto(false); setForm(presets.localTight); }}>Tight / risky budget</button>
        <button onClick={() => { setAuto(false); setForm(presets.cloudLarge); }}>Large context preset</button>
      </section>

      <section className="grid">
        <div className="card">
          <h2 className="card-title-row">
            <span>Inputs</span>
            <Toggle
              label="Auto"
              enabled={auto}
              onChange={toggleAuto}
              help="Auto-calculate from LM Studio context"
            />
          </h2>

          <Field
            label="LM Studio context length"
            value={form.lmStudioContext}
            min={4096} max={256000} step={1024}
            onChange={(v) => set('lmStudioContext', v)}
            help="The actual context loaded in LM Studio."
          />
          <Field
            label="OpenClaw contextTokens"
            value={form.openClawContextTokens}
            min={4096} max={256000} step={1024}
            onChange={(v) => set('openClawContextTokens', v)}
            disabled={auto}
            help={auto ? 'Auto-synced to LM Studio context' : 'OpenClaw effective model context.'}
          />
          <Field
            label="Reserve tokens"
            value={form.reserveTokens}
            min={512} max={65536} step={512}
            onChange={(v) => set('reserveTokens', v)}
            disabled={auto}
            help={auto ? 'Auto-calculated (6% of context)' : 'Empty space kept for output/safety.'}
          />
          <Field
            label="Max output tokens"
            value={form.maxTokens}
            min={128} max={32768} step={128}
            onChange={(v) => set('maxTokens', v)}
            disabled={auto}
            help={auto ? 'Auto-calculated (2% of context)' : 'Your configured maxTokens.'}
          />
          <Field
            label="Estimated prompt / session tokens"
            value={form.estimatedPromptTokens}
            min={1024} max={256000} step={1024}
            onChange={(v) => set('estimatedPromptTokens', v)}
            disabled={auto}
            help={auto ? 'Auto-estimated (75% of context)' : 'From OpenClaw logs, or use a rough estimate.'}
          />
          <Field
            label="Keep recent tokens"
            value={form.keepRecentTokens}
            min={512} max={65536} step={512}
            onChange={(v) => set('keepRecentTokens', v)}
            disabled={auto}
            help={auto ? 'Auto-calculated (4% of context)' : 'Recent transcript kept intact after compaction.'}
          />
          <Field
            label="Compaction ratio (proxy)"
            value={form.compactionRatio}
            min={0.1} max={1.0} step={0.05}
            onChange={(v) => set('compactionRatio', v)}
            help="0.55 = estimated summarizer shrinks old context to 55%. This is a rough proxy — OpenClaw doesn't use a ratio, it uses the 'safeguard' mode with a summarizer model."
          />
          <Field
            label="System / tool / skill overhead"
            value={form.overheadTokens}
            min={0} max={65536} step={512}
            onChange={(v) => set('overheadTokens', v)}
            disabled={auto}
            help={auto ? 'Auto-calculated (4% of context)' : 'Estimate for injected instructions, tools, skills, memory.'}
          />
        </div>

        <div className="card">
          <h2>Result</h2>
          <div className="result-line"><span>Runtime context limit</span><strong>{fmt(result.runtimeLimit)}</strong></div>
          <div className="result-line"><span>Required reserve (maxTokens + safety)</span><strong>{fmt(result.requiredReserve)}</strong></div>
          <div className="result-line"><span>Usable prompt budget</span><strong>{fmt(result.usablePromptBudget)}</strong></div>
          <div className="result-line"><span>Current overflow</span><strong className={result.overflowTokens > 0 ? 'danger' : 'ok'}>{fmt(result.overflowTokens)}</strong></div>
          <div className="result-line"><span>Estimated compacted prompt</span><strong>{fmt(result.compactedPrompt)}</strong></div>
          <div className="result-line"><span>Post-compaction overflow</span><strong className={result.compactedOverflow > 0 ? 'danger' : 'ok'}>{fmt(result.compactedOverflow)}</strong></div>

          <div className={`notice ${result.tone}`}>
            {result.tone === 'good' ? <CheckCircle2 /> : <AlertTriangle />}
            <p>{result.advice}</p>
          </div>

          <h2>Recommended settings (openclaw.json style)</h2>
          <pre>{JSON.stringify(recommendedConfig, null, 2)}</pre>

          <p className="footnote">
            <Info size={14} /> <strong>Compaction ratio note:</strong> OpenClaw does <em>not</em> use a &ldquo;compaction ratio&rdquo; field.
            Instead it uses <code>compaction.mode: &quot;safeguard&quot;</code> which delegates summarization to a dedicated LLM
            (configured under <code>compaction.model</code>). The ratio above is a rough estimation of how much the
            summarizer might shrink your session. The real outcome depends on the summarizer model, prompt content,
            and the <code>keepRecentTokens</code> / <code>reserveTokens</code> thresholds.
          </p>
        </div>
      </section>

      <section className="card info">
        <Info size={20} />
        <p>
          This app cannot guarantee 100% success because compaction quality depends on the summarizer, tools, skills,
          and hidden prompt overhead. Use the success rate as a safety estimate, then keep prompt usage below the safe
          target. Enable <strong>Auto</strong> to have fields auto-calculate from your LM Studio context length &mdash; a
          good starting point before manual tweaking.
        </p>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
