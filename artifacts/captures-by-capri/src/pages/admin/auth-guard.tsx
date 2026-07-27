import { useEffect, useState } from "react";
import { useLocation } from "wouter";

export function useAdminAuth() {
  const [checked, setChecked] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [commit, setCommit] = useState<string | null>(null);
  const [, navigate] = useLocation();

  useEffect(() => {
    fetch("/api/admin/me", { credentials: "include" })
      .then(async (res) => {
        if (res.ok) {
          setAuthed(true);
          const data = (await res.json().catch(() => ({}))) as {
            commit?: string;
          };
          setCommit(data.commit ?? null);
        } else {
          navigate("/admin/login");
        }
      })
      .catch(() => navigate("/admin/login"))
      .finally(() => setChecked(true));
  }, [navigate]);

  return { checked, authed, commit };
}
