"use client";

import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import { toast } from "sonner";

import {
  addCreatorPreset,
  loadCreatorPresets,
  removeCreatorPreset,
  type CreatorPreset,
} from "@/lib/pipeline/creator-presets";

type FormFields = {
  topic: string;
  tone: string;
  audience: string;
  notes: string;
  basePrompt: string;
  brandKit: string;
  artDirection: string;
};

type SetTopic = Dispatch<SetStateAction<string>>;
type Setter = Dispatch<SetStateAction<string>>;

/** Local creator presets: load once, CRUD wrappers with toasts + field setters. */
export function useCreatorPresets(options: {
  setTopic: SetTopic;
  setTone: Setter;
  setAudience: Setter;
  setNotes: Setter;
  setBasePrompt: Setter;
  setBrandKit: Setter;
  setArtDirection: Setter;
}) {
  const {
    setTopic,
    setTone,
    setAudience,
    setNotes,
    setBasePrompt,
    setBrandKit,
    setArtDirection,
  } = options;

  const [presets, setPresets] = useState<CreatorPreset[]>([]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setPresets(loadCreatorPresets());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const applyCreatorPreset = useCallback(
    (p: CreatorPreset) => {
      setTopic(p.topic);
      setTone(p.tone);
      setAudience(p.audience);
      setNotes(p.notes);
      setBasePrompt(p.basePrompt);
      setBrandKit(p.brandKit);
      setArtDirection(p.artDirection);
      toast.success(`Loaded “${p.name}”`);
    },
    [
      setArtDirection,
      setAudience,
      setBasePrompt,
      setBrandKit,
      setNotes,
      setTone,
      setTopic,
    ],
  );

  const saveCreatorPresetFromForm = useCallback(
    (name: string, fields: FormFields) => {
      const trimmed = name.trim();
      if (!trimmed) {
        toast.error("Name your preset first");
        return;
      }
      const preset: CreatorPreset = {
        id: crypto.randomUUID(),
        name: trimmed.slice(0, 80),
        createdAt: new Date().toISOString(),
        topic: fields.topic,
        tone: fields.tone,
        audience: fields.audience,
        notes: fields.notes,
        basePrompt: fields.basePrompt,
        brandKit: fields.brandKit,
        artDirection: fields.artDirection,
      };
      setPresets(addCreatorPreset(preset));
      toast.success("Preset saved");
    },
    [],
  );

  const deleteCreatorPresetById = useCallback((id: string) => {
    if (!id) return;
    setPresets(removeCreatorPreset(id));
    toast.success("Preset removed");
  }, []);

  return {
    presets,
    applyCreatorPreset,
    saveCreatorPresetFromForm,
    deleteCreatorPresetById,
  };
}
