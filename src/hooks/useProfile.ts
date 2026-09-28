import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import {
  clearLegacySettings,
  readLegacySettings,
  settingsFromProfile,
  settingsToProfile,
  type Settings,
} from "@/lib/settings";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

const profileKey = (userId: string | undefined) => ["profile", userId] as const;

/** The signed-in user's profile row (name, avatar and settings). */
export const useProfile = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: profileKey(user?.id),
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      if (error) throw error;
      return data as Profile;
    },
  });
};

/** Settings are read from the profile; defaults are used until it loads. */
export const useSettings = () => {
  const { data, isLoading } = useProfile();
  return { settings: settingsFromProfile(data), isLoading };
};

export const useUpdateProfile = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: ProfileUpdate) => {
      const { data, error } = await supabase.from("profiles").update(patch).eq("id", user!.id).select().single();
      if (error) throw error;
      return data as Profile;
    },
    onSuccess: (row) => queryClient.setQueryData(profileKey(user?.id), row),
  });
};

export const useUpdateSettings = () => {
  const update = useUpdateProfile();
  return {
    ...update,
    mutate: (patch: Partial<Settings>, opts?: Parameters<typeof update.mutate>[1]) => update.mutate(settingsToProfile(patch), opts),
    mutateAsync: (patch: Partial<Settings>) => update.mutateAsync(settingsToProfile(patch)),
  };
};

export function initialsOf(profile: Partial<Profile> | undefined, email?: string | null) {
  if (profile?.first_name && profile?.last_name) return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
  if (profile?.first_name) return profile.first_name.substring(0, 2).toUpperCase();
  if (profile?.username) return profile.username.substring(0, 2).toUpperCase();
  return (email ?? "?").substring(0, 2).toUpperCase();
}

export function displayNameOf(profile: Partial<Profile> | undefined, email?: string | null) {
  return profile?.first_name || profile?.username || email?.split("@")[0] || "there";
}

/**
 * Runs once per account: uploads the settings this browser saved under v1
 * (localStorage) to the profile, then marks the profile as migrated so
 * another device with older local settings can't overwrite them later.
 */
export const useLegacySettingsImport = () => {
  const { data: profile } = useProfile();
  const update = useUpdateProfile();
  const started = useRef(false);

  useEffect(() => {
    if (!profile || profile.settings_migrated_at || started.current) return;
    started.current = true;
    const legacy = readLegacySettings();
    update.mutate(
      { ...settingsToProfile(legacy ?? {}), settings_migrated_at: new Date().toISOString() },
      { onSuccess: () => clearLegacySettings() },
    );
  }, [profile, update]);
};
