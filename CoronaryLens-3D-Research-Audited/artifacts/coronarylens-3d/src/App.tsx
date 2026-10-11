import { useMemo, useState, CSSProperties, ReactNode } from 'react';
import { Link, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Activity, AlertCircle, ArrowRight, BookOpen, Check, ChevronRight, CircleHelp,
  ClipboardList, Database, FileInput, HeartPulse, Info, Layers3, Microscope,
  Network, ShieldCheck, SlidersHorizontal, Sparkles, Target, Waypoints, Search
} from 'lucide-react';
import CoronaryScene from '@/components/CoronaryScene';
import {
  Target as ApiTarget,
  useHealthCheck,
  useGetReadiness,
  useGetClinicalSchema,
  useGetDemoProfile,
  useGetModelRegistry,
  useGetEvaluation,
  useCreatePrediction,
  useExplainPrediction,
  getGetDemoProfileQueryKey,
} from '@workspace/api-client-react';
import type {
  ClinicalSchema, DemoProfile, Explanation, FeatureDefinition, ModelRegistry,
  Prediction, Target as TargetType,
} from '@workspace/api-client-react';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

const navItems = [
  { href: '/', label: 'Overview', icon: Activity },
  { href: '/inputs', label: 'Clinical inputs', icon: FileInput },
  { href: '/workspace', label: 'Model workspace', icon: Layers3 },
  { href: '/evidence', label: 'Evidence', icon: Microscope },
  { href: '/methods', label: 'Methods & limits', icon: BookOpen },
];

const targetInfo: Record<TargetType, { name: string; color: string }> = {
  CAD: { name: 'Overall coronary artery disease', color: '#0ea5e9' },
  LAD: { name: 'Left anterior descending', color: '#f59e0b' },
  LCX: { name: 'Left circumflex', color: '#10b981' },
  RCA: { name: 'Right coronary artery', color: '#8b5cf6' },
};
const targetOrder: TargetType[] = [ApiTarget.CAD, ApiTarget.LAD, ApiTarget.LCX, ApiTarget.RCA];

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <AppShell />
      </WouterRouter>
    </QueryClientProvider>
  );
}

function AppShell() {
  const [location, navigate] = useLocation();
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [selectedTarget, setSelectedTarget] = useState<TargetType>(ApiTarget.CAD);
  const [activePrediction, setActivePrediction] = useState<Prediction | null>(null);
  const [explanations, setExplanations] = useState<Partial<Record<TargetType, Explanation>>>({});
  const [demoSource, setDemoSource] = useState<DemoProfile | null>(null);

  const health = useHealthCheck();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <div className="brand-mark"><HeartPulse size={20} strokeWidth={1.8} /></div>
          <div><div className="brand-name">CoronaryLens</div><div className="brand-sub">RESEARCH WORKBENCH</div></div>
        </Link>
        <div style={{ flex: 1 }}>
          <div className="nav-label">Study Environment</div>
          <nav className="nav-list">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link href={href} key={href} className="nav-link" aria-current={location === href ? 'page' : undefined}>
                <Icon size={16} strokeWidth={1.8} /><span>{label}</span>
              </Link>
            ))}
          </nav>
        </div>
        <div className="text-xs text-slate-500 font-mono leading-relaxed px-3 border-t border-[#141f28] pt-4">
          <div className="flex items-center gap-2 mb-2 text-primary"><ShieldCheck size={14} /> Research use only</div>
          Outputs are model estimates—not a diagnosis or causal explanation.
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div className="crumb">
            CoronaryLens <ChevronRight size={14} className="inline mx-2 text-slate-600" /> 
            <span className="text-slate-300">{navItems.find((i) => i.href === location)?.label ?? 'Not found'}</span>
          </div>
          <div className="top-right">
            <span className="status-indicator">
              <span className="status-dot" style={{ background: health.data ? '#0d9488' : health.isError ? '#be123c' : '#f59e0b' }} />
              {health.isLoading ? 'Connecting' : health.data ? 'Service online' : health.isError ? 'Service unavailable' : 'Checking service'}
            </span>
          </div>
        </header>

        <Switch>
          <Route path="/"><Overview onNavigate={navigate} /></Route>
          <Route path="/inputs">
            <Inputs values={values} setValues={setValues} demoSource={demoSource} onDemo={setDemoSource} onNavigate={navigate} />
          </Route>
          <Route path="/workspace">
            <Workspace
              values={values}
              selectedTarget={selectedTarget}
              setSelectedTarget={setSelectedTarget}
              prediction={activePrediction}
              setPrediction={setActivePrediction}
              explanations={explanations}
              setExplanations={setExplanations}
              onNavigate={navigate}
            />
          </Route>
          <Route path="/evidence"><Evidence /></Route>
          <Route path="/methods"><Methods /></Route>
          <Route component={NotFound} />
        </Switch>
      </div>
    </div>
  );
}

function PageHead({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: ReactNode }) {
  return (
    <div className="page-head animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="page-title">{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {children && <div className="flex items-center gap-3 flex-wrap mt-2">{children}</div>}
    </div>
  );
}

// -----------------------------------------------------------------------------
// OVERVIEW PAGE
// -----------------------------------------------------------------------------
function Overview({ onNavigate }: { onNavigate: (path: string) => void }) {
  const readiness = useGetReadiness();
  const data = readiness.data;

  return (
    <main className="page">
      <PageHead 
        eyebrow="Cardiovascular modeling · workspace 01" 
        title="A clearer view of model readiness." 
        description="Explore target-specific coronary model outputs, their supporting evidence, and the exact predictors used—without mistaking a research estimate for clinical guidance."
      >
        <button className="button button-primary" onClick={() => onNavigate('/inputs')}>
          <FileInput size={15} /> Open clinical profile <ArrowRight size={14} />
        </button>
      </PageHead>

      {readiness.isLoading && <div className="grid status-grid mb-6">{[1,2,3,4,5].map(i => <div key={i} className="card status-card skeleton h-[120px]" />)}</div>}
      
      {readiness.isError && <QueryUnavailable title="Readiness could not be retrieved" detail="The service did not return model readiness. No prediction can be run until trained artifacts are confirmed." onRetry={() => readiness.refetch()} />}
      
      {data && (
        <>
          <section className="grid status-grid mb-4">
            <div className="card status-card border-b-2 border-b-primary">
              <div className="status-top"><span>Workbench</span><ShieldCheck size={15} /></div>
              <div className="status-value">{data.ready ? 'Research ready' : 'Not ready'}</div>
              <div className="status-note">{data.ready ? 'Artifact checks passed' : 'Prediction remains unavailable'}</div>
            </div>
            {[
              ['Dataset', data.dataset], ['Schema', data.schema], ['Models', data.models], ['Evaluation', data.evaluation]
            ].map(([label, value]) => (
              <div className="card status-card border-b-2 border-b-slate-800" key={label}>
                <div className="status-top"><span>{label}</span><span className="w-2 h-2 rounded-full" style={{ background: value.toLowerCase().includes('ready') || value.toLowerCase().includes('loaded') ? '#10b981' : '#f59e0b' }} /></div>
                <div className="status-value">{value}</div>
                <div className="status-note">Backend state</div>
              </div>
            ))}
          </section>

          <div className={`alert ${!data.ready ? 'alert-danger' : ''} mb-8`}>
            {data.ready ? <Check className="alert-icon" size={17} /> : <AlertCircle className="alert-icon" size={17} />}
            <div>
              <strong>{data.ready ? 'Research inference is operational.' : 'Model outputs are not available yet.'}</strong><br/>
              {data.ready ? 'Artifact and checksum checks passed. Scores are exploratory estimates.' : `Current blockers: ${data.blockers.join(' · ') || 'Service not ready.'}`}
            </div>
          </div>
        </>
      )}

      <div className="grid overview-grid mb-8">
        <section className="card card-pad">
          <div className="flex justify-between items-start mb-6">
            <div><h2 className="section-title">Four distinct targets</h2><p className="section-caption">Separate model outputs</p></div>
            <Waypoints size={18} className="text-slate-500" />
          </div>
          <div className="rounded-md border border-slate-800 overflow-hidden">
            <table className="data-table">
              <thead><tr><th>Target</th><th>Scope</th><th>Interpretation</th></tr></thead>
              <tbody>
                <tr><td><span className="target-chip">CAD</span></td><td>Overall disease</td><td>Summary target; not a vessel</td></tr>
                <tr><td><span className="target-chip">LAD</span></td><td>Left anterior desc.</td><td>Independent output</td></tr>
                <tr><td><span className="target-chip">LCX</span></td><td>Left circumflex</td><td>Independent output</td></tr>
                <tr><td><span className="target-chip">RCA</span></td><td>Right coronary art.</td><td>Independent output</td></tr>
              </tbody>
            </table>
          </div>
        </section>
        
        <section className="card card-pad flex flex-col justify-between">
          <div>
            <div className="text-primary font-mono text-[10px] uppercase tracking-wider mb-2">Interpretation Guardrail</div>
            <h2 className="section-title text-xl mb-3">An estimate is not an explanation.</h2>
            <p className="inline-note text-slate-400">Model contributions describe relationships to a model output. They do not establish causality, a diagnosis, or where disease is located.</p>
          </div>
          <Link href="/methods" className="button mt-6 w-fit">Read methods & limits <ArrowRight size={13} /></Link>
        </section>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-3 gap-5">
        <QuickLink icon={SlidersHorizontal} title="Profile editor" text="Use only predictors defined by the active clinical schema." href="/inputs" />
        <QuickLink icon={Layers3} title="Model workspace" text="Inspect model output next to schematic, selectable anatomy." href="/workspace" />
        <QuickLink icon={Database} title="Validation evidence" text="See reported evaluation metrics and registry details." href="/evidence" />
      </div>
    </main>
  );
}

function QuickLink({ icon: Icon, title, text, href }: { icon: typeof Activity; title: string; text: string; href: string }) {
  return (
    <Link href={href} className="card card-pad flex gap-4 items-start no-underline transition-all hover:border-slate-600 hover:bg-slate-800/20">
      <div className="text-primary mt-1"><Icon size={20} /></div>
      <div>
        <strong className="block text-slate-200 font-semibold mb-1">{title}</strong>
        <span className="text-xs text-slate-400 leading-relaxed">{text}</span>
      </div>
      <ArrowRight size={14} className="ml-auto text-slate-600 mt-1" />
    </Link>
  );
}

// -----------------------------------------------------------------------------
// CLINICAL INPUTS
// -----------------------------------------------------------------------------
function Inputs({ values, setValues, demoSource, onDemo, onNavigate }: any) {
  const schemaQuery = useGetClinicalSchema();
  const demoQuery = useGetDemoProfile({ query: { enabled: false, queryKey: getGetDemoProfileQueryKey() } });
  const readinessQuery = useGetReadiness();
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  
  const schema = schemaQuery.data;
  
  const grouped = useMemo(() => {
    const map = new Map<string, FeatureDefinition[]>();
    schema?.predictors?.forEach((feature) => {
      if (isForbidden(feature, schema.forbidden_predictors)) return;
      if (search && !feature.name.toLowerCase().includes(search.toLowerCase()) && !feature.label.toLowerCase().includes(search.toLowerCase())) return;
      map.set(feature.group, [...(map.get(feature.group) ?? []), feature]);
    });
    return [...map.entries()];
  }, [schema, search]);

  const requiredCount = schema?.predictors.filter((f) => f.required && !isForbidden(f, schema.forbidden_predictors)).length ?? 0;
  const completedRequired = schema?.predictors.filter((f) => f.required && !isForbidden(f, schema.forbidden_predictors) && hasValue(values[f.name])).length ?? 0;
  const profileComplete = Boolean(schema && Object.keys(filterPredictorValues(values, schema)).length > 0 && completedRequired === requiredCount &&
    schema.predictors.filter((f) => !isForbidden(f, schema.forbidden_predictors))
      .every((f) => !hasValue(values[f.name]) || !validateFeature(f, values[f.name])));

  const setField = (feature: FeatureDefinition, raw: string) => {
    const next = { ...values };
    if (raw === '') delete next[feature.name];
    else if (feature.type === 'numeric' || (feature.type === 'ordinal' && !feature.categories?.length)) next[feature.name] = Number(raw);
    else next[feature.name] = raw;
    setValues(next);
    const error = validateFeature(feature, next[feature.name]);
    setLocalErrors((prev) => ({ ...prev, [feature.name]: error || '' }));
  };

  const loadDemo = async () => {
    onDemo(null);
    try {
      const resp = await demoQuery.refetch();
      if (resp.data) {
        setValues(filterPredictorValues(resp.data.values, schema));
        onDemo(resp.data);
        setLocalErrors({});
      }
    } catch {}
  };

  const attemptContinue = () => {
    if (!schema) return;
    const errors: Record<string, string> = {};
    schema.predictors.filter((f) => !isForbidden(f, schema.forbidden_predictors)).forEach((f) => {
      const error = validateFeature(f, values[f.name]);
      if (error && (f.required || hasValue(values[f.name]))) errors[f.name] = error;
    });
    setLocalErrors(errors);
    if (!profileComplete || Object.keys(errors).length > 0) return;
    onNavigate('/workspace');
  };

  return (
    <main className="page">
      <PageHead 
        eyebrow="Input profile · schema controlled" 
        title="Clinical profile" 
        description="Enter a complete profile using the active validated predictor schema. No features are inferred. Use the synthetic profile for a safe demonstration."
      >
        <button className="button" disabled={!schema || demoQuery.isFetching} onClick={loadDemo}>
          {demoQuery.isFetching ? <div className="skeleton w-3 h-3 rounded-full" /> : <Sparkles size={14} className="text-primary" />} 
          Load synthetic demo profile
        </button>
        <button className="button button-primary" disabled={!schema || !profileComplete || readinessQuery.data?.ready !== true} onClick={attemptContinue}>
          Review profile <ArrowRight size={14} />
        </button>
      </PageHead>

      <div className="alert mb-6">
        <Info size={16} className="alert-icon" />
        <div><strong>Predictors only.</strong> Target labels are excluded from the predictor payload. Optional blank fields are safely omitted.</div>
      </div>

      {schemaQuery.isLoading && <div className="form-groups mb-8"><div className="card h-48 skeleton" /><div className="card h-48 skeleton" /></div>}
      {schemaQuery.isError && <QueryUnavailable title="Clinical schema unavailable" detail="Cannot verify predictor namespace." onRetry={() => schemaQuery.refetch()} />}
      
      {schema && (
        <>
          <div className="card card-pad flex items-center justify-between gap-4 flex-wrap mb-6 border-l-4 border-l-primary">
            <div>
              <div className="eyebrow !mb-1 text-slate-400">Schema {schema.schema_version}</div>
              <div className="text-xs text-slate-500 font-mono">{schema.predictor_count} predictors · source: {schema.source}</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input type="text" placeholder="Search predictors..." className="field-input pl-8 py-1.5 w-48" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <span className={`status-indicator border-${profileComplete ? 'primary' : 'slate-700'}`}>
                <span className="status-dot" style={{ background: profileComplete ? '#10b981' : '#f59e0b' }} />
                {completedRequired} / {requiredCount} required fields
              </span>
            </div>
          </div>

          {demoSource && (
            <div className="alert mb-6">
              <Check size={16} className="alert-icon" />
              <div><strong>{demoSource.label}</strong> · synthetic demo endpoint successfully parsed. <span className="text-slate-500 ml-2">{demoSource.provenance}</span></div>
            </div>
          )}

          <div className="form-groups">
            {grouped.map(([group, features]) => (
              <section className="card card-pad" key={group}>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="section-title text-lg">{group}</h2>
                    <p className="section-caption">{features.length} schema-defined fields</p>
                  </div>
                </div>
                <div className="fields-grid">
                  {features.map((feature) => (
                    <SchemaField key={feature.name} feature={feature} value={values[feature.name]} error={localErrors[feature.name]} onChange={(raw: string) => setField(feature, raw)} />
                  ))}
                </div>
              </section>
            ))}
          </div>

          {readinessQuery.data?.ready !== true && (
            <div className="alert alert-danger mt-6">
              <AlertCircle size={16} className="alert-icon" />
              <div><strong>Prediction is gated.</strong> The real trained artifacts are not ready yet.</div>
            </div>
          )}
        </>
      )}
    </main>
  );
}

function SchemaField({ feature, value, error, onChange }: any) {
  const id = `field-${feature.name}`;
  const numberValue = value == null ? '' : String(value);
  return (
    <div>
      <label className="field-label" htmlFor={id}>
        {feature.label}{feature.required && <span className="text-rose-500 ml-1">*</span>}
        {feature.unit && <span className="text-slate-500 font-normal ml-1">({feature.unit})</span>}
      </label>
      {feature.categories?.length ? (
        <select id={id} className="field-input" value={numberValue} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select a value</option>
          {feature.categories.map((cat: string) => <option key={cat} value={cat}>{cat}</option>)}
        </select>
      ) : (
        <input id={id} className="field-input" type="text" value={numberValue} onChange={(e) => onChange(e.target.value)} />
      )}
      <div className="field-help">{feature.description || feature.type}</div>
      {error && <div className="field-error">{error}</div>}
    </div>
  );
}

// -----------------------------------------------------------------------------
// WORKSPACE (3D + INFERENCE)
// -----------------------------------------------------------------------------
function Workspace({ values, selectedTarget, setSelectedTarget, prediction, setPrediction, explanations, setExplanations, onNavigate }: any) {
  const schemaQuery = useGetClinicalSchema();
  const readinessQuery = useGetReadiness();
  const predictionMutation = useCreatePrediction();
  const explanationMutation = useExplainPrediction();

  const schema = schemaQuery.data;
  const safeValues = filterPredictorValues(values, schema);
  
  const usableFeatures = schema?.predictors.filter((f) => !isForbidden(f, schema.forbidden_predictors)) ?? [];
  const complete = Boolean(schema && usableFeatures.some((f) => hasValue(safeValues[f.name])) &&
    usableFeatures.filter((f) => f.required).every((f) => hasValue(safeValues[f.name])) &&
    usableFeatures.every((f) => !hasValue(safeValues[f.name]) || !validateFeature(f, safeValues[f.name])));
  
  const canPredict = readinessQuery.data?.ready === true && complete && !schemaQuery.isError && Object.keys(safeValues).length > 0;
  const matchingExplanation = explanations[selectedTarget]?.prediction_request_id === prediction?.request_id ? explanations[selectedTarget] : undefined;

  const runPrediction = () => {
    if (!canPredict) return;
    setExplanations({});
    setPrediction(null);
    predictionMutation.mutate({ data: { values: safeValues } }, { onSuccess: setPrediction });
  };

  const requestExplanation = () => {
    if (!prediction || !safeValues) return;
    explanationMutation.mutate(
      { target: selectedTarget, data: { values: safeValues, prediction_request_id: prediction.request_id } },
      {
        onSuccess: (resp) => setExplanations((prev: any) => ({ ...prev, [selectedTarget]: resp }))
      }
    );
  };

  const selectedOutput = prediction?.outputs?.[selectedTarget];
  const vesselScores = {
    LAD: prediction?.outputs?.LAD?.score_semantics === 'probability' ? prediction.outputs.LAD.score : undefined,
    LCX: prediction?.outputs?.LCX?.score_semantics === 'probability' ? prediction.outputs.LCX.score : undefined,
    RCA: prediction?.outputs?.RCA?.score_semantics === 'probability' ? prediction.outputs.RCA.score : undefined,
  };

  return (
    <main className="page">
      <PageHead 
        eyebrow="Target-specific output · anatomy explorer" 
        title="Model workspace" 
        description="Review models side-by-side using the interactive anatomy viewer. Individual vessel results are distinct. The generic 3D heart is a visual aid, not a patient lesion map."
      >
        <button className="button" onClick={() => onNavigate('/inputs')}><SlidersHorizontal size={14}/> Edit profile</button>
        <button className="button button-primary" onClick={runPrediction} disabled={!canPredict || predictionMutation.isPending}>
          {predictionMutation.isPending ? <div className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <Activity size={14} />}
          {predictionMutation.isPending ? 'Requesting inference...' : 'Submit to 4 models'}
        </button>
      </PageHead>

      {!canPredict && (
        <div className="alert alert-danger mb-6">
          <AlertCircle size={16} className="alert-icon" />
          <div><strong>Prediction unavailable.</strong> Ensure your clinical profile is valid and the backend artifacts are ready.</div>
        </div>
      )}

      {predictionMutation.isError && <QueryUnavailable title="Model request failed" detail="Service did not return predictions." onRetry={runPrediction} />}

      <div className="workspace-layout">
        <section className="anatomy-container">
          <div className="anatomy-header">
            <div className="anatomy-title"><Sparkles size={14} className="text-primary" /> Coronary Structure Interactive View</div>
            <div className="flex gap-2">
              <span className="global-badge">3D GLTF</span>
            </div>
          </div>
          <div className="anatomy-viewport">
            <CoronaryScene selected={selectedTarget} onSelect={setSelectedTarget} scores={vesselScores} />
          </div>
        </section>

        <section className="flex flex-col gap-5">
          <div className="inspector-panel">
            <div className="inspector-head">
              <h3 className="text-xs uppercase tracking-widest text-slate-400 font-mono mb-4">Select Target</h3>
              <div className="target-selector">
                {targetOrder.map((target) => (
                  <button 
                    key={target} 
                    className={`target-btn ${selectedTarget === target ? 'active' : ''}`}
                    onClick={() => setSelectedTarget(target)}
                  >
                    <div>
                      <span className="target-acronym">{target}</span>
                      <span className="target-name">{targetInfo[target].name}</span>
                    </div>
                    {target === 'CAD' ? <span className="global-badge">GLOBAL</span> : <span className="target-swatch" style={{ background: targetInfo[target].color }} />}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="inspector-body bg-[#162028]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-slate-400 uppercase tracking-wide">{selectedTarget} Output</span>
                <Target size={16} color={targetInfo[selectedTarget as TargetType].color} />
              </div>
              
              {selectedOutput ? (
                <>
                  <div className="score-display">
                    {selectedOutput.score_semantics === 'probability' ? `${(selectedOutput.score * 100).toFixed(1)}%` : selectedOutput.score.toFixed(4)}
                  </div>
                  <div className="text-xs text-slate-400 leading-relaxed mb-4">
                    {selectedOutput.score_semantics === 'probability' ? 'Uncalibrated positive-class probability' : 'Raw model score'}
                    {selectedOutput.predicted_class ? ` · predicted label: ${selectedOutput.predicted_class}` : ''}
                  </div>
                  <div className="text-[10px] uppercase font-mono text-slate-500 border-t border-slate-700 pt-3 mt-2">
                    Model: {selectedOutput.model_family} v{selectedOutput.model_version}
                  </div>
                </>
              ) : (
                <div className="py-2 text-sm text-slate-500">Not requested or unavailable</div>
              )}
            </div>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 mt-6 gap-6">
        <section className="card card-pad">
          <div className="flex justify-between items-start mb-6">
            <div><h2 className="section-title">Model explanation</h2><p className="section-caption">Approximate permutation SHAP contributions</p></div>
            <Sparkles size={16} className="text-primary" />
          </div>
          
          {!matchingExplanation ? (
            <div className="text-center py-8 bg-[#0a0f12] rounded-md border border-slate-800">
              <p className="text-sm text-slate-400 mb-4">No explanation generated yet.</p>
              <button className="button" onClick={requestExplanation} disabled={!prediction || explanationMutation.isPending}>
                {explanationMutation.isPending ? 'Requesting...' : 'Generate SHAP Explanation'}
              </button>
            </div>
          ) : (
            <ExplanationPanel explanation={matchingExplanation} />
          )}
          {explanationMutation.isError && <div className="text-rose-500 text-xs mt-2">Explanation query failed.</div>}
        </section>

        <section className="card card-pad">
          <div className="flex justify-between items-start mb-6">
            <div><h2 className="section-title">Interpretation limits</h2><p className="section-caption">Strict boundaries for AI transparency</p></div>
            <Info size={16} className="text-slate-500" />
          </div>
          <ul className="text-sm text-slate-400 space-y-3 pl-4 list-disc">
            <li>The 3D interactive model is a pre-rendered generic anatomical file, <strong>not</strong> generated from patient imagery.</li>
            <li>Selecting a region visually isolates it and selects the target; the highlight coloring is an abstract heat mapping of probability.</li>
            <li>SHAP feature contributions explain <strong>model reliance</strong>, not biological causality.</li>
            <li>Models evaluated on narrow retrospective cohorts can demonstrate significant population shift.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}

function ExplanationPanel({ explanation }: { explanation: Explanation }) {
  const max = Math.max(...explanation.contributions.map((i) => Math.abs(i.contribution)), 0);
  return (
    <div>
      <div className="flex gap-4 text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-6">
        <span>Method: {explanation.method}</span>
        <span>Base: {Number(explanation.baseline).toPrecision(3)}</span>
      </div>
      
      {explanation.contributions.length ? (
        <div className="contribution-list mb-6">
          {explanation.contributions.map((item) => (
            <div className="contribution-item" key={item.feature}>
              <div className="truncate text-slate-300" title={item.label}>{item.label}</div>
              <div className="contribution-bar">
                <div className={`contribution-fill ${item.direction === 'toward_negative' ? 'negative' : ''}`} style={{ width: `${max ? Math.max(2, (Math.abs(item.contribution) / max) * 100) : 0}%` }} />
              </div>
              <div className="text-right text-slate-400 font-mono text-xs">{item.contribution.toPrecision(2)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-slate-500 mb-6">No contributions returned.</div>
      )}
      
      <div className="bg-[#0a0f12] p-4 rounded border border-slate-800 text-xs text-slate-400">
        <strong className="text-slate-200 block mb-2">Automated Limitations:</strong>
        <ul className="pl-4 list-disc space-y-1">
          {explanation.limitations.map((lim, i) => <li key={i}>{lim}</li>)}
        </ul>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// EVIDENCE & OTHERS
// -----------------------------------------------------------------------------
function Evidence() {
  const registryQuery = useGetModelRegistry();
  const evaluationQuery = useGetEvaluation();

  return (
    <main className="page">
      <PageHead eyebrow="Evidence ledger" title="Validation & Registry" description="Inspect documented models, validation approaches, and metrics. Unmeasured states remain blank." />
      
      <section className="card card-pad mb-6">
        <h2 className="section-title mb-6">Registry Details</h2>
        {registryQuery.isLoading ? <div className="skeleton h-24" /> : registryQuery.data ? (
          <div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <Meta label="Registry Version" value={registryQuery.data.version} />
              <Meta label="Schema Version" value={registryQuery.data.feature_schema_version} />
              <Meta label="Checksum" value={registryQuery.data.dataset_checksum.substring(0,8)} mono />
            </div>
          </div>
        ) : <QueryUnavailable title="Registry unavailable" detail="Could not load registry." onRetry={() => registryQuery.refetch()} />}
      </section>

      <section className="card card-pad">
        <h2 className="section-title mb-6">Evaluation Results</h2>
        {evaluationQuery.isLoading ? <div className="skeleton h-32" /> : evaluationQuery.data ? (
          <div>
             <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              <Meta label="Dataset Source" value={evaluationQuery.data.dataset_source} />
              <Meta label="Sample Count" value={String(evaluationQuery.data.sample_count)} mono />
              <Meta label="Validation" value={evaluationQuery.data.validation_method} />
            </div>
            {evaluationQuery.data.targets?.map((target) => (
              <div key={target.target} className="mb-6 p-4 rounded-md border border-slate-800 bg-[#0a0f12]">
                <div className="flex gap-4 items-center mb-4">
                  <span className="target-chip">{target.target}</span>
                  <span className="text-xs text-slate-500 font-mono">{target.model_family} · {target.fold_count} folds</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {Object.entries(target.metrics).map(([k, v]) => <Meta key={k} label={k.replace('_', ' ')} value={v != null ? Number(v).toFixed(3) : 'N/A'} mono />)}
                </div>
              </div>
            ))}
          </div>
        ) : <QueryUnavailable title="Evaluation unavailable" detail="Could not load metrics." onRetry={() => evaluationQuery.refetch()} />}
      </section>
    </main>
  );
}

function Methods() {
  return (
    <main className="page">
      <PageHead eyebrow="Documentation" title="Methods, provenance & limits" description="A compact guide to output semantics, bounds, and interpretation of this workbench." />
      <div className="grid grid-cols-1 md:grid-cols-2">
        <section className="card card-pad">
          <h2 className="section-title mb-2">1. Intended Use</h2>
          <p className="text-sm text-slate-400 leading-relaxed">This is a research environment for exploratory model inference on isolated vascular points. It is explicitly not a diagnostic interface, nor does it possess FDA/CE clearance. Decisions should not be derived from this visual output.</p>
        </section>
        <section className="card card-pad">
          <h2 className="section-title mb-2">2. PBR Anatomical Limitations</h2>
          <p className="text-sm text-slate-400 leading-relaxed">The integrated three-dimensional anatomical asset provides visual context mimicking the spatial relationship of human coronaries. The representation of the tissue does not reflect patient imaging, but creates an interactive substrate to map discrete model scores in an accessible format.</p>
        </section>
      </div>
    </main>
  );
}

function Meta({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="metric-card">
      <div className="metric-key">{label}</div>
      <div className={`metric-value ${mono ? 'mono' : ''}`}>{value}</div>
    </div>
  );
}

function QueryUnavailable({ title, detail, onRetry }: any) {
  return (
    <div className="alert alert-danger mb-6">
      <AlertCircle className="alert-icon" size={16} />
      <div className="flex-1">
        <strong className="block mb-1">{title}</strong>
        <span className="text-xs">{detail}</span>
        <button className="button button-small bg-rose-900/40 text-rose-200 border-rose-800 mt-3" onClick={onRetry}>Retry</button>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// UTILS
// -----------------------------------------------------------------------------
function isForbidden(f: FeatureDefinition, forbidden: string[] = []) {
  const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, '');
  const key = norm(f.name), label = norm(f.label);
  const p = new Set(['cad','cath','lad','lcx','rca']);
  return p.has(key) || p.has(label) || forbidden.some(e => norm(e) === key || norm(e) === label);
}
function hasValue(v: unknown) { return v !== undefined && v !== null && v !== ''; }
function validateFeature(f: FeatureDefinition, v: unknown): string | undefined {
  if (!hasValue(v)) return f.required ? 'Required.' : undefined;
  if ((f.type === 'numeric' || (f.type === 'ordinal' && !f.categories?.length)) && (typeof v !== 'number' || !Number.isFinite(v))) return 'Must be a number.';
  if (typeof v === 'number') {
    if (f.minimum != null && v < f.minimum) return `Min: ${f.minimum}`;
    if (f.maximum != null && v > f.maximum) return `Max: ${f.maximum}`;
  }
  if (f.categories?.length && !f.categories.includes(String(v))) return 'Select a valid category.';
  return undefined;
}
function filterPredictorValues(profile: Record<string, unknown>, schema?: ClinicalSchema) {
  if (!schema) return {};
  const allowed = new Set(schema.predictors.filter((f) => !isForbidden(f, schema.forbidden_predictors)).map((f) => f.name));
  return Object.fromEntries(Object.entries(profile).filter(([k]) => allowed.has(k)));
}
