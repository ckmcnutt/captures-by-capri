import { useEffect, useState } from "react";
import { useLocation } from "wouter";

export function useAdminAuth() {
  const [checked, setChecked] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [, navigate] = useLocation();

  useEffect(() => {
    fetch("/api/admin/me", { credentials: "include" })
      .then((res) => {
        if (res.ok) {
          setAuthed(true);
        } else {
          navigate("/admin/login");
        }
      })
      .catch(() => navigate("/admin/login"))
      .finally(() => setChecked(true));
  }, [navigate]);

  return { checked, authed };
}
