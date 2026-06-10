/**
 * AISection — Settings card for the Coach's LLM provider (Task 6.1).
 *
 * Inference location (Cloud / Local Ollama / Local WebGPU[flagged]), provider,
 * model, API key, and a Test-connection diagnostic. Settings persist on change
 * (each write dispatches the AI-settings-changed event so the Coach cache
 * invalidates).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * SECURITY — API key handling (Task 6.2 checklist). Reviewed 2026-05-31.
 *
 * Threat model: tabiya is a single-user, local-first browser app (Article 11).
 * The API key lives in this browser's localStorage — the same trust boundary
 * 1Password/Bitwarden browser extensions document for single-user local apps.
 * There is no tabiya server and no multi-tenant surface to leak it from, which
 * is why the provider SDKs are constructed with `dangerouslyAllowBrowser: true`
 * (the key is already client-side; the flag only acknowledges that).
 *
 *  1. NEVER logged — the key is never passed to console.log/warn/error here or
 *     in src/coach/*.ts. The Test-connection diagnostic prints only ok/fail +
 *     the provider's error message (which never contains the key).
 *  2. NEVER in snapshots — the field is `type="password"` AND uncontrolled
 *     (`defaultValue=""`): React mirrors a controlled `value` into the DOM
 *     attribute surface, so a saved key must never be fed back as `value`.
 *     A saved key is signalled via the placeholder only; tests assert the key
 *     string is absent from the rendered DOM (tests/components/AISection.security).
 *  3. NEVER to telemetry — any FUTURE telemetry MUST scrub `tabiya:ai:apiKey`.
 *  4. `dangerouslyAllowBrowser: true` — documented above; intentional.
 *  5. Upgrade path — a desktop build (Tauri/Electron) should move the key to
 *     the OS keychain. Tracked as a future spec; localStorage is the 4a boundary.
 *  6. [Clear key] wipes localStorage AND drops any cached client instance
 *     (`_clearClientCache`) so a wiped key cannot linger in memory.
 *  7. HTTPS — provider calls are HTTPS by SDK default; dev runs on localhost.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useState } from 'react';
import { useTokens } from '../../theme/ThemeContext';
import { fonts } from '../../theme/tokens';
import { Card } from '../../ui/primitives/Card';
import { CardTitle } from '../../ui/primitives/CardTitle';
import { getWebgpuLlmFlag } from '../../storage/featureFlags';
import {
  clearApiKey,
  loadAISettings,
  saveAISettings,
  type CloudProvider,
  type InferenceLocation,
} from '../../coach/aiSettings';
import { getLLMClient, _clearClientCache } from '../../coach/container';
import { DEFAULT_ANTHROPIC_MODEL } from '../../coach/AnthropicLLMClient';
import { DEFAULT_OPENAI_MODEL } from '../../coach/OpenAILLMClient';
import { DEFAULT_OLLAMA_MODEL, OllamaLLMClient } from '../../coach/OllamaLLMClient';

type Diagnostic =
  | { kind: 'idle' }
  | { kind: 'testing' }
  | { kind: 'ok'; text: string }
  | { kind: 'fail'; text: string };

function defaultModelFor(location: InferenceLocation, provider: CloudProvider): string {
  if (location === 'ollama') return DEFAULT_OLLAMA_MODEL;
  if (location === 'webgpu') return '';
  return provider === 'openai' ? DEFAULT_OPENAI_MODEL : DEFAULT_ANTHROPIC_MODEL;
}

export function AISection() {
  const t = useTokens();
  const webgpuEnabled = getWebgpuLlmFlag();
  const initial = loadAISettings();

  const [location, setLocation] = useState<InferenceLocation>(initial.location);
  const [provider, setProvider] = useState<CloudProvider>(initial.provider);
  const [model, setModel] = useState(initial.model);
  const [apiKey, setApiKey] = useState(initial.apiKey);
  // Remount key for the uncontrolled API-key input (checklist #2): bump to
  // visually empty the field on [Clear key] without controlling its value.
  const [keyFieldEpoch, setKeyFieldEpoch] = useState(0);
  const [diag, setDiag] = useState<Diagnostic>({ kind: 'idle' });
  const [ollamaReachable, setOllamaReachable] = useState<boolean | null>(null);

  // Probe Ollama reachability when that location is selected. State updates
  // happen only from the async probe result (react-hooks/set-state-in-effect);
  // the non-ollama case is handled at render time by `ollamaWarningVisible`.
  useEffect(() => {
    if (location !== 'ollama') return;
    let cancelled = false;
    void new OllamaLLMClient(model || DEFAULT_OLLAMA_MODEL).available().then((ok) => {
      if (!cancelled) setOllamaReachable(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [location, model]);
  const ollamaWarningVisible = location === 'ollama' && ollamaReachable === false;

  const persist = (patch: Partial<ReturnType<typeof loadAISettings>>): void => {
    saveAISettings(patch);
    setDiag({ kind: 'idle' });
  };

  const onLocation = (loc: InferenceLocation): void => {
    setLocation(loc);
    persist({ location: loc });
  };
  const onProvider = (p: CloudProvider): void => {
    setProvider(p);
    persist({ provider: p });
  };
  const onModel = (m: string): void => {
    setModel(m);
    persist({ model: m });
  };
  const onApiKey = (k: string): void => {
    setApiKey(k);
    persist({ apiKey: k });
  };
  const onClearKey = (): void => {
    setApiKey('');
    setKeyFieldEpoch((n) => n + 1);
    clearApiKey();
    _clearClientCache(); // checklist #6 — no wiped key left in a cached client
    setDiag({ kind: 'idle' });
  };

  const testConnection = async (): Promise<void> => {
    setDiag({ kind: 'testing' });
    const client = getLLMClient();
    if (!client) {
      setDiag({ kind: 'fail', text: 'No provider configured. Add an API key or pick Ollama.' });
      return;
    }
    try {
      if (!(await client.available())) {
        setDiag({ kind: 'fail', text: 'Provider unavailable (no key / endpoint unreachable).' });
        return;
      }
      // maxTokens:1 keeps the test cheap; the key never enters any log.
      await client.complete({ systemPrompt: 'ping', userPrompt: 'ping', maxTokens: 1 });
      setDiag({ kind: 'ok', text: `Connected to ${client.modelName}.` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setDiag({ kind: 'fail', text: msg });
    }
  };

  const isCloud = location === 'cloud';
  const modelPlaceholder = defaultModelFor(location, provider);

  return (
    <Card>
      <CardTitle>AI Coach</CardTitle>
      <div
        style={{
          fontSize: 12.5,
          color: t.inkSoft,
          fontFamily: fonts.sans,
          marginTop: -6,
          marginBottom: 12,
          lineHeight: 1.55,
        }}
      >
        Powers the "Why?" narration. Engine analysis works without this; the LLM
        only adds prose. Keys are stored locally and never sent to tabiya.
      </div>

      <FieldLabel>Inference location</FieldLabel>
      <div role="radiogroup" aria-label="Inference location" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
        <LocationRadio current={location} value="cloud" label="Cloud (Anthropic / OpenAI)" onChange={onLocation} />
        <LocationRadio current={location} value="ollama" label="Local (Ollama)" onChange={onLocation} />
        {webgpuEnabled ? (
          <LocationRadio current={location} value="webgpu" label="Local (Browser WebGPU)" onChange={onLocation} />
        ) : null}
      </div>

      {isCloud ? (
        <>
          <FieldLabel>Provider</FieldLabel>
          <select
            aria-label="Provider"
            value={provider}
            onChange={(e) => onProvider(e.target.value as CloudProvider)}
            style={selectStyle(t)}
          >
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
          </select>
        </>
      ) : null}

      <FieldLabel>Model</FieldLabel>
      <input
        aria-label="Model"
        type="text"
        value={model}
        placeholder={modelPlaceholder}
        onChange={(e) => onModel(e.target.value)}
        style={inputStyle(t)}
      />

      {isCloud ? (
        <>
          <FieldLabel>API key</FieldLabel>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              key={keyFieldEpoch}
              aria-label="API key"
              data-testid="ai-api-key"
              type="password"
              // Uncontrolled on purpose (checklist #2): a controlled `value`
              // is mirrored into the DOM attribute surface, leaking the saved
              // key into snapshots/serializations. The saved key never renders.
              defaultValue=""
              placeholder={apiKey ? '•••••••• (key saved)' : 'sk-…'}
              onChange={(e) => onApiKey(e.target.value)}
              style={{ ...inputStyle(t), flex: 1 }}
            />
            <button onClick={onClearKey} style={ghostButton(t)}>
              Clear key
            </button>
          </div>
          <div style={{ fontSize: 11, color: t.inkSoft, marginTop: 4, lineHeight: 1.5 }}>
            Stored locally in your browser. Never sent to tabiya servers.
          </div>
        </>
      ) : null}

      {ollamaWarningVisible ? (
        <div style={{ fontSize: 12, color: t.amber, marginTop: 10, lineHeight: 1.5 }}>
          Ollama not reachable at localhost:11434. Start it with{' '}
          <code style={{ fontFamily: fonts.mono }}>ollama serve</code>.
        </div>
      ) : null}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
        <button onClick={() => void testConnection()} disabled={diag.kind === 'testing'} style={primaryButton(t)}>
          {diag.kind === 'testing' ? 'Testing…' : 'Test connection'}
        </button>
        {diag.kind === 'ok' ? (
          <span style={{ fontSize: 12, color: t.success }}>✓ {diag.text}</span>
        ) : null}
        {diag.kind === 'fail' ? (
          <span style={{ fontSize: 12, color: t.red }}>✕ {diag.text}</span>
        ) : null}
      </div>
    </Card>
  );
}

// --- local presentational bits ---------------------------------------------

function FieldLabel({ children }: { children: React.ReactNode }) {
  const t = useTokens();
  return (
    <div style={{ fontSize: 12, fontWeight: 600, color: t.ink, fontFamily: fonts.sans, marginBottom: 6 }}>
      {children}
    </div>
  );
}

function LocationRadio({
  current,
  value,
  label,
  onChange,
}: {
  current: InferenceLocation;
  value: InferenceLocation;
  label: string;
  onChange: (v: InferenceLocation) => void;
}) {
  const t = useTokens();
  const selected = current === value;
  return (
    <button
      role="radio"
      aria-checked={selected}
      onClick={() => onChange(value)}
      style={{
        padding: '8px 12px',
        borderRadius: 10,
        border: `0.5px solid ${selected ? t.brand : t.border}`,
        background: selected ? t.brandSoft : t.surfaceAlt,
        color: t.ink,
        fontFamily: fonts.sans,
        fontSize: 12.5,
        fontWeight: selected ? 600 : 500,
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      {label}
    </button>
  );
}

function inputStyle(t: ReturnType<typeof useTokens>): React.CSSProperties {
  return {
    width: '100%',
    boxSizing: 'border-box',
    padding: '8px 10px',
    borderRadius: 8,
    border: `0.5px solid ${t.border}`,
    background: t.surfaceAlt,
    color: t.ink,
    fontFamily: fonts.mono,
    fontSize: 12.5,
    marginBottom: 12,
  };
}

function selectStyle(t: ReturnType<typeof useTokens>): React.CSSProperties {
  return { ...inputStyle(t), fontFamily: fonts.sans };
}

function primaryButton(t: ReturnType<typeof useTokens>): React.CSSProperties {
  return {
    background: t.brand,
    color: t.brandInk,
    border: `0.5px solid ${t.brand}`,
    borderRadius: 999,
    padding: '7px 14px',
    fontSize: 12.5,
    fontWeight: 600,
    fontFamily: fonts.sans,
    cursor: 'pointer',
  };
}

function ghostButton(t: ReturnType<typeof useTokens>): React.CSSProperties {
  return {
    background: t.surfaceAlt,
    color: t.ink,
    border: `0.5px solid ${t.border}`,
    borderRadius: 999,
    padding: '7px 12px',
    fontSize: 12,
    fontWeight: 500,
    fontFamily: fonts.sans,
    cursor: 'pointer',
    flexShrink: 0,
  };
}
