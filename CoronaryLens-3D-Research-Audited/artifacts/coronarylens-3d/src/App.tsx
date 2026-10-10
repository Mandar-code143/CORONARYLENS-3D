import { useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Link, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Activity, AlertCircle, ArrowRight, BookOpen, Check, ChevronRight, CircleHelp,
  ClipboardList, Database, FileInput, HeartPulse, Info, Layers3, Microscope,
  Network, RotateCcw, ShieldCheck, SlidersHorizontal, Sparkles, Target, Waypoints,
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

type NavItem = { href: string; label: string; icon: typeof Activity };
const navItems: NavItem[] = [
  { href: '/', label: 'Overview', icon: Activity },
  { href: '/inputs', label: 'Clinical inputs', icon: FileInput },
  { href: '/workspace', label: 'Model workspace', icon: Layers3 },
  { href: '/evidence', label: 'Evidence', icon: Microscope },
  { href: '/methods', label: 'Methods & limits', icon: BookOpen },
];
const targetInfo: Record<TargetType, { name: string; color: string }> = {
  CAD: { name: 'Overall coronary artery disease', color: '#4c8373' },
  LAD: { name: 'Left anterior descending', color: '#b17a55' },
  LCX: { name: 'Left circumflex', color: '#7188a1' },
  RCA: { name: 'Right coronary artery', color: '#98836b' },
};
const targetOrder: TargetType[] = [ApiTarget.CAD, ApiTarget.LAD, ApiTarget.LCX, ApiTarget.RCA];

function App() {
  return <QueryClientProvider client={queryClient}>
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <AppShell />
    </WouterRouter>
  </QueryClientProvider>;
}

function AppShell() {
  const [location] = useLocation();
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [selectedTarget, setSelectedTarget] = useState<TargetType>(ApiTarget.CAD);
  const [activePrediction, setActivePrediction] = useState<Prediction | null>(null);
  const [explanations, setExplanations] = useState<Partial<Record<TargetType, Explanation>>>({});
  const [demoSource, setDemoSource] = useState<DemoProfile | null>(null);
  const [, navigate] = useLocation();

  return (
      <div className="app-shell">
        <Sidebar location={location} />
        <div className="main-area">
          <Header location={location} />
          <MobileNav location={location} />
          <Switch>
            <Route path="/">
              <Overview onNavigate={navigate} />
            </Route>
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

function Sidebar({ location }: { location: string }) {
  return (
    <aside className="sidebar" aria-label="Primary navigation">
      <Link href="/" className="brand" data-testid="link-brand">
        <span className="brand-mark"><HeartPulse size={18} strokeWidth={1.8} /></span>
        <span><span className="brand-name">CoronaryLens</span><span className="brand-sub">RESEARCH WORKBENCH</span></span>
      </Link>
      <div>
        <div className="nav-label">Study environment</div>
        <nav className="nav-list">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link href={href} key={href} className="nav-link" aria-current={location === href ? 'page' : undefined} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`}>
              <Icon size={16} strokeWidth={1.8} /><span>{label}</span>
            </Link>
          ))}
        </nav>
      </div>
      <div className="side-foot">
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#c4d4cd', marginBottom: 6 }}>
          <ShieldCheck size={14} /> Research use only
        </div>
        Outputs are model estimates—not a diagnosis, treatment recommendation, or causal explanation.
      </div>
    </aside>
  );
}

function MobileNav({ location }: { location: string }) {
  return (
    <nav className="mobile-nav" aria-label="Primary navigation">
      {navItems.map(({ href, label, icon: Icon }) => (
        <Link href={href} key={href} className="nav-link" aria-current={location === href ? 'page' : undefined} data-testid={`mobile-nav-${href.slice(1) || 'overview'}`}>
          <Icon size={14} /><span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}

function Header({ location }: { location: string }) {
  const current = navItems.find((item) => item.href === location);
  const health = useHealthCheck();
  return (
    <header className="topbar">
      <div className="crumb">CoronaryLens <ChevronRight size={13} style={{ display: 'inline', verticalAlign: 'middle', margin: '0 4px' }} /> {current?.label ?? 'Not found'}</div>
      <div className="top-right">
        <span className="system-pill" data-testid="status-service-health"><span className="dot" style={{ background: health.data ? '#80a794' : health.isError ? '#bc8c7e' : '#c4b787' }} />{health.isLoading ? 'Connecting' : health.data ? 'Service online' : health.isError ? 'Service unavailable' : 'Checking service'}</span>
        <span className="mono muted" style={{ fontSize: 10 }}>v0.1 · research</span>
      </div>
    </header>
  );
}

function PageHead({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: ReactNode }) {
  return <div className="page-head page-enter">
    <div><div className="eyebrow" style={{ color: '#68877c' }}>{eyebrow}</div><h1 className="page-title">{title}</h1><p className="page-description">{description}</p></div>
    {children ? <div className="button-row">{children}</div> : null}
  </div>;
}

function Overview({ onNavigate }: { onNavigate: (path: string) => void }) {
  const readiness = useGetReadiness();
  const data = readiness.data;
  const health = useHealthCheck();
  const readinessIsError = readiness.isError;
  const states = data ? [
    ['Dataset', data.dataset], ['Feature schema', data.schema], ['Model artifacts', data.models], ['Evaluation', data.evaluation],
  ] : [];
  return (
    <main className="page">
      <PageHead eyebrow="Cardiovascular modeling · workspace 01" title="A clearer view of model readiness." description="Explore target-specific coronary model outputs, their supporting evidence, and the exact predictors used—without mistaking a research estimate for clinical guidance.">
        <button className="button button-primary" onClick={() => onNavigate('/inputs')} data-testid="button-begin-profile"><FileInput size={15} /> Open clinical profile <ArrowRight size={14} /></button>
      </PageHead>
      {readiness.isLoading ? <div className="status-grid grid" aria-label="Loading readiness" data-testid="loading-readiness">{Array.from({ length: 5 }, (_, index) => <div className="card status-card skeleton" key={index} />)}</div> : null}
      {readinessIsError ? <QueryUnavailable title="Readiness could not be retrieved" detail="The service did not return model readiness. No prediction can be run until the trained artifacts and their status are confirmed." onRetry={() => readiness.refetch()} testId="error-readiness" /> : null}
      {data ? <>
        <section className="grid status-grid" aria-label="System readiness" data-testid="readiness-status-grid">
          <div className="card status-card" data-testid="status-overall-readiness">
            <div className="status-top"><span>Workbench</span><ShieldCheck size={15} /></div>
            <div className="status-value">{data.ready ? 'Research ready' : 'Not ready'}</div>
            <div className="status-note">{data.ready ? 'Artifact checks passed · not clinical approval' : 'Prediction remains unavailable'}</div>
          </div>
          {states.map(([label, value]) => <div className="card status-card" key={label} data-testid={`status-${label.toLowerCase().replace(' ', '-')}`}>
            <div className="status-top"><span>{label}</span><span className="dot" style={{ background: readinessColor(value) }} /></div>
            <div className="status-value">{value}</div><div className="status-note">Backend-reported state</div>
          </div>)}
        </section>
        <div style={{ height: 16 }} />
        {!data.ready ? <div className="alert" role="status" data-testid="status-not-ready"><AlertCircle className="alert-icon" size={17} />
          <div><strong>Model outputs are not available yet.</strong><br />This workbench will not estimate or fabricate results. {data.blockers?.length ? `Current blockers: ${data.blockers.join(' · ')}` : 'The service has not confirmed trained model artifacts and evaluation.'}</div>
        </div> : <div className="alert" role="status" data-testid="status-ready"><Check className="alert-icon" size={17} /><div><strong>Research inference is operational.</strong><br />Artifact and checksum checks passed. This is not clinical approval; scores and explanations are exploratory estimates from a small retrospective cohort.</div></div>}
      </> : null}
      <div style={{ height: 18 }} />
      <div className="grid overview-grid">
        <section className="card card-pad">
          <div className="target-header"><div><h2 className="section-title">Four distinct targets</h2><div className="section-caption">Separate model outputs; vessel results are not interchangeable.</div></div><Waypoints size={18} color="#66897e" /></div>
          <div className="table-wrap">
            <table className="data-table" aria-label="Prediction target definitions" data-testid="table-target-definitions">
              <thead><tr><th>Target</th><th>Scope</th><th>How to read it</th></tr></thead>
              <tbody>
                <tr><td><span className="target-chip">CAD</span></td><td>Overall coronary artery disease</td><td>Summary target; not a vessel location</td></tr>
                <tr><td><span className="target-chip">LAD</span></td><td>Left anterior descending</td><td>Independent target output</td></tr>
                <tr><td><span className="target-chip">LCX</span></td><td>Left circumflex</td><td>Independent target output</td></tr>
                <tr><td><span className="target-chip">RCA</span></td><td>Right coronary artery</td><td>Independent target output</td></tr>
              </tbody>
            </table>
          </div>
        </section>
        <section className="card card-pad" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 245 }}>
          <div><div className="eyebrow" style={{ color: '#81918b' }}>Interpretation guardrail</div><h2 className="section-title" style={{ fontSize: 20, marginTop: 9 }}>An estimate is not an explanation.</h2>
            <p className="inline-note" style={{ fontSize: 12, marginTop: 10 }}>Model contributions describe how predictors relate to a model output. They do not establish causality, a clinical diagnosis, or where disease is located in an individual anatomy.</p>
          </div>
          <Link href="/methods" className="button button-small" style={{ width: 'fit-content' }} data-testid="link-methods-overview">Read methods & limits <ArrowRight size={13} /></Link>
        </section>
      </div>
      <div style={{ height: 18 }} />
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))' }}>
        <QuickLink icon={SlidersHorizontal} title="Profile editor" text="Use only predictors defined by the active clinical schema." href="/inputs" />
        <QuickLink icon={Layers3} title="Model workspace" text="Inspect model output next to schematic, selectable anatomy." href="/workspace" />
        <QuickLink icon={Database} title="Validation evidence" text="See reported evaluation metrics and registry details." href="/evidence" />
      </div>
      <div style={{ height: 16 }} />
      <div className="inline-note" data-testid="text-service-summary"><CircleHelp size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 5 }} />Service status: {health.isLoading ? 'checking' : health.data?.status ?? (health.isError ? 'unavailable' : 'not reported')} · readiness is determined by the connected service.</div>
    </main>
  );
}

function readinessColor(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes('ready') || normalized.includes('available') || normalized.includes('loaded')) return '#79a18e';
  if (normalized.includes('missing') || normalized.includes('unavailable') || normalized.includes('not')) return '#c38c7a';
  return '#b9a975';
}

function QuickLink({ icon: Icon, title, text, href }: { icon: typeof Activity; title: string; text: string; href: string }) {
  return <Link href={href} className="card card-pad" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', gap: 13, alignItems: 'flex-start' }} data-testid={`link-quick-${href.slice(1)}`}>
    <span style={{ color: '#608777', paddingTop: 1 }}><Icon size={17} /></span><span><strong style={{ display: 'block', font: '600 13px var(--app-font-serif)' }}>{title}</strong><span className="inline-note">{text}</span></span><ArrowRight size={13} style={{ marginLeft: 'auto', color: '#9aa7a1', flex: 'none' }} />
  </Link>;
}

function QueryUnavailable({ title, detail, onRetry, testId }: { title: string; detail: string; onRetry: () => void; testId: string }) {
  return <div className="alert alert-danger" role="alert" data-testid={testId}><AlertCircle className="alert-icon" size={17} /><div style={{ flex: 1 }}><strong>{title}.</strong><br />{detail}<div style={{ marginTop: 9 }}><button className="button button-small" onClick={onRetry} data-testid={`button-retry-${testId}`}>Retry request</button></div></div></div>;
}

function Inputs({ values, setValues, demoSource, onDemo, onNavigate }: {
  values: Record<string, unknown>; setValues: (values: Record<string, unknown>) => void;
  demoSource: DemoProfile | null; onDemo: (profile: DemoProfile | null) => void; onNavigate: (path: string) => void;
}) {
  const schemaQuery = useGetClinicalSchema();
  const demoQuery = useGetDemoProfile({ query: { enabled: false, queryKey: getGetDemoProfileQueryKey() } });
  const readinessQuery = useGetReadiness();
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const schema = schemaQuery.data;
  const grouped = useMemo(() => {
    const map = new Map<string, FeatureDefinition[]>();
    schema?.predictors?.forEach((feature) => {
      if (isForbidden(feature, schema.forbidden_predictors)) return;
      map.set(feature.group, [...(map.get(feature.group) ?? []), feature]);
    });
    return [...map.entries()];
  }, [schema]);
  const requiredCount = schema?.predictors.filter((feature) => feature.required && !isForbidden(feature, schema.forbidden_predictors)).length ?? 0;
  const completedRequired = schema?.predictors.filter((feature) => feature.required && !isForbidden(feature, schema.forbidden_predictors) && hasValue(values[feature.name])).length ?? 0;
  const profileComplete = Boolean(schema && Object.keys(filterPredictorValues(values, schema)).length > 0 && completedRequired === requiredCount &&
    schema.predictors.filter((feature) => !isForbidden(feature, schema.forbidden_predictors))
      .every((feature) => !hasValue(values[feature.name]) || !validateFeature(feature, values[feature.name])));

  const setField = (feature: FeatureDefinition, raw: string) => {
    const next = { ...values };
    if (raw === '') delete next[feature.name];
    else if (feature.type === 'numeric' || (feature.type === 'ordinal' && !feature.categories?.length)) next[feature.name] = Number(raw);
    else next[feature.name] = raw;
    setValues(next);
    const error = validateFeature(feature, next[feature.name]);
    setLocalErrors((previous) => {
      const copy = { ...previous };
      if (error) copy[feature.name] = error;
      else delete copy[feature.name];
      return copy;
    });
  };

  const loadDemo = async () => {
    onDemo(null);
    try {
      const response = await demoQuery.refetch();
      if (response.data) {
        const filtered = filterPredictorValues(response.data.values, schema);
        setValues(filtered);
        onDemo(response.data);
        setLocalErrors({});
      }
    } catch {
      // The query error is rendered below; no substitute profile is created.
    }
  };

  const attemptContinue = () => {
    if (!schema) return;
    const errors: Record<string, string> = {};
    schema.predictors.filter((feature) => !isForbidden(feature, schema.forbidden_predictors)).forEach((feature) => {
      const error = validateFeature(feature, values[feature.name]);
      if (error && (feature.required || hasValue(values[feature.name]))) errors[feature.name] = error;
    });
    setLocalErrors(errors);
    if (!profileComplete || Object.keys(errors).length) return;
    onNavigate('/workspace');
  };

  return <main className="page">
    <PageHead eyebrow="Input profile · schema controlled" title="Clinical profile" description="Enter a complete profile using the active approved predictor schema. No clinical features are inferred or prefilled; the optional demonstration profile is retrieved from the service.">
      <button className="button" disabled={!schema || demoQuery.isFetching} onClick={loadDemo} data-testid="button-load-demo-profile">
        {demoQuery.isFetching ? <span className="skeleton" style={{ width: 12, height: 12 }} /> : <RotateCcw size={14} />} Load service demo profile
      </button>
      <button className="button button-primary" disabled={!schema || !profileComplete || readinessQuery.data?.ready !== true} onClick={attemptContinue} data-testid="button-continue-workspace">Review profile <ArrowRight size={14} /></button>
    </PageHead>
    <div className="alert" style={{ marginBottom: 16 }} data-testid="notice-input-scope"><Info className="alert-icon" size={16} /><div><strong>Predictors only.</strong> Target labels (CAD, Cath, LAD, LCX, RCA) are excluded from the predictor payload. Required fields must be complete; optional blank fields are omitted.</div></div>
    {schemaQuery.isLoading ? <div className="form-groups" aria-label="Loading feature schema" data-testid="loading-schema">{[1, 2, 3].map((item) => <div className="card form-group skeleton" key={item} style={{ height: 145 }} />)}</div> : null}
    {schemaQuery.isError ? <QueryUnavailable title="Clinical schema unavailable" detail="Without the approved schema, predictor names and value semantics cannot be verified. Profile editing and submission are disabled." onRetry={() => schemaQuery.refetch()} testId="error-schema" /> : null}
    {schema && <>
      <div className="card card-pad" style={{ marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }} data-testid="schema-summary">
        <div><div className="eyebrow" style={{ color: '#87948e' }}>Schema {schema.schema_version}</div><div style={{ fontSize: 12, marginTop: 6, color: '#556565' }}>{schema.predictor_count} predictors · source: {schema.source}</div></div>
        <div className="badge" data-testid="status-profile-completeness"><span className="dot" style={{ background: profileComplete ? '#6c9d83' : '#c0aa70' }} />{completedRequired} / {requiredCount} required fields</div>
      </div>
      {demoSource ? <div className="alert" style={{ marginBottom: 14 }} data-testid="status-demo-profile-loaded"><Check size={16} className="alert-icon" /><div><strong>{demoSource.label}</strong> · Loaded from the backend demo-profile endpoint. <span>{demoSource.provenance}</span></div></div> : null}
      {demoQuery.isError ? <QueryUnavailable title="Demo profile could not be loaded" detail="No placeholder profile has been substituted. Retry to request the service-approved profile." onRetry={loadDemo} testId="error-demo-profile" /> : null}
      {!grouped.length ? <EmptyState title="No approved predictors returned" text="The schema contains no usable predictor definitions. Profile entry is unavailable." /> :
        <div className="form-groups" style={{ marginTop: 14 }}>
          {grouped.map(([group, features]) => <section className="card form-group" key={group} data-testid={`group-predictors-${slug(group)}`}>
            <div className="target-header"><div><h2 className="section-title">{group}</h2><div className="section-caption">{features.length} schema-defined field{features.length === 1 ? '' : 's'}</div></div><span className="mono muted" style={{ fontSize: 10 }}>INPUT GROUP</span></div>
            <div className="fields-grid">{features.map((feature) => <SchemaField key={feature.name} feature={feature} value={values[feature.name]} error={localErrors[feature.name]} onChange={(raw) => setField(feature, raw)} />)}</div>
          </section>)}
        </div>}
      {schema.forbidden_predictors.length > 0 ? <div className="inline-note" style={{ marginTop: 14 }} data-testid="text-forbidden-predictors">Excluded target/forbidden fields: {schema.forbidden_predictors.join(', ')}</div> : null}
      {readinessQuery.data?.ready !== true ? <div className="alert" style={{ marginTop: 14 }} role="status" data-testid="status-prediction-blocked"><AlertCircle className="alert-icon" size={16} /><div><strong>Prediction is gated.</strong> The service has not confirmed that real trained artifacts are ready. You can inspect schema fields, but cannot submit a model request.</div></div> : null}
    </>}
  </main>;
}

function isForbidden(feature: FeatureDefinition, forbidden: string[] = []) {
  const key = normalize(feature.name);
  const label = normalize(feature.label);
  const protectedKeys = new Set(['cad', 'cath', 'lad', 'lcx', 'rca']);
  return protectedKeys.has(key) || protectedKeys.has(label) || forbidden.some((entry) => normalize(entry) === key || normalize(entry) === label);
}

function normalize(value: string) { return value.toLowerCase().replace(/[^a-z0-9]/g, ''); }
function slug(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); }
function hasValue(value: unknown) { return value !== undefined && value !== null && value !== ''; }
function validateFeature(feature: FeatureDefinition, value: unknown): string | undefined {
  if (!hasValue(value)) return feature.required ? 'This field is required.' : undefined;
  if ((feature.type === 'numeric' || (feature.type === 'ordinal' && !feature.categories?.length)) && (typeof value !== 'number' || !Number.isFinite(value))) return 'Enter a valid number.';
  if (typeof value === 'number') {
    if (feature.minimum != null && value < feature.minimum) return `Minimum value is ${feature.minimum}.`;
    if (feature.maximum != null && value > feature.maximum) return `Maximum value is ${feature.maximum}.`;
  }
  if (feature.categories?.length && !feature.categories.includes(String(value))) return 'Choose a schema-defined category.';
  return undefined;
}
function filterPredictorValues(profile: Record<string, unknown>, schema?: ClinicalSchema): Record<string, unknown> {
  if (!schema) return {};
  const allowed = new Set(schema.predictors.filter((feature) => !isForbidden(feature, schema.forbidden_predictors)).map((feature) => feature.name));
  return Object.fromEntries(Object.entries(profile).filter(([key]) => allowed.has(key)));
}

function SchemaField({ feature, value, error, onChange }: { feature: FeatureDefinition; value: unknown; error?: string; onChange: (value: string) => void }) {
  const id = `field-${slug(feature.name)}`;
  const categories = feature.categories ?? [];
  const numberValue = value === undefined || value === null ? '' : String(value);
  return <div>
    <label className="field-label" htmlFor={id}>{feature.label}{feature.required ? <span className="required">*</span> : null}{feature.unit ? <span className="muted" style={{ fontWeight: 400 }}> ({feature.unit})</span> : null}</label>
    {categories.length ? <select id={id} className="field-input" value={numberValue} onChange={(event) => onChange(event.target.value)} aria-required={feature.required} aria-invalid={Boolean(error)} aria-describedby={`${id}-help ${error ? `${id}-error` : ''}`} data-testid={`input-${slug(feature.name)}`}>
      <option value="">Select a value</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}
    </select> : <input id={id} className="field-input" type={feature.type === 'numeric' || feature.type === 'ordinal' ? 'number' : 'text'} value={numberValue} onChange={(event) => onChange(event.target.value)} min={feature.minimum ?? undefined} max={feature.maximum ?? undefined} step={feature.type === 'numeric' ? 'any' : 1} aria-required={feature.required} aria-invalid={Boolean(error)} aria-describedby={`${id}-help ${error ? `${id}-error` : ''}`} data-testid={`input-${slug(feature.name)}`} />}
    <div className="field-help" id={`${id}-help`}>{feature.description || `${feature.type}${feature.semantics_verified ? ' · semantics verified' : ' · semantics not verified'}`}{feature.minimum != null || feature.maximum != null ? ` · range ${feature.minimum ?? '—'} to ${feature.maximum ?? '—'}` : ''}</div>
    {error ? <div className="field-error" id={`${id}-error`} role="alert">{error}</div> : null}
  </div>;
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="card card-pad" data-testid="empty-state"><Network size={20} color="#82978c" /><h3 className="section-title" style={{ marginTop: 12 }}>{title}</h3><p className="inline-note">{text}</p></div>;
}

function Workspace({ values, selectedTarget, setSelectedTarget, prediction, setPrediction, explanations, setExplanations, onNavigate }: {
  values: Record<string, unknown>; selectedTarget: TargetType; setSelectedTarget: (target: TargetType) => void;
  prediction: Prediction | null; setPrediction: (prediction: Prediction | null) => void;
  explanations: Partial<Record<TargetType, Explanation>>; setExplanations: (value: Partial<Record<TargetType, Explanation>>) => void;
  onNavigate: (path: string) => void;
}) {
  const schemaQuery = useGetClinicalSchema();
  const readinessQuery = useGetReadiness();
  const predictionMutation = useCreatePrediction();
  const explanationMutation = useExplainPrediction();
  const schema = schemaQuery.data;
  const safeValues = useMemo(() => filterPredictorValues(values, schema), [values, schema]);
  const usableFeatures = schema?.predictors.filter((feature) => !isForbidden(feature, schema.forbidden_predictors)) ?? [];
  const complete = Boolean(schema && usableFeatures.some((feature) => hasValue(safeValues[feature.name])) &&
    usableFeatures.filter((feature) => feature.required).every((feature) => hasValue(safeValues[feature.name])) &&
    usableFeatures.every((feature) => !hasValue(safeValues[feature.name]) || !validateFeature(feature, safeValues[feature.name])));
  const canPredict = readinessQuery.data?.ready === true && complete && !schemaQuery.isError && Object.keys(safeValues).length > 0;
  const matchingExplanation = explanations[selectedTarget]?.prediction_request_id === prediction?.request_id ? explanations[selectedTarget] : undefined;

  const runPrediction = () => {
    if (!canPredict) return;
    setExplanations({});
    setPrediction(null);
    predictionMutation.mutate({ data: { values: safeValues } }, { onSuccess: (response) => setPrediction(response) });
  };
  const requestExplanation = () => {
    if (!prediction || !safeValues) return;
    explanationMutation.mutate({ target: selectedTarget, data: { values: safeValues, prediction_request_id: prediction.request_id } }, {
      onSuccess: (response) => {
        if (response.prediction_request_id === prediction.request_id && response.target === selectedTarget) setExplanations({ ...explanations, [selectedTarget]: response });
      },
    });
  };
  const selectedOutput = prediction?.outputs?.[selectedTarget];
  const vesselScores = useMemo(() => ({
    LAD: prediction?.outputs?.LAD?.score_semantics === 'probability' ? prediction.outputs.LAD.score : undefined,
    LCX: prediction?.outputs?.LCX?.score_semantics === 'probability' ? prediction.outputs.LCX.score : undefined,
    RCA: prediction?.outputs?.RCA?.score_semantics === 'probability' ? prediction.outputs.RCA.score : undefined,
  }), [prediction]);
  return <main className="page">
    <PageHead eyebrow="Target-specific output · anatomy explorer" title="Model workspace" description="Review each model target independently beside a general schematic of coronary anatomy. CAD is a global dataset label; LAD, LCX and RCA are separate vessel labels. This display is illustrative—not a patient-specific lesion map.">
      <Link href="/inputs" className="button" data-testid="link-edit-profile"><SlidersHorizontal size={14} /> Edit profile</Link>
      <button className="button button-primary" onClick={runPrediction} disabled={!canPredict || predictionMutation.isPending} data-testid="button-run-models">
        {predictionMutation.isPending ? <span className="skeleton" style={{ width: 12, height: 12 }} /> : <Activity size={14} />}{predictionMutation.isPending ? 'Requesting models' : 'Run four target models'}
      </button>
    </PageHead>
    {!canPredict ? <div className="alert" style={{ marginBottom: 16 }} data-testid="status-workspace-blocked"><AlertCircle size={16} className="alert-icon" /><div><strong>Prediction is unavailable.</strong> {!schema ? 'The approved clinical schema has not loaded. ' : !complete ? 'A complete schema-validated clinical profile is required. ' : ''}{readinessQuery.data?.ready !== true ? 'Real trained model artifacts have not been confirmed ready. ' : ''}<Link href="/inputs" style={{ color: '#326f60', fontWeight: 700 }} data-testid="link-workspace-inputs">Review clinical inputs</Link></div></div> : null}
    {predictionMutation.isError ? <QueryUnavailable title="Model request was unavailable" detail="The service did not return a prediction. No output has been substituted. Check readiness and try again when trained artifacts are available." onRetry={runPrediction} testId="error-prediction" /> : null}
    {predictionMutation.isPending ? <div className="card card-pad" role="status" data-testid="loading-prediction" style={{ marginBottom: 16 }}><div className="skeleton" style={{ height: 13, width: '35%' }} /><div className="skeleton" style={{ height: 52, marginTop: 14 }} /></div> : null}
    <div className="anatomy-layout">
      <section className="anatomy-panel" aria-label="Schematic coronary anatomy">
        <div className="anatomy-toolbar"><span className="badge"><span className="dot" /> GENERAL ANATOMY SCHEMATIC</span><span className="mono muted" style={{ fontSize: 10 }}>NOT PATIENT-SPECIFIC</span></div>
        <CoronaryScene selected={selectedTarget} onSelect={setSelectedTarget} scores={vesselScores} />
        <div className="risk-legend" role="note" aria-label="Vessel color legend">
          <span className="risk-legend-title">Vessel color</span>
          <span className="risk-legend-gradient" aria-hidden="true" />
          <span>Lower</span><span>Higher</span>
          <span className="risk-legend-note">model-estimated positive-class score · not a clinical threshold</span>
        </div>
      </section>
      <aside>
        <div className="eyebrow" style={{ color: '#82908a', margin: '3px 0 9px' }}>Select output target</div>
        <div className="vessel-select" role="group" aria-label="Choose prediction target">
          {targetOrder.map((target) => <button key={target} className={`target-button ${selectedTarget === target ? 'active' : ''}`} onClick={() => setSelectedTarget(target)} aria-pressed={selectedTarget === target} data-testid={`button-select-${target.toLowerCase()}`} style={{ '--vessel-color': targetInfo[target].color } as CSSProperties}>
            <span><span className="target-acronym">{target}</span><span className="target-name">{targetInfo[target].name}</span></span>{target === 'CAD' ? <span className="global-target-badge">GLOBAL</span> : <span className="target-swatch" />}
          </button>)}
        </div>
        <div className="target-result" style={{ marginTop: 14 }} data-testid={`result-target-${selectedTarget.toLowerCase()}`}>
          <div className="target-header"><span className="metric-label">{selectedTarget} model output</span><Target size={15} color={targetInfo[selectedTarget].color} /></div>
          {selectedOutput ? <>
            <div className="score-placeholder" data-testid={`value-score-${selectedTarget.toLowerCase()}`}>{formatScore(selectedOutput.score, selectedOutput.score_semantics)}</div>
            <div className="inline-note">{selectedOutput.score_semantics === 'probability' ? 'Model-estimated positive-class probability (not clinically calibrated)' : 'Model score · not a probability'}{selectedOutput.predicted_class ? ` · predicted dataset label ${selectedOutput.predicted_class}` : ''}</div>
            <div className="divider" />
            <div className="inline-note">Model {selectedOutput.model_family} · {selectedOutput.model_version}{selectedOutput.threshold != null ? ` · threshold ${selectedOutput.threshold}` : ''}</div>
          </> : <><div className="score-placeholder">Not available</div><div className="inline-note">No successful response for this target in this session.</div></>}
        </div>
        {selectedTarget === ApiTarget.CAD ? <div className="inline-note" style={{ marginTop: 11 }} data-testid="note-cad-summary"><Info size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />CAD is an overall summary output; it is not assigned to a single vessel.</div> : null}
      </aside>
    </div>
    <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(280px,.75fr)', marginTop: 16 }}>
      <section className="card card-pad">
        <div className="target-header"><div><h2 className="section-title">Output interpretation</h2><div className="section-caption">Reported for the selected target only</div></div><span className="target-chip">{selectedTarget}</span></div>
        {selectedOutput ? <div className="alert" style={{ marginTop: 13 }} data-testid="status-output-semantics"><Info size={15} className="alert-icon" /><div>{selectedOutput.score_semantics === 'probability' ? 'The backend identifies this value as a probability. It is not an individualized diagnosis.' : 'The backend identifies this as a model score. Do not interpret it as a probability.'} {prediction?.warnings?.join(' ')}</div></div> :
          <EmptyState title="No target output to interpret" text="Run the four-model request after readiness is confirmed and a complete approved profile is available." />}
        {prediction ? <div className="inline-note mono" style={{ marginTop: 12 }} data-testid="text-prediction-request">Request {prediction.request_id} · registry {prediction.registry_version}</div> : null}
      </section>
      <section className="card card-pad">
        <div className="target-header"><div><h2 className="section-title">Model explanation</h2><div className="section-caption">Approximate permutation SHAP grouped by source predictor; not causal attribution</div></div><Sparkles size={16} color="#779485" /></div>
        {!matchingExplanation ? <>
          <p className="inline-note" style={{ margin: '14px 0' }}>No explanation has been returned for {selectedTarget} in the current request.</p>
          <button className="button button-small" onClick={requestExplanation} disabled={!prediction || explanationMutation.isPending} data-testid="button-explain-target">
            {explanationMutation.isPending ? 'Requesting explanation' : 'Request target explanation'}
          </button>
        </> : <ExplanationPanel explanation={matchingExplanation} />}
        {explanationMutation.isError ? <div role="alert" className="field-error" style={{ marginTop: 9 }} data-testid="error-explanation">Explanation unavailable. No contributions are inferred or fabricated.</div> : null}
      </section>
    </div>
    <div className="alert" style={{ marginTop: 16 }} data-testid="notice-anatomy-limit"><Info size={15} className="alert-icon" /><div>The anatomy is a general, schematic orientation model. Selection highlights an artery associated with its distinct model output; it does not indicate a stenosis location or describe a patient-specific scan.</div></div>
  </main>;
}

function formatScore(score: number, semantics: string) {
  return semantics === 'probability' ? `${(score * 100).toFixed(1)}%` : score.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function ExplanationPanel({ explanation }: { explanation: Explanation }) {
  const max = Math.max(...explanation.contributions.map((item) => Math.abs(item.contribution)), 0);
  return <div data-testid={`panel-explanation-${explanation.target.toLowerCase()}`}>
    <div className="inline-note" style={{ margin: '10px 0 14px' }}>{explanation.method} · baseline {explanation.baseline} · output space {explanation.output_space}</div>
    {explanation.contributions.length ? <div className="contribution-list">{explanation.contributions.map((item) => <div className="contribution-item" key={item.feature} data-testid={`contribution-${slug(item.feature)}`}>
      <span title={item.description ?? item.label}>{item.label}<span className="field-help" style={{ display: 'block' }}>value: {String(item.value)}</span></span>
      <div className="contribution-bar" aria-label={`${item.direction === 'toward_positive' ? 'Toward positive' : 'Toward negative'} contribution`}>
        <div className={`contribution-fill ${item.direction === 'toward_negative' ? 'negative' : ''}`} style={{ width: `${max ? Math.max(2, Math.abs(item.contribution) / max * 100) : 0}%` }} />
      </div><span className="mono">{item.contribution.toPrecision(3)}</span>
    </div>)}</div> : <div className="inline-note">The service returned no contributions for this target.</div>}
    {explanation.limitations.length ? <div className="field-help" style={{ marginTop: 14 }}><strong>Limitations</strong><ul style={{ paddingLeft: 16 }}>{explanation.limitations.map((limitation, index) => <li key={`${index}-${limitation}`}>{limitation}</li>)}</ul></div> : null}
    <div className="inline-note mono" style={{ marginTop: 8 }}>Request {explanation.prediction_request_id} · model {explanation.model_version}</div>
  </div>;
}

function Evidence() {
  const registryQuery = useGetModelRegistry();
  const evaluationQuery = useGetEvaluation();
  const registry = registryQuery.data;
  const evaluation = evaluationQuery.data;
  return <main className="page">
    <PageHead eyebrow="Evidence ledger · service reported" title="Validation & model registry" description="Inspect reported model versions, validation approach, and available metrics. Absence of information is shown as unavailable—not estimated." />
    {(registryQuery.isError || evaluationQuery.isError) ? <div className="alert" style={{ marginBottom: 16 }} data-testid="status-evidence-partial"><AlertCircle size={16} className="alert-icon" /><div>Some evidence could not be retrieved. The sections below reflect only successful service responses.</div></div> : null}
    <section className="card card-pad" style={{ marginBottom: 16 }}>
      <div className="target-header"><div><h2 className="section-title">Registry details</h2><div className="section-caption">Model provenance reported by the backend</div></div><Database size={17} color="#728c80" /></div>
      {registryQuery.isLoading ? <div className="skeleton" style={{ height: 48 }} data-testid="loading-registry" /> : registry ? <RegistryDetails registry={registry} /> : <UnavailableInline label="Model registry" onRetry={() => registryQuery.refetch()} testId="registry-unavailable" />}
    </section>
    <section className="card card-pad">
      <div className="target-header"><div><h2 className="section-title">Measured evaluation</h2><div className="section-caption">Metrics and fold count as reported; no values are inferred</div></div><ClipboardList size={17} color="#728c80" /></div>
      {evaluationQuery.isLoading ? <div className="skeleton" style={{ height: 140 }} data-testid="loading-evaluation" /> : evaluation ? <EvaluationDetails evaluation={evaluation} /> : <UnavailableInline label="Evaluation results" onRetry={() => evaluationQuery.refetch()} testId="evaluation-unavailable" />}
    </section>
    <div className="alert" style={{ marginTop: 16 }} data-testid="notice-validation-context"><Info size={15} className="alert-icon" /><div>Performance metrics are dataset- and validation-specific. They do not establish prospective performance, clinical utility, causality, or suitability for an individual patient.</div></div>
  </main>;
}

function RegistryDetails({ registry }: { registry: ModelRegistry }) {
  return <>
    <div className="metrics-grid" style={{ maxWidth: 850, marginBottom: 15 }}>
      <Meta label="Registry version" value={registry.version} /><Meta label="Feature schema" value={registry.feature_schema_version} />
      <Meta label="Dataset checksum" value={registry.dataset_checksum} mono />
    </div>
    {registry.targets?.length ? <div className="table-wrap"><table className="data-table" data-testid="table-model-registry"><thead><tr><th>Target</th><th>Family / version</th><th>Score semantics</th><th>Validation method</th><th>Selection rationale</th></tr></thead><tbody>
      {registry.targets.map((model) => <tr key={model.target} data-testid={`row-registry-${model.target.toLowerCase()}`}><td><span className="target-chip">{model.target}</span></td><td>{model.model_family} · {model.model_version}</td><td>{model.score_semantics}</td><td>{model.validation_method}</td><td>{model.selection_rationale || 'Not reported'}</td></tr>)}
    </tbody></table></div> : <EmptyState title="No target models reported" text="The registry response did not include target-specific model records." />}
  </>;
}

function EvaluationDetails({ evaluation }: { evaluation: import('@workspace/api-client-react').Evaluation }) {
  const metricNames = ['accuracy', 'balanced_accuracy', 'precision', 'recall', 'specificity', 'f1', 'roc_auc', 'pr_auc', 'brier_score'] as const;
  return <>
    <div className="metrics-grid" style={{ maxWidth: 850, marginBottom: 15 }}>
      <Meta label="Dataset source" value={evaluation.dataset_source} /><Meta label="Sample count" value={String(evaluation.sample_count)} mono /><Meta label="Validation method" value={evaluation.validation_method} />
    </div>
    {evaluation.targets?.length ? evaluation.targets.map((target) => {
      const reported = metricNames.filter((metric) => target.metrics[metric] != null);
      return <div key={target.target} style={{ marginTop: 14 }} data-testid={`evaluation-target-${target.target.toLowerCase()}`}>
        <div className="target-header"><div><span className="target-chip">{target.target}</span><span className="inline-note" style={{ marginLeft: 9 }}>{target.model_family} · {target.fold_count} folds</span></div></div>
        {reported.length ? <div className="metrics-grid">{reported.map((metric) => <Meta key={metric} label={metric.replaceAll('_', ' ')} value={formatMetric(target.metrics[metric]!)} mono />)}</div> : <div className="inline-note">No metrics were reported for this target.</div>}
      </div>;
    }) : <EmptyState title="No target evaluation reported" text="The service response contains no per-target evaluation records." />}
  </>;
}

function formatMetric(value: number) { return Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 4 }) : 'Not reported'; }

function Meta({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="metric-card"><div className="metric-key">{label}</div><div className={`metric-value ${mono ? 'mono' : ''}`} style={{ fontSize: value.length > 35 ? 11 : undefined, wordBreak: 'break-word' }} data-testid={`value-${slug(label)}`}>{value}</div></div>;
}

function UnavailableInline({ label, onRetry, testId }: { label: string; onRetry: () => void; testId: string }) {
  return <div className="alert" data-testid={testId}><AlertCircle size={15} className="alert-icon" /><div style={{ flex: 1 }}>{label} is unavailable. No evidence has been generated or substituted.</div><button className="button button-small" onClick={onRetry} data-testid={`button-retry-${testId}`}>Retry</button></div>;
}

function Methods() {
  const schemaQuery = useGetClinicalSchema();
  const readinessQuery = useGetReadiness();
  const registryQuery = useGetModelRegistry();
  const schema = schemaQuery.data;
  return <main className="page">
    <PageHead eyebrow="Documentation · intended use and boundaries" title="Methods, provenance & limits" description="A compact guide to the data contract, output semantics, anatomical display, and scientific boundaries of this workbench." />
    <div className="method-grid">
      <section className="card method-card">
        <div className="eyebrow" style={{ color: '#81918b' }}>01 · Intended use</div><h2 className="section-title" style={{ marginTop: 8 }}>Research exploration, not clinical decision support.</h2>
        <p>CoronaryLens 3D presents outputs from four separate target models—overall CAD and vessel-specific LAD, LCX, and RCA. Results are computational estimates for research review. They are not diagnoses, treatment recommendations, or substitutes for clinician interpretation.</p>
      </section>
      <section className="card method-card">
        <div className="eyebrow" style={{ color: '#81918b' }}>02 · Input contract</div><h2 className="section-title" style={{ marginTop: 8 }}>Only schema-defined predictors enter the model.</h2>
        <p>Input controls come from the connected clinical schema. Required fields must be complete; optional empty values are omitted. Target labels and explicitly forbidden predictors are removed before submission.</p>
        {schema ? <div className="method-code" data-testid="method-schema-version">Schema {schema.schema_version} · {schema.predictor_count} predictors · {schema.source}</div> : <div className="inline-note" data-testid="method-schema-unavailable">{schemaQuery.isLoading ? 'Retrieving active schema…' : 'Active schema unavailable; no predictor definition assumed.'}</div>}
      </section>
      <section className="card method-card">
        <div className="eyebrow" style={{ color: '#81918b' }}>03 · Output semantics</div><h2 className="section-title" style={{ marginTop: 8 }}>Probability only when the model says probability.</h2>
        <p>Each target output carries its own score semantics. A <em>model_score</em> is not a probability. An output labeled <em>probability</em> is an uncalibrated model estimate and does not establish an individual's clinical state. Vessel colors only encode relative positive-class scores from the three vessel models; they do not locate a lesion.</p>
        <ul><li>CAD is an overall summary; it is not mapped onto a vessel.</li><li>LAD, LCX, and RCA are distinct, independently selectable model outputs.</li></ul>
      </section>
      <section className="card method-card">
        <div className="eyebrow" style={{ color: '#81918b' }}>04 · Explanations</div><h2 className="section-title" style={{ marginTop: 8 }}>Contributions describe model behavior.</h2>
        <p>Feature contributions are requested for one prediction request ID and target. The interface displays only a matching response from the API. Contribution direction and values are reported in the API's stated output space.</p>
        <p>Associations in a fitted model do not prove causal effects. Explanation methods have limitations and should not be interpreted as mechanistic evidence.</p>
      </section>
      <section className="card method-card">
        <div className="eyebrow" style={{ color: '#81918b' }}>05 · Anatomy rendering</div><h2 className="section-title" style={{ marginTop: 8 }}>Schematic geometry, never a lesion map.</h2>
        <p>The locally rendered coronary tree is a general orientation schematic. Selecting a vessel highlights its own branch and target result. No patient scan, stenosis location, or patient-specific vessel geometry is shown.</p>
      </section>
      <section className="card method-card">
        <div className="eyebrow" style={{ color: '#81918b' }}>06 · Dataset & model provenance</div><h2 className="section-title" style={{ marginTop: 8 }}>Read what the service actually reports.</h2>
        <p>Dataset source, checksum, schema version, model family/version, validation method, and evaluation values are retrieved from backend evidence endpoints. Missing or unavailable data remains explicitly unavailable.</p>
        {registryQuery.data ? <div className="method-code" data-testid="method-registry-version">Registry {registryQuery.data.version} · schema {registryQuery.data.feature_schema_version} · checksum {registryQuery.data.dataset_checksum}</div> : <div className="inline-note" data-testid="method-registry-unavailable">{registryQuery.isLoading ? 'Retrieving registry…' : 'Registry provenance unavailable.'}</div>}
      </section>
      <section className="card method-card">
        <div className="eyebrow" style={{ color: '#81918b' }}>07 · Readiness gate</div><h2 className="section-title" style={{ marginTop: 8 }}>No trained artifacts, no prediction.</h2>
        <p>Prediction submission is disabled unless the service reports readiness and a complete schema-valid profile is available. This interface does not create mock predictions, demo metrics, or fallback contributions.</p>
        <div className="method-code" data-testid="method-readiness-status">{readinessQuery.isLoading ? 'Readiness: checking' : readinessQuery.data ? `Readiness: ${readinessQuery.data.ready ? 'ready' : 'not ready'} · ${readinessQuery.data.blockers.join('; ') || 'no blockers reported'}` : 'Readiness unavailable'}</div>
      </section>
      <section className="card method-card">
        <div className="eyebrow" style={{ color: '#81918b' }}>08 · Review checklist</div><h2 className="section-title" style={{ marginTop: 8 }}>Before interpreting any output</h2>
        <ul><li>Confirm dataset provenance and validation protocol.</li><li>Review target-specific metrics and model versions.</li><li>Distinguish probability from a model score.</li><li>Consider calibration, population shift, missingness, and external validity.</li><li>Do not infer causality or patient-specific anatomy from model contribution displays.</li></ul>
      </section>
    </div>
  </main>;
}

export default App;
