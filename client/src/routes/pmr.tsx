import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { useGameStore } from "../stores/game";

function PMRLayout() {
  const setGameId = useGameStore((state) => state.setGameId);
  useEffect(() => {
    setGameId("pmr");
    return () => setGameId(null);
  }, [setGameId]);
  return <Outlet />;
}

export const Route = createFileRoute("/pmr")({
  component: PMRLayout,
});
