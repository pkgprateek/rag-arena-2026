import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  LoaderCircle,
  Save,
  Settings2,
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
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { RuntimeAppSettings, UpdateRuntimeAppSettingsRequest } from "@/types";

const emptyAppSettings: RuntimeAppSettings = {
  default_chat_model_slug: "",
  semantic_cache_enabled: true,
  semantic_cache_ttl: 3600,
  semantic_cache_threshold: 0.92,
  calcom_link: "",
  embedding_model: "",
  reranker_model: "",
  langextract_model: "",
  reranker_backend: "local_llamacpp",
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

function FieldLabel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium text-slate-900 dark:text-zinc-100">
        {title}
      </div>
      <div className="text-xs leading-5 text-slate-500 dark:text-zinc-400">
        {description}
      </div>
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
    <label className="flex items-start gap-3 rounded-[22px] border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-zinc-950/40">
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(Boolean(value))}
      />
      <span className="space-y-1">
        <span className="block text-sm font-medium text-slate-800 dark:text-zinc-100">
          {label}
        </span>
        <span className="block text-xs leading-5 text-slate-500 dark:text-zinc-400">
          {description}
        </span>
      </span>
    </label>
  );
}

function ModelCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-[22px] border border-slate-200/80 bg-white/85 p-4 shadow-sm shadow-slate-200/30 dark:border-white/10 dark:bg-zinc-950/50 dark:shadow-none">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-zinc-500">
        {label}
      </div>
      <div className="mt-3 break-words text-sm font-medium leading-6 text-slate-900 dark:text-zinc-100">
        {value || "Unavailable"}
      </div>
      <div className="mt-2 text-xs leading-5 text-slate-500 dark:text-zinc-400">
        {hint}
      </div>
    </div>
  );
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

export function SettingsView() {
  const [appSettings, setAppSettings] = useState<RuntimeAppSettings>(emptyAppSettings);
  const [chatModelOptions, setChatModelOptions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [statusText, setStatusText] = useState("");

  const activeModels = useMemo(
    () => [
      {
        label: "Default chat model",
        value: appSettings.default_chat_model_slug,
        hint: "Editable below. This remains the user-facing chat default.",
      },
      {
        label: "Embedding model",
        value: appSettings.embedding_model,
        hint: "Platform-managed for now to keep retrieval stable across restarts.",
      },
      {
        label: "Reranker model",
        value: appSettings.reranker_model,
        hint: appSettings.reranker_backend
          ? `Served through ${appSettings.reranker_backend}.`
          : "Platform-managed local reranker.",
      },
      {
        label: "Langextract model",
        value: appSettings.langextract_model,
        hint: "Platform-managed extraction model for structured document signals.",
      },
    ],
    [appSettings],
  );
  const availableChatModels = useMemo(() => {
    const models = [...chatModelOptions];
    if (
      appSettings.default_chat_model_slug &&
      !models.includes(appSettings.default_chat_model_slug)
    ) {
      models.unshift(appSettings.default_chat_model_slug);
    }
    return models;
  }, [appSettings.default_chat_model_slug, chatModelOptions]);

  async function loadSettings() {
    setIsLoading(true);
    setErrorText("");
    setStatusText("");

    try {
      const [modelsResponse, settingsResponse] = await Promise.all([
        api.fetchModels(),
        api.fetchRuntimeAppSettings(),
      ]);
      const nextOptions = modelsResponse.models;
      setChatModelOptions(nextOptions);
      setAppSettings((current) => ({
        ...current,
        ...settingsResponse,
        default_chat_model_slug:
          settingsResponse.default_chat_model_slug ||
          modelsResponse.default ||
          nextOptions[0] ||
          "",
      }));
    } catch (error) {
      setErrorText(
        error instanceof Error ? error.message : "Failed to load settings.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // Load immediately on first mount; this page has no token unlock flow.
    void loadSettings();
  }, []);

  function validateAppSettings(
    payload: UpdateRuntimeAppSettingsRequest,
  ): string | null {
    if (!payload.default_chat_model_slug) {
      return "Choose a default chat model.";
    }
    if (
      payload.semantic_cache_ttl === undefined ||
      Number.isNaN(payload.semantic_cache_ttl) ||
      payload.semantic_cache_ttl < 0
    ) {
      return "Semantic cache TTL must be zero or a positive number.";
    }
    if (
      payload.semantic_cache_threshold === undefined ||
      Number.isNaN(payload.semantic_cache_threshold) ||
      payload.semantic_cache_threshold < 0 ||
      payload.semantic_cache_threshold > 1
    ) {
      return "Semantic cache threshold must stay between 0 and 1.";
    }
    if (payload.calcom_link && !isValidUrl(payload.calcom_link)) {
      return "Cal.com link must be a valid URL.";
    }
    return null;
  }

  async function handleSaveSettings() {
    const payload: UpdateRuntimeAppSettingsRequest = {
      default_chat_model_slug: appSettings.default_chat_model_slug,
      semantic_cache_enabled: appSettings.semantic_cache_enabled,
      semantic_cache_ttl: Math.max(0, Math.round(Number(appSettings.semantic_cache_ttl))),
      semantic_cache_threshold: Number(appSettings.semantic_cache_threshold),
      calcom_link: appSettings.calcom_link.trim(),
    };

    const validationError = validateAppSettings(payload);
    if (validationError) {
      setErrorText(validationError);
      setStatusText("");
      return;
    }

    setIsSaving(true);
    setErrorText("");
    setStatusText("");

    try {
      const saved = await api.updateRuntimeAppSettings(payload);
      setAppSettings(saved);
      setStatusText("Settings saved.");
    } catch (error) {
      setErrorText(
        error instanceof Error ? error.message : "Failed to save settings.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white/80 px-5 py-3 text-sm text-slate-600 shadow-sm dark:border-white/10 dark:bg-zinc-900/70 dark:text-zinc-300">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Loading settings
        </div>
      </div>
    );
  }

  if (errorText && !appSettings.default_chat_model_slug) {
    return (
      <Card className="mx-auto mt-12 max-w-2xl rounded-[28px] border-slate-200/80 bg-white/85 shadow-lg shadow-slate-200/50 dark:border-white/10 dark:bg-zinc-900/75 dark:shadow-none">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-2 text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl text-slate-900 dark:text-zinc-100">
                Settings unavailable
              </CardTitle>
              <CardDescription className="mt-1 text-sm leading-6 text-slate-500 dark:text-zinc-400">
                The page loads directly without an admin token. If this deployment
                now requires authenticated settings access, the backend will need a
                dedicated flow for it.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <StatusBanner tone="error" text={errorText} />
          <Button
            onClick={() => void loadSettings()}
            className="rounded-full bg-slate-900 px-5 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-zinc-200"
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 pt-4">
      <Card className="overflow-hidden rounded-[32px] border-slate-200/80 bg-[linear-gradient(140deg,rgba(255,255,255,0.94),rgba(247,240,229,0.94))] shadow-xl shadow-amber-100/50 dark:border-white/10 dark:bg-[linear-gradient(140deg,rgba(24,24,27,0.94),rgba(18,24,39,0.9))] dark:shadow-none">
        <CardHeader className="gap-4 border-b border-slate-200/70 pb-6 dark:border-white/10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <Badge className="w-fit rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
                App status
              </Badge>
              <div className="space-y-2">
                <CardTitle className="flex items-center gap-3 text-3xl tracking-tight text-slate-900 dark:text-zinc-50">
                  <span className="rounded-2xl border border-slate-200/80 bg-white/80 p-2 text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
                    <Settings2 className="h-5 w-5" />
                  </span>
                  Settings
                </CardTitle>
                <CardDescription className="max-w-2xl text-sm leading-6 text-slate-600 dark:text-zinc-400">
                  App behavior and active system models. Retrieval-critical models
                  are code-owned so stale runtime rows cannot drift the platform.
                </CardDescription>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200/70 bg-white/75 px-4 py-3 text-sm shadow-sm dark:border-white/10 dark:bg-white/5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-zinc-500">
                Semantic cache
              </div>
              <div className="mt-2 flex items-center gap-2 text-slate-900 dark:text-zinc-100">
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    appSettings.semantic_cache_enabled
                      ? "bg-emerald-500"
                      : "bg-slate-300 dark:bg-zinc-600",
                  )}
                />
                {appSettings.semantic_cache_enabled ? "Enabled" : "Disabled"}
              </div>
              <div className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
                TTL {appSettings.semantic_cache_ttl}s, threshold{" "}
                {appSettings.semantic_cache_threshold}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          {errorText ? <StatusBanner tone="error" text={errorText} /> : null}
          {statusText ? <StatusBanner tone="success" text={statusText} /> : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="rounded-[28px] border-slate-200/80 bg-white/85 shadow-lg shadow-slate-200/40 dark:border-white/10 dark:bg-zinc-900/70 dark:shadow-none">
          <CardHeader>
            <CardTitle className="text-xl tracking-tight text-slate-900 dark:text-zinc-50">
              Active system models
            </CardTitle>
            <CardDescription className="text-sm leading-6 text-slate-500 dark:text-zinc-400">
              These are the live model assignments the app is using right now.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {activeModels.map((model) => (
              <ModelCard
                key={model.label}
                label={model.label}
                value={model.value}
                hint={model.hint}
              />
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-slate-200/80 bg-white/85 shadow-lg shadow-slate-200/40 dark:border-white/10 dark:bg-zinc-900/70 dark:shadow-none">
          <CardHeader>
            <CardTitle className="text-xl tracking-tight text-slate-900 dark:text-zinc-50">
              App behavior
            </CardTitle>
            <CardDescription className="text-sm leading-6 text-slate-500 dark:text-zinc-400">
              Small runtime controls that remain safe to edit.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <FieldLabel
                title="Default chat model"
                description="Used when a chat or compare request does not pin a specific model."
              />
              <select
                value={appSettings.default_chat_model_slug}
                onChange={(event) =>
                  setAppSettings((current) => ({
                    ...current,
                    default_chat_model_slug: event.target.value,
                  }))
                }
                className="flex h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:bg-white dark:border-white/10 dark:bg-zinc-950/50 dark:text-zinc-100 dark:focus:border-white/20"
              >
                {availableChatModels.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>

            <ToggleRow
              checked={appSettings.semantic_cache_enabled}
              label="Semantic cache enabled"
              description="Keeps near-duplicate requests fast when the similarity threshold is met."
              onCheckedChange={(checked) =>
                setAppSettings((current) => ({
                  ...current,
                  semantic_cache_enabled: checked,
                }))
              }
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel
                  title="Cache TTL"
                  description="Seconds before cached semantic matches expire. Use 0 to disable retention."
                />
                <input
                  type="number"
                  min={0}
                  value={appSettings.semantic_cache_ttl}
                  onChange={(event) =>
                    setAppSettings((current) => ({
                      ...current,
                      semantic_cache_ttl: Number(event.target.value),
                    }))
                  }
                  className="flex h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:bg-white dark:border-white/10 dark:bg-zinc-950/50 dark:text-zinc-100 dark:focus:border-white/20"
                />
              </div>

              <div className="space-y-2">
                <FieldLabel
                  title="Cache threshold"
                  description="Similarity score required before a semantic cache hit is reused."
                />
                <input
                  type="number"
                  min={0}
                  max={1}
                  step="0.01"
                  value={appSettings.semantic_cache_threshold}
                  onChange={(event) =>
                    setAppSettings((current) => ({
                      ...current,
                      semantic_cache_threshold: Number(event.target.value),
                    }))
                  }
                  className="flex h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:bg-white dark:border-white/10 dark:bg-zinc-950/50 dark:text-zinc-100 dark:focus:border-white/20"
                />
              </div>
            </div>

            <div className="space-y-2">
              <FieldLabel
                title="Cal.com link"
                description="Optional booking URL surfaced in product touchpoints."
              />
              <input
                type="url"
                value={appSettings.calcom_link}
                onChange={(event) =>
                  setAppSettings((current) => ({
                    ...current,
                    calcom_link: event.target.value,
                  }))
                }
                placeholder="https://cal.com/your-team/demo"
                className="flex h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white dark:border-white/10 dark:bg-zinc-950/50 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-white/20"
              />
            </div>

            <Button
              onClick={() => void handleSaveSettings()}
              disabled={isSaving || availableChatModels.length === 0}
              className="w-full rounded-full bg-slate-900 px-5 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-zinc-200"
            >
              {isSaving ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Saving
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save changes
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[28px] border-slate-200/80 bg-white/80 shadow-lg shadow-slate-200/30 dark:border-white/10 dark:bg-zinc-900/60 dark:shadow-none">
        <CardHeader>
          <CardTitle className="text-lg tracking-tight text-slate-900 dark:text-zinc-50">
            System notes
          </CardTitle>
          <CardDescription className="text-sm leading-6 text-slate-500 dark:text-zinc-400">
            The settings page is intentionally narrow.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm leading-6 text-slate-600 dark:text-zinc-300">
          <div className="rounded-[22px] border border-slate-200/70 bg-slate-50/70 px-4 py-3 dark:border-white/10 dark:bg-zinc-950/40">
            Embedding, reranker, and langextract are platform-managed for now so
            boot-time config always wins over stale runtime rows.
          </div>
          <div className="rounded-[22px] border border-slate-200/70 bg-slate-50/70 px-4 py-3 dark:border-white/10 dark:bg-zinc-950/40">
            Runtime model registry controls and token-gated admin workflows are
            intentionally deferred from this product surface.
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
