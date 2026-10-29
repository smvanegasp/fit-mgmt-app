import { Barbell } from "@phosphor-icons/react";

import { ComingSoon } from "../components/ComingSoon";
import { useHealth } from "../hooks";

export function TrainPage() {
  const health = useHealth();
  return (
    <div className="pb-24">
      <ComingSoon icon={Barbell} title="Train">
        Start a workout, run the stopwatch and log your sets. Coming in stage 2.
      </ComingSoon>
      <p className="mt-8 text-center text-sm text-stone-500" role="status">
        API: {health.isLoading ? "checking..." : health.data?.status === "ok" ? "connected" : "unreachable"}
      </p>
    </div>
  );
}
