import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  KeyRound,
  LoaderCircle,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  ShieldAlert,
  Star,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type {
  CreateRuntimeModelRequest,
  ProviderPreferences,
  RuntimeAppSettings,
  RuntimeModelConfig,
  UpdateRuntimeAppSettingsRequest,
  UpdateRuntimeModelRequest,
} from "@/types";

const STORAGE_KEY = "admin-settings-token";

const emptyPreferences: ProviderPreferences = {
  order: [],
  allow_fallbacks: true,
  require_parameters: true,
};

const emptyAppSettings: RuntimeAppSettings = {
  default_chat_model_slug: "",
  embedding_model_slug: "",
  reranker_model_slug: "",
  langextract_model_slug: "",
  semantic_cache_enabled: true,
  semantic_cache_ttl: 3600,
  semantic_cache_threshold: 0.92,
  calcom_link: "",
};

const emptyModelForm: CreateRuntimeModelRequest = {
  model_slug: "",
  display_name: "",
  is_enabled: true,
  is_default: false,
  supports_chat: true,
  supports_eval: true,
  supports_langextract: false,
  supports_embeddings: false,
  provider_preferences: emptyPreferences,
};

interface StatusBannerProps {
  tone: "error" | "success";
  text: string;
}

function StatusBanner({ tone, text }: StatusBannerProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3 text-sm",
        tone === "error"
          ? "border-rose-200 bg-rose-50/90 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
          : "border-emerald-200 bg-emerald-50/90 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
      )}
    >
      {text}
    </div>
  );
}

function ToggleRow({
  checked,
  label,
  description,
  onCheckedChange,
}: {
  checked: boolean;
  label: string;
  description: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-zinc-950/40">
      <Checkbox checked={checked} onCheckedChange={(value) => onCheckedChange(Boolean(value))} />
      <span className="space-y-1">
        <span className="block text-sm font-medium text-slate-800 dark:text-zinc-100">
          {label}
        </span>
        <span className="block text-xs text-slate-500 dark:text-zinc-400">
          {description}
        </span>
      </span>
    </label>
  );
}

function modelToForm(model: RuntimeModelConfig): CreateRuntimeModelRequest {
  return {
    model_slug: model.model_slug,
    display_name: model.display_name,
    is_enabled: model.is_enabled,
    is_default: model.is_default,
    supports_chat: model.supports_chat,
    supports_eval: model.supports_eval,
    supports_langextract: model.supports_langextract,
    supports_embeddings: model.supports_embeddings,
    provider_preferences: {
      order: model.provider_preferences.order,
      allow_fallbacks: model.provider_preferences.allow_fallbacks,
      require_parameters: model.provider_preferences.require_parameters,
      zdr: model.provider_preferences.zdr,
      only: model.provider_preferences.only,
      ignore: model.provider_preferences.ignore,
      sort: model.provider_preferences.sort,
      max_price: model.provider_preferences.max_price,
    },
  };
}

function isValidUrl(value: string): boolean {
  if (!value.trim()) {
    return true;
  }
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function selectValueWithInvalidOption(
  value: string,
  options: RuntimeModelConfig[],
): { selectValue: string; invalid: string | null } {
  if (!value) {
    return { selectValue: "", invalid: null };
  }
  const exists = options.some((option) => option.model_slug === value);
  if (exists) {
    return { selectValue: value, invalid: null };
  }
  return { selectValue: value, invalid: value };
}

export function SettingsView() {
  const [adminToken, setAdminToken] = useState("");
  const [models, setModels] = useState<RuntimeModelConfig[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modelForm, setModelForm] = useState<CreateRuntimeModelRequest>(emptyModelForm);
  const [providerOrderText, setProviderOrderText] = useState("");
  const [appSettings, setAppSettings] = useState<RuntimeAppSettings>(emptyAppSettings);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingModel, setIsSavingModel] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [statusText, setStatusText] = useState("");

  useEffect(() => {
    setAdminToken(sessionStorage.getItem(STORAGE_KEY) || "");
  }, []);

  const selectedModel = useMemo(
    () => models.find((model) => model.id === selectedId) ?? null,
    [models, selectedId],
  );

  const chatModelOptions = useMemo(
    () => models.filter((model) => model.is_enabled && model.supports_chat),
    [models],
  );
  const embeddingModelOptions = useMemo(
    () => models.filter((model) => model.is_enabled && model.supports_embeddings),
    [models],
  );
  const langextractModelOptions = useMemo(
    () => models.filter((model) => model.is_enabled && model.supports_langextract),
    [models],
  );

  const defaultChatSelect = selectValueWithInvalidOption(
    appSettings.default_chat_model_slug,
    chatModelOptions,
  );
  const embeddingSelect = selectValueWithInvalidOption(
    appSettings.embedding_model_slug,
    embeddingModelOptions,
  );
  const langextractSelect = selectValueWithInvalidOption(
    appSettings.langextract_model_slug,
    langextractModelOptions,
  );

  function resetModelForm(nextModel?: RuntimeModelConfig | null) {
    if (!nextModel) {
      setSelectedId(null);
      setModelForm(emptyModelForm);
      setProviderOrderText("");
      return;
    }
    setSelectedId(nextModel.id);
    setModelForm(modelToForm(nextModel));
    setProviderOrderText(nextModel.provider_preferences.order.join(", "));
  }

  async function loadSettings(tokenOverride?: string) {
    const token = tokenOverride ?? adminToken;
    setIsLoading(true);
    setErrorText("");
    setStatusText("");
    try {
      const [modelsResponse, appSettingsResponse] = await Promise.all([
        api.fetchRuntimeModels(token),
        api.fetchRuntimeAppSettings(token),
      ]);
      setModels(modelsResponse.models);
      setAppSettings(appSettingsResponse);
      const nextSelection =
        modelsResponse.models.find((model) => model.id === selectedId) ??
        modelsResponse.models[0] ??
        null;
      resetModelForm(nextSelection);
      setStatusText("Runtime settings loaded.");
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Failed to load settings.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUnlock() {
    sessionStorage.setItem(STORAGE_KEY, adminToken);
    await loadSettings(adminToken);
  }

  async function handleRefresh() {
    await loadSettings();
  }

  function validateModelForm(payload: CreateRuntimeModelRequest): string | null {
    if (!payload.model_slug.trim()) {
      return "Model slug is required.";
    }
    if (!payload.display_name.trim()) {
      return "Display name is required.";
    }
    return null;
  }

  async function handleSaveModel() {
    const payload: CreateRuntimeModelRequest = {
      ...modelForm,
      model_slug: modelForm.model_slug.trim(),
      display_name: modelForm.display_name.trim(),
      provider_preferences: {
        ...modelForm.provider_preferences,
        order: providerOrderText
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      },
    };
    const validationError = validateModelForm(payload);
    if (validationError) {
      setErrorText(validationError);
      setStatusText("");
      return;
    }

    setIsSavingModel(true);
    setErrorText("");
    setStatusText("");
    try {
      let saved: RuntimeModelConfig;
      if (selectedModel) {
        const updatePayload: UpdateRuntimeModelRequest = {
          display_name: payload.display_name,
          is_enabled: payload.is_enabled,
          is_default: payload.is_default,
          supports_chat: payload.supports_chat,
          supports_eval: payload.supports_eval,
          supports_langextract: payload.supports_langextract,
          supports_embeddings: payload.supports_embeddings,
          provider_preferences: payload.provider_preferences,
        };
        saved = await api.updateRuntimeModel(selectedModel.id, updatePayload, adminToken);
      } else {
        saved = await api.createRuntimeModel(payload, adminToken);
      }

      await loadSettings(adminToken);
      resetModelForm(saved);
      setStatusText(selectedModel ? "Model updated." : "Model created.");
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Failed to save model.");
    } finally {
      setIsSavingModel(false);
    }
  }

  async function handleDisableModel(modelId: string) {
    setIsSavingModel(true);
    setErrorText("");
    setStatusText("");
    try {
      await api.deleteRuntimeModel(modelId, adminToken);
      await loadSettings(adminToken);
      if (selectedId === modelId) {
        resetModelForm(null);
      }
      setStatusText("Model disabled.");
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Failed to disable model.");
    } finally {
      setIsSavingModel(false);
    }
  }

  async function handleMakeDefault(modelId: string) {
    setIsSavingModel(true);
    setErrorText("");
    setStatusText("");
    try {
      const saved = await api.makeRuntimeModelDefault(modelId, adminToken);
      await loadSettings(adminToken);
      resetModelForm(saved);
      setStatusText("Default chat model updated.");
    } catch (error) {
      setErrorText(
        error instanceof Error ? error.message : "Failed to update default model.",
      );
    } finally {
      setIsSavingModel(false);
    }
  }

  function validateAppSettings(payload: UpdateRuntimeAppSettingsRequest): string | null {
    if (!payload.default_chat_model_slug) {
      return "A default chat model is required.";
    }
    if (!payload.embedding_model_slug) {
      return "An embedding model is required.";
    }
    if (!payload.langextract_model_slug) {
      return "A LangExtract model is required.";
    }
    if (
      payload.semantic_cache_ttl === undefined ||
      !Number.isInteger(payload.semantic_cache_ttl) ||
      payload.semantic_cache_ttl < 0
    ) {
      return "Semantic cache TTL must be an integer greater than or equal to 0.";
    }
    if (
      payload.semantic_cache_threshold === undefined ||
      Number.isNaN(payload.semantic_cache_threshold) ||
      payload.semantic_cache_threshold < 0 ||
      payload.semantic_cache_threshold > 1
    ) {
      return "Semantic cache threshold must be between 0 and 1.";
    }
    if (payload.calcom_link && !isValidUrl(payload.calcom_link)) {
      return "Booking link must be a valid URL.";
    }
    if (defaultChatSelect.invalid || embeddingSelect.invalid || langextractSelect.invalid) {
      return "Resolve invalid model assignments before saving app settings.";
    }
    return null;
  }

  async function handleSaveAppSettings() {
    const payload: UpdateRuntimeAppSettingsRequest = {
      default_chat_model_slug: appSettings.default_chat_model_slug,
      embedding_model_slug: appSettings.embedding_model_slug,
      reranker_model_slug: appSettings.reranker_model_slug.trim(),
      langextract_model_slug: appSettings.langextract_model_slug,
      semantic_cache_enabled: appSettings.semantic_cache_enabled,
      semantic_cache_ttl: Number(appSettings.semantic_cache_ttl),
      semantic_cache_threshold: Number(appSettings.semantic_cache_threshold),
      calcom_link: appSettings.calcom_link.trim(),
    };

    const validationError = validateAppSettings(payload);
    if (validationError) {
      setErrorText(validationError);
      setStatusText("");
      return;
    }

    setIsSavingSettings(true);
    setErrorText("");
    setStatusText("");
    try {
      const saved = await api.updateRuntimeAppSettings(payload, adminToken);
      setAppSettings(saved);
      setStatusText("App settings updated.");
    } catch (error) {
      setErrorText(
        error instanceof Error ? error.message : "Failed to update app settings.",
      );
    } finally {
      setIsSavingSettings(false);
    }
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-[1280px] flex-col gap-6 overflow-y-auto px-2 pb-8 pt-6 sm:px-0">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 shadow-sm dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-400">
            <Settings2 className="h-3.5 w-3.5" />
            Runtime Settings
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-zinc-100">
              Internal control plane
            </h1>
            <p className="max-w-3xl text-sm text-slate-600 dark:text-zinc-400">
              Change non-secret runtime behavior live without touching `.env`. The
              database is the source of truth after bootstrap; `.env` remains for
              secrets and one-time defaults.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-3xl border border-slate-200 bg-white/75 p-2 shadow-sm dark:border-white/10 dark:bg-zinc-900/60">
          <div className="flex min-w-[260px] items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-zinc-950/50">
            <KeyRound className="h-4 w-4 text-slate-400" />
            <input
              type="password"
              value={adminToken}
              onChange={(event) => setAdminToken(event.target.value)}
              placeholder="Admin token"
              className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-zinc-100"
            />
          </div>
          <Button size="sm" onClick={handleUnlock} disabled={isLoading || !adminToken.trim()}>
            {isLoading ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldAlert className="h-4 w-4" />
            )}
            Unlock
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            disabled={isLoading || !adminToken.trim()}
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {errorText ? <StatusBanner tone="error" text={errorText} /> : null}
      {statusText ? <StatusBanner tone="success" text={statusText} /> : null}

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="border-slate-200 bg-white/75 py-0 shadow-lg dark:border-white/10 dark:bg-zinc-900/60">
          <CardHeader className="border-b border-slate-200 py-5 dark:border-white/10">
            <CardTitle className="text-base text-slate-900 dark:text-zinc-100">
              Runtime model registry
            </CardTitle>
            <CardDescription>
              Enabled chat-capable models appear in the arena model picker.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            <Button variant="outline" className="w-full justify-center" onClick={() => resetModelForm(null)}>
              <Plus className="h-4 w-4" />
              Add model
            </Button>

            <div className="space-y-2">
              {models.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => resetModelForm(model)}
                  className={cn(
                    "w-full rounded-2xl border px-4 py-3 text-left transition-all",
                    selectedId === model.id
                      ? "border-orange-300 bg-orange-50/80 shadow-sm dark:border-orange-500/40 dark:bg-orange-500/10"
                      : "border-slate-200 bg-slate-50/80 hover:border-slate-300 hover:bg-white dark:border-white/10 dark:bg-zinc-950/40 dark:hover:border-white/20",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-slate-800 dark:text-zinc-100">
                        {model.display_name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-zinc-400">
                        {model.model_slug}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      {model.is_default ? <Badge variant="secondary">Default</Badge> : null}
                      {!model.is_enabled ? <Badge variant="outline">Disabled</Badge> : null}
                    </div>
                  </div>
                </button>
              ))}

              {!models.length ? (
                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-white/10 dark:text-zinc-400">
                  Unlock settings to load runtime models.
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card className="border-slate-200 bg-white/75 py-0 shadow-lg dark:border-white/10 dark:bg-zinc-900/60">
            <CardHeader className="border-b border-slate-200 py-5 dark:border-white/10">
              <CardTitle className="text-base text-slate-900 dark:text-zinc-100">
                {selectedModel ? "Edit model" : "Create model"}
              </CardTitle>
              <CardDescription>
                Use provider order only when you need deterministic OpenRouter routing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                    Display name
                  </span>
                  <input
                    value={modelForm.display_name}
                    onChange={(event) =>
                      setModelForm((current) => ({
                        ...current,
                        display_name: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400 dark:border-white/10 dark:bg-zinc-950/40 dark:text-zinc-100"
                    placeholder="Gemini 2.5 Flash"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                    Model slug
                  </span>
                  <input
                    value={modelForm.model_slug}
                    onChange={(event) =>
                      setModelForm((current) => ({
                        ...current,
                        model_slug: event.target.value,
                      }))
                    }
                    disabled={Boolean(selectedModel)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-zinc-950/40 dark:text-zinc-100"
                    placeholder="google/gemini-2.5-flash"
                  />
                </label>
              </div>

              <label className="space-y-2">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                  Provider order
                </span>
                <textarea
                  value={providerOrderText}
                  onChange={(event) => setProviderOrderText(event.target.value)}
                  rows={4}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800 outline-none focus:border-orange-400 dark:border-white/10 dark:bg-zinc-950/40 dark:text-zinc-100"
                  placeholder="google-ai-studio, vertex-ai"
                />
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Comma-separated provider slugs in priority order.
                </p>
              </label>

              <div className="grid gap-3 md:grid-cols-2">
                <ToggleRow
                  checked={modelForm.is_enabled}
                  label="Enabled"
                  description="Expose this model to runtime systems."
                  onCheckedChange={(checked) =>
                    setModelForm((current) => ({ ...current, is_enabled: checked }))
                  }
                />
                <ToggleRow
                  checked={modelForm.is_default}
                  label="Default chat model"
                  description="Used when the chat request does not specify a model."
                  onCheckedChange={(checked) =>
                    setModelForm((current) => ({ ...current, is_default: checked }))
                  }
                />
                <ToggleRow
                  checked={modelForm.supports_chat}
                  label="Supports chat"
                  description="Eligible for the main arena chat picker."
                  onCheckedChange={(checked) =>
                    setModelForm((current) => ({ ...current, supports_chat: checked }))
                  }
                />
                <ToggleRow
                  checked={modelForm.supports_eval}
                  label="Supports eval"
                  description="Available for judge/evaluation workflows."
                  onCheckedChange={(checked) =>
                    setModelForm((current) => ({ ...current, supports_eval: checked }))
                  }
                />
                <ToggleRow
                  checked={modelForm.supports_embeddings}
                  label="Supports embeddings"
                  description="Eligible for embedding assignment in app settings."
                  onCheckedChange={(checked) =>
                    setModelForm((current) => ({
                      ...current,
                      supports_embeddings: checked,
                    }))
                  }
                />
                <ToggleRow
                  checked={modelForm.supports_langextract}
                  label="Supports langextract"
                  description="Eligible for metadata enrichment assignment."
                  onCheckedChange={(checked) =>
                    setModelForm((current) => ({
                      ...current,
                      supports_langextract: checked,
                    }))
                  }
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={handleSaveModel} disabled={isSavingModel || isLoading}>
                  {isSavingModel ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {selectedModel ? "Save model" : "Create model"}
                </Button>
                {selectedModel ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => handleMakeDefault(selectedModel.id)}
                      disabled={isSavingModel || isLoading || !selectedModel.is_enabled || !selectedModel.supports_chat}
                    >
                      <Star className="h-4 w-4" />
                      Make default
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleDisableModel(selectedModel.id)}
                      disabled={isSavingModel || isLoading || !selectedModel.is_enabled}
                    >
                      <Trash2 className="h-4 w-4" />
                      Disable
                    </Button>
                  </>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white/75 py-0 shadow-lg dark:border-white/10 dark:bg-zinc-900/60">
            <CardHeader className="border-b border-slate-200 py-5 dark:border-white/10">
              <CardTitle className="text-base text-slate-900 dark:text-zinc-100">
                Runtime app settings
              </CardTitle>
              <CardDescription>
                These settings apply to new requests immediately and persist across restarts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <ModelSelectField
                  label="Default chat model"
                  value={defaultChatSelect.selectValue}
                  invalidValue={defaultChatSelect.invalid}
                  options={chatModelOptions}
                  placeholder="Select chat model"
                  onValueChange={(value) =>
                    setAppSettings((current) => ({
                      ...current,
                      default_chat_model_slug: value,
                    }))
                  }
                />
                <ModelSelectField
                  label="Embedding model"
                  value={embeddingSelect.selectValue}
                  invalidValue={embeddingSelect.invalid}
                  options={embeddingModelOptions}
                  placeholder="Select embedding model"
                  onValueChange={(value) =>
                    setAppSettings((current) => ({
                      ...current,
                      embedding_model_slug: value,
                    }))
                  }
                />
                <ModelSelectField
                  label="LangExtract model"
                  value={langextractSelect.selectValue}
                  invalidValue={langextractSelect.invalid}
                  options={langextractModelOptions}
                  placeholder="Select langextract model"
                  onValueChange={(value) =>
                    setAppSettings((current) => ({
                      ...current,
                      langextract_model_slug: value,
                    }))
                  }
                />
                <label className="space-y-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                    Reranker model slug
                  </span>
                  <input
                    value={appSettings.reranker_model_slug}
                    onChange={(event) =>
                      setAppSettings((current) => ({
                        ...current,
                        reranker_model_slug: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400 dark:border-white/10 dark:bg-zinc-950/40 dark:text-zinc-100"
                    placeholder="BAAI/bge-reranker-v2-m3"
                  />
                </label>
              </div>

              {(defaultChatSelect.invalid || embeddingSelect.invalid || langextractSelect.invalid) ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="space-y-1">
                      <p>One or more saved model assignments no longer match enabled capability-compatible models.</p>
                      <p>Choose valid replacements before saving.</p>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <ToggleRow
                  checked={appSettings.semantic_cache_enabled}
                  label="Semantic cache enabled"
                  description="Allow semantic cache lookups for eligible flows."
                  onCheckedChange={(checked) =>
                    setAppSettings((current) => ({
                      ...current,
                      semantic_cache_enabled: checked,
                    }))
                  }
                />

                <label className="space-y-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                    Booking link
                  </span>
                  <input
                    value={appSettings.calcom_link}
                    onChange={(event) =>
                      setAppSettings((current) => ({
                        ...current,
                        calcom_link: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400 dark:border-white/10 dark:bg-zinc-950/40 dark:text-zinc-100"
                    placeholder="https://cal.com/your-team/demo"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                    Semantic cache TTL (seconds)
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={appSettings.semantic_cache_ttl}
                    onChange={(event) =>
                      setAppSettings((current) => ({
                        ...current,
                        semantic_cache_ttl: Number(event.target.value),
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400 dark:border-white/10 dark:bg-zinc-950/40 dark:text-zinc-100"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                    Semantic cache threshold
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={appSettings.semantic_cache_threshold}
                    onChange={(event) =>
                      setAppSettings((current) => ({
                        ...current,
                        semantic_cache_threshold: Number(event.target.value),
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400 dark:border-white/10 dark:bg-zinc-950/40 dark:text-zinc-100"
                  />
                </label>
              </div>

              <div className="flex items-center gap-3">
                <Button onClick={handleSaveAppSettings} disabled={isSavingSettings || isLoading}>
                  {isSavingSettings ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save app settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ModelSelectField({
  label,
  value,
  invalidValue,
  options,
  placeholder,
  onValueChange,
}: {
  label: string;
  value: string;
  invalidValue: string | null;
  options: RuntimeModelConfig[];
  placeholder: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <label className="space-y-2">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
        {label}
      </span>
      <Select value={value || undefined} onValueChange={onValueChange}>
        <SelectTrigger className="w-full rounded-xl border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-zinc-950/40">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {invalidValue ? (
            <SelectItem value={invalidValue}>Invalid: {invalidValue}</SelectItem>
          ) : null}
          {options.map((option) => (
            <SelectItem key={option.id} value={option.model_slug}>
              {option.display_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {invalidValue ? (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          Saved value is invalid: {invalidValue}
        </p>
      ) : null}
    </label>
  );
}
