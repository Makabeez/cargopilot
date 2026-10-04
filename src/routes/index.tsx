import { createFileRoute } from "@tanstack/react-router";
import { TowerApp } from "@/components/tower/app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <TowerApp />;
}
