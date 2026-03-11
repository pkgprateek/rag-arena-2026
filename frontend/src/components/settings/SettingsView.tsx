import { useEffect, useMemo, useState } from "react";
import {
  KeyRound,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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

interface SettingsViewProps {
  onModelsChanged?: () => Promise<void> | void;
  onAppSettingsChanged?: () => Promise<void> | void;
}

const STORAGE_KEY = "admin-settings-token";

const emptyPreferences: ProviderPreferences = {
  order: [],
  allow_fallbacks: true,
  require_parameters: true,
};

const emptyForm: CreateRuntimeModelRequest = {
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
      order: model.provider_preferences.order || [],
      allow_fallbacks: model.provider_preferences.allow_fallbacks,
      require_parameters: model.provider_preferences.require_parameters,
    },
  };
}

export function SettingsView({
  onModelsChanged,
  onAppSettingsChanged,
}: SettingsViewProps) {
  const [adminToken, setAdminToken] = useState("");
  const [models, setModels] = useState<RuntimeModelConfig[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateRuntimeModelRequest>(emptyForm);
  const [providerOrderText, setProviderOrderText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingAppSettings, setIsSavingAppSettings] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [statusText, setStatusText] = useState("");
  const [appSettings, setAppSettings] = useState<RuntimeAppSettings>({
    embedding_model: "",
    reranker_model: "",
    langextract_model: "",
    semantic_cache_ttl: 3600,
    semantic_cache_threshold: 0.92,
    calcom_link: "",
  });

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY) || "";
    setAdminToken(stored);
  }, []);

  const selectedModel = useMemo(
    () => models.find((model) => model.id === selectedId) || null,
    [models, selectedId],
  );

  async function loadModels(tokenOverride?: string) {
    const token = tokenOverride ?? adminToken;
    setIsLoading(true);
    setErrorText("");
    try {
      const response = await api.fetchRuntimeModels(token);
      const appSettingsResponse = await api.fetchRuntimeAppSettings(token);
      setModels(response.models);
      setAppSettings(appSettingsResponse);
      if (response.models.length > 0 && !selectedId) {
        const first = response.models[0];
        setSelectedId(first.id);
        setForm(modelToForm(first));
        setProviderOrderText(first.provider_preferences.order.join(", "));
      }
      setStatusText("Runtime model settings loaded.");
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Failed to load settings.");
    } finally {
      setIsLoading(false);
    }
  }

  function resetForm(nextModel?: RuntimeModelConfig | null) {
    if (!nextModel) {
      setSelectedId(null);
      setForm(emptyForm);
      setProviderOrderText("");
      return;
    }
    setSelectedId(nextModel.id);
    setForm(modelToForm(nextModel));
    setProviderOrderText(nextModel.provider_preferences.order.join(", "));
  }

  async function handleUnlock() {
    sessionStorage.setItem(STORAGE_KEY, adminToken);
    await loadModels(adminToken);
  }

  async function handleSave() {
    const payload: CreateRuntimeModelRequest = {
      ...form,
      model_slug: form.model_slug.trim(),
      display_name: form.display_name.trim(),
      provider_preferences: {
        ...form.provider_preferences,
        order: providerOrderText
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      },
    };

    setIsSaving(true);
    setErrorText("");
    setStatusText("");
    try {
      if (!payload.model_slug || !payload.display_name) {
        throw new Error("Model slug and display name are required.");
      }

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

      await loadModels(adminToken);
      resetForm(saved);
      await onModelsChanged?.();
      setStatusText(selectedModel ? "Model updated." : "Model created.");
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Failed to save model.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDisable(modelId: string) {
    setIsSaving(true);
    setErrorText("");
    try {
      await api.deleteRuntimeModel(modelId, adminToken);
      await loadModels(adminToken);
      if (selectedId === modelId) {
        resetForm(null);
      }
      await onModelsChanged?.();
      setStatusText("Model disabled.");
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Failed to disable model.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleMakeDefault(modelId: string) {
    setIsSaving(true);
    setErrorText("");
    try {
      const saved = await api.makeRuntimeModelDefault(modelId, adminToken);
      await loadModels(adminToken);
      resetForm(saved);
      await onModelsChanged?.();
      setStatusText("Default model updated.");
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Failed to set default model.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveAppSettings() {
    setIsSavingAppSettings(true);
    setErrorText("");
    try {
      const payload: UpdateRuntimeAppSettingsRequest = {
        embedding_model: appSettings.embedding_model.trim(),
        reranker_model: appSettings.reranker_model.trim(),
        langextract_model: appSettings.langextract_model.trim(),
        semantic_cache_ttl: Number(appSettings.semantic_cache_ttl),
        semantic_cache_threshold: Number(appSettings.semantic_cache_threshold),
        calcom_link: appSettings.calcom_link.trim(),
      };
      const saved = await api.updateRuntimeAppSettings(payload, adminToken);
      setAppSettings(saved);
      await onAppSettingsChanged?.();
      setStatusText("App settings updated.");
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Failed to update app settings.");
    } finally {
      setIsSavingAppSettings(false);
    }
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-[1240px] flex-col gap-6 overflow-y-auto px-6 pb-10 pt-20">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 shadow-sm dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-400">
            <Settings2 className="h-3.5 w-3.5" />
            Runtime Settings
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-zinc-100">
            OpenRouter model control plane
          </h1>
          <p className="max-w-2xl text-sm text-slate-600 dark:text-zinc-400">
            Manage enabled models, default selection, and per-model provider ordering
            without restarting the backend.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white/70 p-2 shadow-sm dark:border-white/10 dark:bg-zinc-900/60">
          <div className="flex min-w-[260px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-zinc-950/60">
            <KeyRound className="h-4 w-4 text-slate-400" />
            <input
              type="password"
              value={adminToken}
              onChange={(event) => setAdminToken(event.target.value)}
              placeholder="Admin token"
              className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-zinc-200"
            />
          </div>
          <Button size="sm" onClick={handleUnlock} disabled={isLoading}>
            {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
            Unlock
          </Button>
        </div>
      </div>

      {errorText ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          {errorText}
        </div>
      ) : null}

      {statusText ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
          {statusText}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="border-slate-200 bg-white/75 py-0 shadow-lg dark:border-white/10 dark:bg-zinc-900/60">
          <CardHeader className="border-b border-slate-200 py-5 dark:border-white/10">
            <CardTitle className="text-base text-slate-900 dark:text-zinc-100">
              Configured models
            </CardTitle>
            <CardDescription>
              Only enabled chat models appear in the main model selector.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-center"
              onClick={() => resetForm(null)}
            >
              <Plus className="h-4 w-4" />
              Add model
            </Button>

            <div className="space-y-2">
              {models.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => resetForm(model)}
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

              {models.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-white/10 dark:text-zinc-400">
                  Unlock settings to load runtime models.
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white/75 py-0 shadow-lg dark:border-white/10 dark:bg-zinc-900/60">
          <CardHeader className="border-b border-slate-200 py-5 dark:border-white/10">
            <CardTitle className="text-base text-slate-900 dark:text-zinc-100">
              {selectedModel ? "Edit model" : "Create model"}
            </CardTitle>
            <CardDescription>
              Provider order is sent to OpenRouter exactly as configured here.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                  Display name
                </span>
                <input
                  value={form.display_name}
                  onChange={(event) => setForm((current) => ({ ...current, display_name: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400 dark:border-white/10 dark:bg-zinc-950/40 dark:text-zinc-100"
                  placeholder="Gemini 2.5 Flash"
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                  Model slug
                </span>
                <input
                  value={form.model_slug}
                  onChange={(event) => setForm((current) => ({ ...current, model_slug: event.target.value }))}
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
                Comma-separated OpenRouter provider slugs in priority order.
              </p>
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <ToggleRow
                checked={form.is_enabled}
                label="Enabled"
                description="Expose this model to runtime systems."
                onCheckedChange={(checked) => setForm((current) => ({ ...current, is_enabled: checked }))}
              />
              <ToggleRow
                checked={form.is_default}
                label="Default chat model"
                description="Use this model when the frontend does not specify one."
                onCheckedChange={(checked) => setForm((current) => ({ ...current, is_default: checked }))}
              />
              <ToggleRow
                checked={form.provider_preferences.allow_fallbacks}
                label="Allow fallbacks"
                description="Permit OpenRouter to try lower-priority providers."
                onCheckedChange={(checked) =>
                  setForm((current) => ({
                    ...current,
                    provider_preferences: { ...current.provider_preferences, allow_fallbacks: checked },
                  }))
                }
              />
              <ToggleRow
                checked={form.provider_preferences.require_parameters}
                label="Require parameters"
                description="Route only to providers that support the requested parameters."
                onCheckedChange={(checked) =>
                  setForm((current) => ({
                    ...current,
                    provider_preferences: { ...current.provider_preferences, require_parameters: checked },
                  }))
                }
              />
              <ToggleRow
                checked={form.supports_chat}
                label="Supports chat"
                description="Eligible for the main chat and compare model selector."
                onCheckedChange={(checked) => setForm((current) => ({ ...current, supports_chat: checked }))}
              />
              <ToggleRow
                checked={form.supports_eval}
                label="Supports eval"
                description="Eligible for LLM-as-judge evaluation."
                onCheckedChange={(checked) => setForm((current) => ({ ...current, supports_eval: checked }))}
              />
              <ToggleRow
                checked={form.supports_langextract}
                label="Supports LangExtract"
                description="Can be selected for metadata enrichment."
                onCheckedChange={(checked) => setForm((current) => ({ ...current, supports_langextract: checked }))}
              />
              <ToggleRow
                checked={form.supports_embeddings}
                label="Supports embeddings"
                description="Can be used as the OpenRouter embeddings model."
                onCheckedChange={(checked) => setForm((current) => ({ ...current, supports_embeddings: checked }))}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={handleSave} disabled={isSaving}>
                <Save className="h-4 w-4" />
                {selectedModel ? "Save changes" : "Create model"}
              </Button>
              {selectedModel ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => handleMakeDefault(selectedModel.id)}
                    disabled={isSaving}
                  >
                    <Star className="h-4 w-4" />
                    Make default
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleDisable(selectedModel.id)}
                    disabled={isSaving}
                  >
                    <Trash2 className="h-4 w-4" />
                    Disable model
                  </Button>
                </>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 bg-white/75 py-0 shadow-lg dark:border-white/10 dark:bg-zinc-900/60">
        <CardHeader className="border-b border-slate-200 py-5 dark:border-white/10">
          <CardTitle className="text-base text-slate-900 dark:text-zinc-100">
            Runtime app settings
          </CardTitle>
          <CardDescription>
            Manage the remaining model/runtime controls without editing env files.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 p-6 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
              Embedding model
            </span>
            <input
              value={appSettings.embedding_model}
              onChange={(event) =>
                setAppSettings((current) => ({ ...current, embedding_model: event.target.value }))
              }
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400 dark:border-white/10 dark:bg-zinc-950/40 dark:text-zinc-100"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
              Reranker model
            </span>
            <input
              value={appSettings.reranker_model}
              onChange={(event) =>
                setAppSettings((current) => ({ ...current, reranker_model: event.target.value }))
              }
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400 dark:border-white/10 dark:bg-zinc-950/40 dark:text-zinc-100"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
              LangExtract model
            </span>
            <input
              value={appSettings.langextract_model}
              onChange={(event) =>
                setAppSettings((current) => ({ ...current, langextract_model: event.target.value }))
              }
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400 dark:border-white/10 dark:bg-zinc-950/40 dark:text-zinc-100"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
              Cal.com link
            </span>
            <input
              value={appSettings.calcom_link}
              onChange={(event) =>
                setAppSettings((current) => ({ ...current, calcom_link: event.target.value }))
              }
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400 dark:border-white/10 dark:bg-zinc-950/40 dark:text-zinc-100"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
              Semantic cache TTL
            </span>
            <input
              type="number"
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
              step="0.01"
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

          <div className="md:col-span-2">
            <Button onClick={handleSaveAppSettings} disabled={isSavingAppSettings}>
              <Save className="h-4 w-4" />
              Save app settings
            </Button>
          </div>
        </CardContent>
      </Card>
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
    <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-zinc-950/40">
      <Checkbox
        checked={checked}
        onCheckedChange={(value: boolean | "indeterminate") =>
          onCheckedChange(value === true)
        }
        className="mt-0.5"
      />
      <div className="space-y-1">
        <p className="text-sm font-medium text-slate-800 dark:text-zinc-100">{label}</p>
        <p className="text-xs text-slate-500 dark:text-zinc-400">{description}</p>
      </div>
    </label>
  );
}
