"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export function useAuthGuard(onUserChange: (userId: string | null) => void) {
  const lastUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();

    async function checkUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const currentUserId = user?.id ?? null;

      if (lastUserIdRef.current !== undefined && lastUserIdRef.current !== currentUserId) {
        onUserChange(currentUserId);
      }

      lastUserIdRef.current = currentUserId;
    }

    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const newUserId = session?.user?.id ?? null;
      
      if (lastUserIdRef.current !== undefined && lastUserIdRef.current !== newUserId) {
        onUserChange(newUserId);
      }

      lastUserIdRef.current = newUserId;
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [onUserChange]);
}
